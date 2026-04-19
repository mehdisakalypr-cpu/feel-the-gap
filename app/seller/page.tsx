'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface Offer {
  id: string
  product_name: string
  product_description: string | null
  affiliate_base_url: string
  commission_pct: number
  category: string | null
  target_geos: string[]
  status: string
  created_at: string
}

const CATEGORIES = [
  'agriculture', 'energy', 'materials', 'industrial', 'resources',
  'food', 'textile', 'technology', 'health', 'other',
]

export default function SellerPage() {
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [tier, setTier] = useState<string>('free')

  const [form, setForm] = useState({
    product_name: '',
    product_description: '',
    product_url: '',
    affiliate_base_url: '',
    commission_pct: '',
    category: '',
    target_geos: '',
    target_niches: '',
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single()

      setTier(profile?.tier ?? 'free')

      const { data } = await supabase
        .from('affiliate_offers')
        .select('id, product_name, product_description, affiliate_base_url, commission_pct, category, target_geos, status, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })

      setOffers(data ?? [])
      setLoading(false)
    }
    init()
  }, [router, supabase])

  async function createOffer(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_name.trim() || !form.affiliate_base_url.trim() || !form.commission_pct) return

    setCreating(true)
    const res = await fetch('/api/affiliate/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name:        form.product_name,
        product_description: form.product_description || null,
        product_url:         form.product_url || null,
        affiliate_base_url:  form.affiliate_base_url,
        commission_pct:      parseFloat(form.commission_pct),
        category:            form.category || null,
        target_geos:         form.target_geos ? form.target_geos.split(',').map(s => s.trim()).filter(Boolean) : [],
        target_niches:       form.target_niches ? form.target_niches.split(',').map(s => s.trim()).filter(Boolean) : [],
      }),
    })

    const { id, error } = await res.json()
    if (error) { alert(error); setCreating(false); return }

    // Reload offers
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('affiliate_offers')
        .select('id, product_name, product_description, affiliate_base_url, commission_pct, category, target_geos, status, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
      setOffers(data ?? [])
    }

    setForm({ product_name: '', product_description: '', product_url: '', affiliate_base_url: '', commission_pct: '', category: '', target_geos: '', target_niches: '' })
    setShowForm(false)
    setCreating(false)
  }

  async function toggleStatus(offerId: string, current: string) {
    const next = current === 'active' ? 'paused' : 'active'
    await supabase.from('affiliate_offers').update({ status: next }).eq('id', offerId)
    setOffers(o => o.map(x => x.id === offerId ? { ...x, status: next } : x))
  }

  const canCreate = ['standard', 'premium', 'enterprise'].includes(tier)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Espace Vendeur</h1>
            <p className="text-sm text-gray-500 mt-1">
              Créez des offres d'affiliation. Les influenceurs de la plateforme les proposeront à leur audience.
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowForm(f => !f)}
              className="px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              {showForm ? '✕ Annuler' : '+ Nouvelle offre'}
            </button>
          )}
        </div>

        {/* Paywall si plan insuffisant */}
        {!canCreate && (
          <div className="border border-[#C9A84C]/30 bg-[#C9A84C]/5 rounded-2xl p-8 text-center mb-8">
            <div className="text-3xl mb-3">🔒</div>
            <h2 className="text-white font-bold mb-2">Plan Strategy requis</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              La création d'offres d'affiliation est disponible à partir du plan Strategy (99 €/mois).
              Les influenceurs de la plateforme pourront promouvoir vos produits et vous générez des ventes trackées.
            </p>
            <Link href="/pricing"
              className="inline-block px-6 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              Voir les plans →
            </Link>
          </div>
        )}

        {/* Formulaire création */}
        {showForm && canCreate && (
          <form onSubmit={createOffer}
            className="border border-[#C9A84C]/25 bg-[#0D1117] rounded-2xl p-6 mb-8 space-y-4">
            <h2 className="font-semibold text-white mb-2">Nouvelle offre d'affiliation</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nom du produit *</label>
                <input value={form.product_name} onChange={e => setForm(f => ({...f, product_name: e.target.value}))}
                  required placeholder="ex : Exosquelette randonnée XR-1"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Commission offerte (%) *</label>
                <input value={form.commission_pct} onChange={e => setForm(f => ({...f, commission_pct: e.target.value}))}
                  required type="number" min="1" max="50" step="0.5" placeholder="ex : 15"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Description du produit</label>
              <textarea value={form.product_description} onChange={e => setForm(f => ({...f, product_description: e.target.value}))}
                rows={2} placeholder="Description courte visible par les influenceurs"
                className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">URL page produit</label>
                <input value={form.product_url} onChange={e => setForm(f => ({...f, product_url: e.target.value}))}
                  type="url" placeholder="https://monsite.com/produit"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">URL d'affiliation de base *</label>
                <input value={form.affiliate_base_url} onChange={e => setForm(f => ({...f, affiliate_base_url: e.target.value}))}
                  required type="url" placeholder="https://monsite.com/r/ftg"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Catégorie</label>
                <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#C9A84C]">
                  <option value="">— Choisir —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Pays cibles (séparés par virgule)</label>
                <input value={form.target_geos} onChange={e => setForm(f => ({...f, target_geos: e.target.value}))}
                  placeholder="ex : FR, DE, BE"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Niches cibles (séparées par virgule)</label>
                <input value={form.target_niches} onChange={e => setForm(f => ({...f, target_niches: e.target.value}))}
                  placeholder="ex : outdoor, trekking, santé"
                  className="w-full px-3 py-2.5 bg-[#111827] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            <p className="text-xs text-gray-500 border-t border-white/5 pt-4">
              La plateforme conserve <span className="text-white font-medium">30 %</span> de la commission.
              Les <span className="text-white font-medium">70 %</span> restants sont versés automatiquement aux influenceurs via Stripe Connect (J+7 après conversion confirmée).
            </p>

            <button type="submit" disabled={creating}
              className="w-full py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm disabled:opacity-60">
              {creating ? 'Création en cours…' : 'Créer l\'offre'}
            </button>
          </form>
        )}

        {/* Liste des offres */}
        <div>
          <h2 className="font-semibold text-white mb-4">Mes offres ({offers.length})</h2>
          {offers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm border border-white/5 rounded-2xl">
              {canCreate
                ? 'Aucune offre créée. Cliquez sur "+ Nouvelle offre" pour commencer.'
                : 'Passez au plan Strategy pour créer des offres d\'affiliation.'}
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map(offer => (
                <div key={offer.id}
                  className="border border-white/10 bg-[#0D1117] rounded-2xl p-5 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">{offer.product_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        offer.status === 'active'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-gray-500/15 text-gray-400'
                      }`}>
                        {offer.status === 'active' ? 'Active' : 'Pausée'}
                      </span>
                      {offer.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                          {offer.category}
                        </span>
                      )}
                    </div>
                    {offer.product_description && (
                      <p className="text-xs text-gray-400 mb-2">{offer.product_description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="text-[#C9A84C] font-semibold">{offer.commission_pct} % commission</span>
                      {offer.target_geos.length > 0 && <span>Géos : {offer.target_geos.join(', ')}</span>}
                      <span className="text-gray-600">
                        Créée le {new Date(offer.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => toggleStatus(offer.id, offer.status)}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors">
                    {offer.status === 'active' ? 'Mettre en pause' : 'Réactiver'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
