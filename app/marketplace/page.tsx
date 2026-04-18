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
import Topbar from '@/components/Topbar'
import { supabase } from '@/lib/supabase'

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
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [demands, setDemands] = useState<Demand[]>([])
  const [myMatches, setMyMatches] = useState<MyMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (cancelled) return
      const isLogged = !!userData?.user
      setLoggedIn(isLogged)

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
              .select('id, match_score, proposed_quantity_kg, proposed_price_eur_per_kg, proposed_total_eur, commission_amount_eur, status, volume_id, demand_id, created_at')
              .order('match_score', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as MyMatch[] }),
      ])
      if (cancelled) return
      setVolumes((volRes.data as Volume[] | null) ?? [])
      setDemands((demRes.data as Demand[] | null) ?? [])
      setMyMatches((matchRes.data as MyMatch[] | null) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-[#C9A84C]">🌍 Marketplace B2B · Phase 2</div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Vends ta production. Trouve ton acheteur. Au prix du marché.
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl">
            Déclare tes volumes ou publie ta demande — l'IA croise les signaux
            (qualité, certifications, prix, incoterm, délais) et propose les
            meilleures paires. Commission plateforme&nbsp;: 2,5&nbsp;% du GMV matché.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/marketplace/new?kind=volume"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors"
            >
              🌾 Déclarer un volume
            </Link>
            <Link
              href="/marketplace/new?kind=demand"
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm rounded-xl hover:bg-emerald-500/25 transition-colors"
            >
              🛒 Publier une demande
            </Link>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && loggedIn && myMatches.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🎯</span> Mes matches ({myMatches.length})
            </h2>
            <div className="space-y-2">
              {myMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-[#0D1117] border border-[#C9A84C]/20 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#C9A84C]">{m.match_score}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {fmtKg(m.proposed_quantity_kg)} @ {fmtEur(m.proposed_price_eur_per_kg)} / kg
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Total&nbsp;{fmtEur(m.proposed_total_eur)} · Commission&nbsp;{fmtEur(m.commission_amount_eur)} · Statut&nbsp;{m.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Volumes ouverts */}
        {!loading && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🌾</span> Volumes producteurs ouverts ({volumes.length})
              </h2>
              <Link href="/marketplace/new?kind=volume" className="text-xs text-[#C9A84C] hover:underline">
                + Ajouter un volume
              </Link>
            </div>
            {volumes.length === 0 ? (
              <div className="p-8 bg-white/[.02] border border-white/5 rounded-xl text-center">
                <p className="text-sm text-gray-400">Aucun volume ouvert pour l'instant. Sois le premier à déclarer.</p>
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
                <span>🛒</span> Demandes acheteurs ouvertes ({demands.length})
              </h2>
              <Link href="/marketplace/new?kind=demand" className="text-xs text-emerald-300 hover:underline">
                + Publier une demande
              </Link>
            </div>
            {demands.length === 0 ? (
              <div className="p-8 bg-white/[.02] border border-white/5 rounded-xl text-center">
                <p className="text-sm text-gray-400">Aucune demande ouverte pour l'instant.</p>
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
          <p className="text-sm text-[#C9A84C] font-semibold mb-1">Comment ça marche</p>
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
