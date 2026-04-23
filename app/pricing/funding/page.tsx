'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  INVESTOR_TIER_QUOTA,
  INVESTOR_TIER_PRICE_EUR,
  INVESTOR_TIER_LABEL,
  INVESTOR_TIER_TAGLINE,
  INVESTOR_DURATIONS,
  EXTRA_CREDIT_PACKS,
  computeEffectiveMonthly,
  type InvestorTierKey,
  type InvestorRoleKind,
  type DurationMonths,
} from '@/lib/funding/investor-tiers'

type MarketplaceState = {
  phase: string
  founding_pioneer_limit: number
  founding_pioneer_used: number
  founding_pioneer_discount_pct: number
}

type GeoInfo = {
  country: string
  countryName: string
  multiplier: number
}

const ROLE_ACCENT: Record<InvestorRoleKind, { color: string; bg: string; label: string; emoji: string }> = {
  financeur:    { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  label: 'Financeur (dette)',    emoji: '🏦' },
  investisseur: { color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', label: 'Investisseur (equity)', emoji: '📈' },
}

function FundingPricingContent() {
  const params = useSearchParams()
  const roleParam = params.get('role') as InvestorRoleKind | null
  const [role, setRole] = useState<InvestorRoleKind>(roleParam === 'financeur' ? 'financeur' : 'investisseur')
  const [duration, setDuration] = useState<DurationMonths>(1)
  const [state, setState] = useState<MarketplaceState | null>(null)
  const [geo, setGeo] = useState<GeoInfo | null>(null)

  useEffect(() => {
    fetch('/api/funding/marketplace/state').then(r => r.json()).then(j => {
      if (!j.error) setState(j)
    }).catch(() => {})
    fetch('/api/geo').then(r => (r.ok ? r.json() : null)).then((g) => {
      if (g) setGeo({ country: g.country, countryName: g.countryName, multiplier: g.multiplier })
    }).catch(() => {})
  }, [])

  const pioneerSeatsLeft = state
    ? Math.max(0, state.founding_pioneer_limit - state.founding_pioneer_used)
    : 0
  const foundingPioneer = pioneerSeatsLeft > 0
  const geoMultiplier = geo?.multiplier ?? 1
  const accent = ROLE_ACCENT[role]

  const tiers: InvestorTierKey[] = ['explorer', 'active', 'pro']

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <main className="max-w-6xl mx-auto px-4 py-12">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: accent.bg, border: `1px solid ${accent.color}40`, color: accent.color }}>
            {accent.emoji} {accent.label}
          </div>
          <h1 className="text-4xl font-semibold mb-3">Tarification marketplace de financement</h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Explorer — 5 acceptations/mois. Active — 10. Pro — 20. Les 50 premiers comptes bénéficient
            d'un rabais <span className="text-[#C9A84C] font-bold">-30% à vie</span> (Founding Pioneers).
          </p>
        </header>

        {/* Role toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            {(['financeur', 'investisseur'] as const).map((r) => {
              const a = ROLE_ACCENT[r]
              const selected = role === r
              return (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                    selected ? 'text-black' : 'text-white/70'
                  }`}
                  style={selected ? { background: a.color } : undefined}
                >
                  {a.emoji} {a.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Duration toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 flex-wrap">
            {INVESTOR_DURATIONS.map(d => (
              <button
                key={d.months}
                onClick={() => setDuration(d.months)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                  duration === d.months ? 'bg-[#C9A84C] text-black' : 'text-white/70 hover:text-white'
                }`}
              >{d.label}</button>
            ))}
          </div>
        </div>

        {geo && geo.multiplier !== 1 && (
          <div className="text-center mb-6 text-xs text-white/70">
            Prix ajustés pour {geo.countryName}{' '}
            <span className="text-white/40">(×{geo.multiplier.toFixed(2)} vs UE)</span>
          </div>
        )}

        {foundingPioneer && (
          <div className="mb-8 rounded-3xl p-5 text-center"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <div className="text-[#C9A84C] font-bold text-lg mb-1">
              👑 {pioneerSeatsLeft} places Founding Pioneer restantes
            </div>
            <div className="text-sm text-white/70">
              -{state?.founding_pioneer_discount_pct ?? 30}% à vie sur le tier choisi (y compris renouvellements)
            </div>
          </div>
        )}

        {/* Tier grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {tiers.map((tier) => {
            const pricing = computeEffectiveMonthly(tier, duration, foundingPioneer, geoMultiplier)
            const quota = INVESTOR_TIER_QUOTA[tier]
            const highlight = tier === 'active'
            const href = `/api/funding/investor/subscription/checkout?tier=${tier}&role=${role}&duration=${duration}${geo && geo.multiplier !== 1 ? `&cc=${geo.country}` : ''}`
            return (
              <div key={tier}
                className={`relative rounded-xl border p-6 flex flex-col ${
                  highlight ? 'bg-white/3 shadow-lg' : 'bg-white/3'
                }`}
                style={highlight
                  ? { borderColor: accent.color + '80', boxShadow: `0 10px 40px -15px ${accent.color}50` }
                  : { borderColor: 'rgba(255,255,255,0.1)' }}>
                {highlight && (
                  <span className="absolute -top-3 left-6 text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                    style={{ background: accent.color, color: '#07090F' }}>
                    Le plus choisi
                  </span>
                )}
                <div className="text-sm uppercase tracking-widest text-white/50 mb-1">{INVESTOR_TIER_LABEL[tier]}</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold">€{pricing.monthlyEffective}</span>
                  {pricing.monthlyBaseline !== pricing.monthlyEffective && (
                    <span className="text-sm text-white/40 line-through">€{pricing.monthlyBaseline}</span>
                  )}
                  <span className="text-sm text-white/50">/mois</span>
                </div>
                <div className="text-sm mb-1" style={{ color: accent.color }}>
                  {quota} acceptation{quota > 1 ? 's' : ''}/mois
                </div>
                {duration > 1 && (
                  <div className="text-xs text-[#C9A84C] mb-3">
                    = €{pricing.upfront} payés d'avance · économie €{pricing.savings}
                  </div>
                )}
                {foundingPioneer && duration === 1 && (
                  <div className="text-xs text-[#C9A84C] mb-3">👑 -30% à vie appliqué</div>
                )}
                <p className="text-sm text-white/70 mb-5">{INVESTOR_TIER_TAGLINE[tier]}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {[
                    `${quota} acceptations d'offre/mois`,
                    'Dossiers complets après signature (KYC, financials)',
                    'Pipeline de suivi des deals',
                    'Contre-proposition à valorisation différente' + (role === 'investisseur' ? '' : ' (N/A)'),
                    'Coordonnées entrepreneur après accord mutuel',
                    duration > 1 ? `Tarif bloqué ${duration} mois` : 'Facturation mensuelle, résiliable à tout moment',
                  ].filter(Boolean).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                      <span style={{ color: accent.color }}>✓</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href={href}
                  className="block w-full text-center py-3 rounded font-medium transition text-black"
                  style={{ background: accent.color }}>
                  Souscrire {INVESTOR_TIER_LABEL[tier]} →
                </a>
              </div>
            )
          })}
        </div>

        {/* Extra credit packs */}
        <section className="rounded-3xl p-6 mb-10"
          style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold mb-1">Acceptations supplémentaires (one-shot)</h2>
              <p className="text-sm text-white/60">
                Une fois votre quota mensuel consommé, achetez des crédits à l'acte. Valables 12 mois, cumulatifs.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {EXTRA_CREDIT_PACKS.map((p) => {
              const href = `/api/funding/investor/credits/checkout?pack=${p.kind}`
              const best = p.kind === 'pack10'
              return (
                <a key={p.kind} href={href}
                  className="relative rounded-xl border p-5 transition hover:bg-white/5"
                  style={{ borderColor: best ? accent.color + '60' : 'rgba(255,255,255,0.1)',
                           background: best ? accent.color + '10' : undefined }}>
                  {best && (
                    <span className="absolute -top-2 right-3 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: accent.color, color: '#07090F' }}>
                      Meilleur prix
                    </span>
                  )}
                  <div className="text-3xl font-bold">+{p.credits}</div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">acceptations</div>
                  <div className="text-2xl font-semibold mb-1">€{p.price_eur}</div>
                  <div className="text-xs text-white/50">€{p.unit_price_eur}/acceptation</div>
                </a>
              )
            })}
          </div>
        </section>

        <footer className="text-center text-sm text-white/50">
          Besoin d'un plan Enterprise / syndication ? <Link href="/contact" className="underline text-white/80">Parle-nous.</Link>
        </footer>
      </main>
    </div>
  )
}

export default function FundingPricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F]" />}>
      <FundingPricingContent />
    </Suspense>
  )
}
