'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import CreditCounter from '@/components/CreditCounter'
import { createBrowserClient } from '@supabase/ssr'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://feel-the-gap.vercel.app'

interface Offer {
  id: string
  product_name: string
  product_description: string | null
  product_url: string | null
  commission_pct: number
  category: string | null
  target_geos: string[]
  target_niches: string[]
}

interface LinkStat {
  id: string
  unique_code: string
  clicks: number
  conversions: number
  total_earned_cents: number
  created_at: string
  affiliate_offers: {
    product_name: string
    commission_pct: number
    category: string | null
  } | null
}

interface InfluencerProfile {
  platform_handle: string | null
  bio: string | null
  social_networks: { platform: string; url: string; followers: number; engagement_rate: number }[]
  balance_pending_cents: number
  balance_available_cents: number
  total_earned_cents: number
  stripe_onboarding_done: boolean
}

type Tab = 'offers' | 'links' | 'profile'

export default function InfluencerPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('offers')
  const [offers, setOffers] = useState<Offer[]>([])
  const [links, setLinks] = useState<LinkStat[]>([])
  const [profile, setProfile] = useState<InfluencerProfile | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: inf } = await supabase
        .from('influencer_profiles')
        .select('platform_handle, bio, social_networks, balance_pending_cents, balance_available_cents, total_earned_cents, stripe_onboarding_done')
        .eq('id', user.id)
        .single()

      if (inf) {
        setHasProfile(true)
        setProfile(inf as InfluencerProfile)
      } else {
        setHasProfile(false)
      }

      setLoading(false)
    }
    init()
  }, [router, supabase])

  useEffect(() => {
    if (tab === 'offers' && offers.length === 0) {
      fetch('/api/affiliate/offers')
        .then(r => r.json())
        .then(data => Array.isArray(data) && setOffers(data))
    }
    if (tab === 'links' && links.length === 0) {
      fetch('/api/affiliate/links')
        .then(r => r.json())
        .then(data => Array.isArray(data) && setLinks(data))
    }
  }, [tab, offers.length, links.length])

  async function createProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('influencer_profiles').insert({ id: user.id })
    setHasProfile(true)
    setProfile({
      platform_handle: null,
      bio: null,
      social_networks: [],
      balance_pending_cents: 0,
      balance_available_cents: 0,
      total_earned_cents: 0,
      stripe_onboarding_done: false,
    })
  }

  async function getLink(offerId: string) {
    setGeneratingFor(offerId)
    const res = await fetch('/api/affiliate/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId }),
    })
    const { url, code, error } = await res.json()
    setGeneratingFor(null)
    if (error) { alert(error); return }
    await navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
    // Refresh links tab
    fetch('/api/affiliate/links').then(r => r.json()).then(data => Array.isArray(data) && setLinks(data))
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${APP_URL}/go/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Espace Influenceur</h1>
            <p className="text-sm text-gray-500 mt-1">
              Choisissez des offres, partagez vos liens uniques, percevez vos commissions.
            </p>
          </div>
          {profile && (
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Solde disponible</div>
              <div className="text-xl font-bold text-[#C9A84C]">
                {((profile.balance_available_cents) / 100).toFixed(2)} €
              </div>
            </div>
          )}
        </div>

        {/* Onboarding si pas de profil */}
        {!hasProfile && (
          <div className="border border-[#C9A84C]/30 bg-[#C9A84C]/5 rounded-2xl p-8 text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">Créez votre profil influenceur</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Accédez aux offres d'affiliation, générez vos liens trackés et percevez vos commissions automatiquement.
              L'accès est gratuit — la plateforme conserve 30 % des commissions générées.
            </p>
            <button
              onClick={createProfile}
              className="px-6 py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors">
              Créer mon profil influenceur
            </button>
          </div>
        )}

        {hasProfile && (
          <>
            {/* Onglets */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-6 w-fit">
              {([
                { id: 'offers',  label: 'Offres disponibles' },
                { id: 'links',   label: 'Mes liens' },
                { id: 'profile', label: 'Mon profil' },
              ] as { id: Tab; label: string }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-[#C9A84C] text-[#07090F]'
                      : 'text-gray-400 hover:text-white'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Offres ── */}
            {tab === 'offers' && (
              <div className="space-y-4">
                {offers.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-10">
                    Aucune offre disponible pour le moment.
                  </p>
                )}
                {offers.map(offer => (
                  <div key={offer.id}
                    className="border border-white/10 bg-[#0D1117] rounded-2xl p-5 flex items-start gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{offer.product_name}</span>
                        {offer.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                            {offer.category}
                          </span>
                        )}
                      </div>
                      {offer.product_description && (
                        <p className="text-sm text-gray-400 mb-2">{offer.product_description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="text-[#C9A84C] font-semibold">
                          {offer.commission_pct} % de commission
                        </span>
                        {offer.target_geos.length > 0 && (
                          <span>Géos : {offer.target_geos.join(', ')}</span>
                        )}
                        {offer.product_url && (
                          <a href={offer.product_url} target="_blank" rel="noopener noreferrer"
                            className="hover:text-white underline underline-offset-2">
                            Voir le produit ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => getLink(offer.id)}
                      disabled={generatingFor === offer.id}
                      className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50">
                      {generatingFor === offer.id
                        ? 'Génération…'
                        : copiedCode
                        ? '✓ Copié !'
                        : 'Obtenir mon lien'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Mes liens ── */}
            {tab === 'links' && (
              <div className="space-y-4">
                {links.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-10">
                    Aucun lien actif. Obtenez votre premier lien dans l'onglet Offres.
                  </p>
                )}
                {links.map(link => (
                  <div key={link.id}
                    className="border border-white/10 bg-[#0D1117] rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium text-white text-sm">
                          {link.affiliate_offers?.product_name ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 font-mono">
                          {APP_URL}/go/{link.unique_code}
                        </div>
                      </div>
                      <button
                        onClick={() => copyLink(link.unique_code)}
                        className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-colors">
                        {copiedCode === link.unique_code ? '✓ Copié' : 'Copier'}
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span><span className="text-white font-semibold">{link.clicks}</span> clics</span>
                      <span><span className="text-white font-semibold">{link.conversions}</span> conversions</span>
                      <span>
                        <span className="text-[#C9A84C] font-semibold">
                          {(link.total_earned_cents / 100).toFixed(2)} €
                        </span> gagnés
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Profil ── */}
            {tab === 'profile' && profile && (
              <div className="space-y-5">
                {/* Soldes */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'En attente', value: profile.balance_pending_cents, color: '#F59E0B' },
                    { label: 'Disponible', value: profile.balance_available_cents, color: '#10B981' },
                    { label: 'Total gagné', value: profile.total_earned_cents, color: '#C9A84C' },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0D1117] border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-lg font-bold" style={{ color: s.color }}>
                        {(s.value / 100).toFixed(2)} €
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Stripe Connect */}
                {!profile.stripe_onboarding_done && (
                  <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-5">
                    <div className="font-semibold text-white text-sm mb-1">
                      Configurez vos virements
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Connectez votre IBAN via Stripe pour recevoir vos commissions automatiquement.
                    </p>
                    <button className="px-4 py-2 text-sm font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors">
                      Configurer les virements →
                    </button>
                  </div>
                )}

                {/* Réseaux sociaux */}
                <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-4">Réseaux sociaux</h3>
                  {profile.social_networks.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      Ajoutez vos réseaux pour que les vendeurs puissent évaluer votre audience.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {profile.social_networks.map((sn, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-gray-400 w-24">{sn.platform}</span>
                          <a href={sn.url} target="_blank" rel="noopener noreferrer"
                            className="text-[#C9A84C] hover:underline">{sn.url}</a>
                          <span className="text-gray-500 ml-auto">
                            {sn.followers?.toLocaleString()} abonnés
                            {sn.engagement_rate ? ` · ${sn.engagement_rate}%` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="mt-4 text-xs text-[#C9A84C] hover:underline">
                    + Ajouter un réseau social
                  </button>
                </div>

                <CreditCounter />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
