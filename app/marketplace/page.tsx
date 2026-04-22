'use client'

/**
 * /marketplace — dashboard marketplace B2B
 *
 * Accueil de la Phase 2 FTG : liste publique des volumes producteurs ouverts
 * + liste publique des demandes acheteurs ouvertes + (si loggué) mes matches.
 * Les CTA pointent vers `/marketplace/new?kind=volume|demand`.
 */

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

type Volume = {
  id: string
  country_iso: string
  product_slug: string
  product_label: string | null
  quantity_kg: number
  quality_grade: string | null
  certifications: string[] | null
  floor_price_eur_per_kg: number | null
  incoterm: string | null
  available_from: string | null
  available_until: string | null
}

type Demand = {
  id: string
  product_slug: string
  product_label: string | null
  quantity_kg_min: number
  quantity_kg_max: number | null
  quality_grade: string | null
  required_certifications: string[] | null
  ceiling_price_eur_per_kg: number | null
  incoterm: string | null
  delivery_country_iso: string | null
  deadline: string | null
}

type MyMatch = {
  id: string
  match_score: number
  proposed_quantity_kg: number
  proposed_price_eur_per_kg: number
  proposed_total_eur: number
  commission_amount_eur: number
  status: string
  volume_id: string
  demand_id: string
  created_at: string
  // Joined fields (production_volumes.producer_id + buyer_demands.buyer_id)
  // to auto-detect the user's role in this match.
  producer_id?: string | null
  buyer_id?: string | null
}

const STATUS_KEY: Record<string, string> = {
  proposed: 'marketplace_page.status.proposed',
  accepted_producer: 'marketplace_page.status.accepted_producer',
  accepted_buyer: 'marketplace_page.status.accepted_buyer',
  confirmed: 'marketplace_page.status.confirmed',
  rejected: 'marketplace_page.status.rejected',
  expired: 'marketplace_page.status.expired',
}
const STATUS_COLOR: Record<string, string> = {
  proposed: 'bg-white/5 border-white/10 text-gray-300',
  accepted_producer: 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]',
  accepted_buyer: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  confirmed: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  rejected: 'bg-red-500/10 border-red-500/30 text-red-400',
  expired: 'bg-white/5 border-white/10 text-gray-500',
}

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M €'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k €'
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
}
function fmtKg(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000) return (v / 1000).toFixed(1) + ' t'
  return v.toLocaleString('fr-FR') + ' kg'
}

function MarketplaceInner() {
  const { t } = useLang()
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [demands, setDemands] = useState<Demand[]>([])
  const [myMatches, setMyMatches] = useState<MyMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  async function reloadMatches() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id ?? null
    if (!uid) { setMyMatches([]); return }
    const { data } = await supabase
      .from('marketplace_matches')
      .select('id, match_score, proposed_quantity_kg, proposed_price_eur_per_kg, proposed_total_eur, commission_amount_eur, status, volume_id, demand_id, created_at, production_volumes!inner(producer_id), buyer_demands!inner(buyer_id)')
      .order('match_score', { ascending: false })
      .limit(20)
    // Flatten the nested producer_id / buyer_id from the joined rows.
    // Supabase returns the relation as an object (single row due to FK single-to-one).
    const flat = (data ?? []).map((r: Record<string, unknown>) => {
      const pv = r['production_volumes'] as { producer_id?: string } | null | undefined
      const bd = r['buyer_demands']      as { buyer_id?: string }    | null | undefined
      const rr = { ...r, producer_id: pv?.producer_id ?? null, buyer_id: bd?.buyer_id ?? null } as unknown as MyMatch
      delete (rr as Record<string, unknown>)['production_volumes']
      delete (rr as Record<string, unknown>)['buyer_demands']
      return rr
    })
    setMyMatches(flat)
  }

  async function handleAccept(matchId: string, role: 'producer' | 'buyer') {
    if (acceptingId) return
    setAcceptingId(matchId)
    setFlash(null)
    try {
      const { error } = await supabase.rpc('accept_match', { p_match_id: matchId, p_role: role })
      if (error) {
        setFlash(`Erreur : ${error.message}`)
      } else {
        setFlash('✅ Acceptation enregistrée.')
        await reloadMatches()
        // Si le match vient de passer confirmed, déclenche les emails des 2 parties (idempotent côté serveur).
        try {
          await fetch(`/api/marketplace/${matchId}/notify-confirmed`, { method: 'POST' })
        } catch { /* silent — email secondaire */ }
      }
    } finally {
      setAcceptingId(null)
      setTimeout(() => setFlash(null), 4000)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (cancelled) return
      const uid = userData?.user?.id ?? null
      const isLogged = !!uid
      setLoggedIn(isLogged)
      setUserId(uid)

      const [volRes, demRes, matchRes] = await Promise.all([
        supabase
          .from('production_volumes')
          .select('id, country_iso, product_slug, product_label, quantity_kg, quality_grade, certifications, floor_price_eur_per_kg, incoterm, available_from, available_until')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('buyer_demands')
          .select('id, product_slug, product_label, quantity_kg_min, quantity_kg_max, quality_grade, required_certifications, ceiling_price_eur_per_kg, incoterm, delivery_country_iso, deadline')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(50),
        isLogged
          ? supabase
              .from('marketplace_matches')
              .select('id, match_score, proposed_quantity_kg, proposed_price_eur_per_kg, proposed_total_eur, commission_amount_eur, status, volume_id, demand_id, created_at, production_volumes!inner(producer_id), buyer_demands!inner(buyer_id)')
              .order('match_score', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      ])
      if (cancelled) return
      setVolumes((volRes.data as Volume[] | null) ?? [])
      setDemands((demRes.data as Demand[] | null) ?? [])
      // Flatten joined rows (same as reloadMatches).
      const rawMatches = (matchRes.data ?? []) as Array<Record<string, unknown>>
      const flat = rawMatches.map((r) => {
        const pv = r['production_volumes'] as { producer_id?: string } | null | undefined
        const bd = r['buyer_demands']      as { buyer_id?: string }    | null | undefined
        const rr = { ...r, producer_id: pv?.producer_id ?? null, buyer_id: bd?.buyer_id ?? null } as unknown as MyMatch
        delete (rr as Record<string, unknown>)['production_volumes']
        delete (rr as Record<string, unknown>)['buyer_demands']
        return rr
      })
      setMyMatches(flat)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-[#C9A84C]">{t('marketplace_page.hero_badge')}</div>
          <h1 className="text-3xl md:text-4xl font-bold">
            {t('marketplace_page.hero_title')}
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl">
            {t('marketplace_page.hero_pitch')}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/marketplace/new?kind=volume"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors"
            >
              {t('marketplace_page.cta_declare_volume')}
            </Link>
            <Link
              href="/marketplace/new?kind=demand"
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm rounded-xl hover:bg-emerald-500/25 transition-colors"
            >
              {t('marketplace_page.cta_post_demand')}
            </Link>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {flash && (
          <div className={`p-3 rounded-lg text-sm border ${flash.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {flash}
          </div>
        )}

        {!loading && loggedIn && myMatches.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🎯</span> {t('marketplace_page.my_matches')} ({myMatches.length})
            </h2>
            <div className="space-y-2">
              {myMatches.map((m) => {
                const isProducer = userId != null && m.producer_id === userId
                const isBuyer    = userId != null && m.buyer_id === userId
                const alreadyAcceptedAsMe =
                  (isProducer && (m.status === 'accepted_producer' || m.status === 'confirmed')) ||
                  (isBuyer    && (m.status === 'accepted_buyer'    || m.status === 'confirmed'))
                const canAccept = !alreadyAcceptedAsMe && (m.status === 'proposed' || m.status === 'accepted_producer' || m.status === 'accepted_buyer')
                const role: 'producer' | 'buyer' | null = isProducer ? 'producer' : isBuyer ? 'buyer' : null
                return (
                  <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-[#0D1117] border border-[#C9A84C]/20 rounded-xl flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-[#C9A84C]">{m.match_score}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {fmtKg(m.proposed_quantity_kg)} @ {fmtEur(m.proposed_price_eur_per_kg)} / kg
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Total&nbsp;{fmtEur(m.proposed_total_eur)} · Commission&nbsp;{fmtEur(m.commission_amount_eur)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${STATUS_COLOR[m.status] ?? 'bg-white/5 border-white/10 text-gray-400'}`}>
                        {STATUS_KEY[m.status] ? t(STATUS_KEY[m.status]) : m.status}
                      </span>
                      {canAccept && role && (
                        <button
                          onClick={() => handleAccept(m.id, role)}
                          disabled={acceptingId === m.id}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            role === 'producer'
                              ? 'bg-[#C9A84C] text-[#07090F] hover:bg-[#E8C97A]'
                              : 'bg-emerald-500 text-[#07090F] hover:bg-emerald-400'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {acceptingId === m.id ? '...' : t(role === 'producer' ? 'marketplace_page.accept_as_producer' : 'marketplace_page.accept_as_buyer')}
                        </button>
                      )}
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString('fr-FR')}
                      </span>
                      <Link
                        href={`/marketplace/${m.id}`}
                        className="text-[11px] text-[#C9A84C] hover:text-[#E8C97A] underline underline-offset-2 whitespace-nowrap"
                      >
                        Détails →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Volumes ouverts */}
        {!loading && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🌾</span> {t('marketplace_page.volumes_section')} ({volumes.length})
              </h2>
              <Link href="/marketplace/new?kind=volume" className="text-xs text-[#C9A84C] hover:underline">
                {t('marketplace_page.add_volume')}
              </Link>
            </div>
            {volumes.length === 0 ? (
              <div className="p-8 bg-white/[.02] border border-white/5 rounded-xl text-center">
                <p className="text-sm text-gray-400">{t('marketplace_page.volumes_empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {volumes.map((v) => (
                  <div key={v.id} className="p-4 bg-[#0D1117] border border-white/10 rounded-xl hover:border-[#C9A84C]/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {v.product_label ?? v.product_slug} · {v.country_iso}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {v.quality_grade ?? 'standard'}{v.incoterm ? ` · ${v.incoterm}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-[#C9A84C]">{fmtKg(v.quantity_kg)}</div>
                        {v.floor_price_eur_per_kg != null && (
                          <div className="text-[11px] text-gray-400">{fmtEur(v.floor_price_eur_per_kg)}/kg min</div>
                        )}
                      </div>
                    </div>
                    {(v.certifications?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.certifications!.slice(0, 4).map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-300">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Demandes acheteurs */}
        {!loading && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🛒</span> {t('marketplace_page.demands_section')} ({demands.length})
              </h2>
              <Link href="/marketplace/new?kind=demand" className="text-xs text-emerald-300 hover:underline">
                {t('marketplace_page.post_demand_short')}
              </Link>
            </div>
            {demands.length === 0 ? (
              <div className="p-8 bg-white/[.02] border border-white/5 rounded-xl text-center">
                <p className="text-sm text-gray-400">{t('marketplace_page.demands_empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {demands.map((d) => (
                  <div key={d.id} className="p-4 bg-[#0D1117] border border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {d.product_label ?? d.product_slug}
                          {d.delivery_country_iso ? ` → ${d.delivery_country_iso}` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {d.quality_grade ?? 'standard'}{d.incoterm ? ` · ${d.incoterm}` : ''}
                          {d.deadline ? ` · échéance ${new Date(d.deadline).toLocaleDateString('fr-FR')}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-300">
                          {fmtKg(d.quantity_kg_min)}
                          {d.quantity_kg_max ? ` – ${fmtKg(d.quantity_kg_max)}` : '+'}
                        </div>
                        {d.ceiling_price_eur_per_kg != null && (
                          <div className="text-[11px] text-gray-400">{fmtEur(d.ceiling_price_eur_per_kg)}/kg max</div>
                        )}
                      </div>
                    </div>
                    {(d.required_certifications?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {d.required_certifications!.slice(0, 4).map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-300">
                            {c} requis
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="p-5 rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5">
          <p className="text-sm text-[#C9A84C] font-semibold mb-1">{t('marketplace_page.how_it_works')}</p>
          <p className="text-sm text-gray-300 leading-relaxed">
            1. Producteur déclare son volume (pays, produit, qualité, certifs, prix plancher). 2. Acheteur publie sa demande (qty, qualité, ceiling). 3. L'agent matcher IA scanne toutes les paires, score 0-100, garde les matches pertinents (≥ 65). 4. Les 2 parties acceptent → escrow Stripe Connect → commission 2,5 % retenue → livraison → libération du paiement.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>}>
      <MarketplaceInner />
    </Suspense>
  )
}
