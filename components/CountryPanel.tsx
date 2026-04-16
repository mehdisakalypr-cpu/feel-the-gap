'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CountryMapData } from '@/types/database'
import { useLang } from '@/components/LanguageProvider'

interface Props {
  country: CountryMapData
  onClose: () => void
}

const CATEGORY_ICONS: Record<string, string> = {
  agriculture: '🌾', energy: '⚡', materials: '🪨',
  manufactured: '🏭', resources: '💧',
}

function fmtUsd(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(1) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(1) + 'M'
  return sign + '$' + abs.toLocaleString()
}

// Placeholder opportunities — fetched from API once Supabase is populated
const DEMO_OPPORTUNITIES = [
  {
    product: 'Onions & Shallots', score: 91, market_value: '$48M/yr',
    volume: '38,000 t/yr', avg_price: '$1,260/t',
    plans: {
      trade:      { label: 'Import & Distribute', margin: '28%', capex: '$180K', time: '3 months' },
      production: { label: 'Local Farm Unit',     margin: '61%', capex: '$1.2M', time: '18 months' },
      training:   { label: 'Franchise to Locals', margin: '12%', capex: '$80K',  time: '6 months' },
    },
  },
  {
    product: 'Wheat Flour', score: 85, market_value: '$120M/yr',
    volume: '1.2M t/yr', avg_price: '$320/t',
    plans: {
      trade:      { label: 'Bulk Import & Mill', margin: '22%', capex: '$4.2M', time: '6 months' },
      production: { label: 'Local Mill',          margin: '44%', capex: '$8.5M', time: '24 months' },
      training:   { label: 'Co-op Model',         margin: '8%',  capex: '$500K', time: '12 months' },
    },
  },
  {
    product: 'Crude Sunflower Oil', score: 74, market_value: '$31M/yr',
    volume: '28,000 t/yr', avg_price: '$1,100/t',
    plans: {
      trade:      { label: 'FOB Trading',         margin: '38%', capex: '$220K', time: '2 months' },
      production: { label: 'Sunflower Plantation', margin: '55%', capex: '$3.8M', time: '20 months' },
      training:   { label: 'Farmer Network',       margin: '15%', capex: '$300K', time: '9 months' },
    },
  },
]

type PlanKey = 'trade' | 'production' | 'training'

const PLAN_META: Record<PlanKey, { icon: string; color: string; label: string; label_fr: string }> = {
  trade:      { icon: '🚢', color: '#60A5FA', label: 'Import & Sell',    label_fr: 'Import & Revente' },
  production: { icon: '🏭', color: '#22C55E', label: 'Produce Locally',  label_fr: 'Production locale' },
  training:   { icon: '🤝', color: '#C9A84C', label: 'Train Locals',     label_fr: 'Former localement' },
}


// ── Main panel ───────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, Record<string, string>> = {
  overview:      { en: 'Overview',      fr: 'Aperçu' },
  opportunities: { en: 'Opportunities', fr: 'Opportunités' },
  example:       { en: 'Examples',      fr: 'Exemple' },
}

export default function CountryPanel({ country, onClose }: Props) {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [tab, setTab] = useState<'overview' | 'opportunities' | 'example'>('overview')
  const balance = country.trade_balance_usd ?? 0
  const balancePositive = balance >= 0
  const oppCount = country.opportunity_count ?? 0

  return (
    <div className="fixed md:absolute inset-0 md:inset-auto md:top-0 md:right-0 md:h-full w-full md:max-w-96 bg-[#0D1117] md:border-l border-[rgba(201,168,76,.15)] flex flex-col z-[1100] shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(201,168,76,.1)]">
        <span className="text-3xl">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white text-base truncate">{country.name_fr}</h2>
          <p className="text-xs text-gray-500">{country.region}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(201,168,76,.1)]">
        {(['overview', 'opportunities', 'example'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative inline-flex items-center justify-center gap-2 ${
              tab === t
                ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {TAB_LABELS[t][lang]}
            {t === 'opportunities' && oppCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-[0_0_12px_rgba(52,211,153,.55)] animate-[oppPulse_1.4s_ease-in-out_infinite]"
                aria-label={`${oppCount} opportunités`}
              >
                {oppCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <style jsx global>{`
        @keyframes oppPulse {
          0%, 100% { transform: scale(1);   box-shadow: 0 0 10px rgba(52,211,153,.5); }
          50%      { transform: scale(1.18); box-shadow: 0 0 18px rgba(52,211,153,.85); }
        }
      `}</style>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'overview' && (
          <>
            {/* Trade balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fr ? 'Importations' : 'Imports'}</p>
                <p className="text-lg font-bold text-red-400">{fmtUsd(country.total_imports_usd)}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fr ? 'Exportations' : 'Exports'}</p>
                <p className="text-lg font-bold text-green-400">{fmtUsd(country.total_exports_usd)}</p>
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{fr ? 'Balance commerciale' : 'Trade Balance'}</span>
                <span className={`text-sm font-bold ${balancePositive ? 'text-green-400' : 'text-red-400'}`}>
                  {balancePositive ? '+' : ''}{fmtUsd(balance)}
                </span>
              </div>
              {/* Balance bar */}
              <div className="mt-2 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${balancePositive ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(balance) / (Math.max(country.total_imports_usd ?? 1, country.total_exports_usd ?? 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Top category + opportunity score fusionnés */}
            {country.top_import_category && (
              <div className="bg-[#111827] rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{CATEGORY_ICONS[country.top_import_category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{fr ? 'Catégorie principale' : 'Top Import Category'}</p>
                  <p className="text-sm font-medium text-white capitalize mt-0.5 truncate">{country.top_import_category}</p>
                </div>
                {country.top_opportunity_score != null && (
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-[#C9A84C] uppercase tracking-wider">{fr ? 'Score' : 'Score'}</p>
                    <p className="text-base font-bold text-[#C9A84C] leading-none mt-0.5">{country.top_opportunity_score}<span className="text-[10px] text-[#C9A84C]/60">/100</span></p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'opportunities' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300 font-medium">
              {fr
                ? 'Les opportunités de ce pays vous intéressent, cliquez sur :'
                : 'Interested in this country\'s opportunities? Click:'}
            </p>
            {[
              { n: 1, label: fr ? 'Découvrez les' : 'Discover', cta: fr ? 'Fiche pays' : 'Country profile', href: `/country/${country.iso}` },
              { n: 2, label: fr ? 'Obtenez leur analyse détaillée' : 'Get detailed analysis', cta: fr ? 'Rapport complet' : 'Full report', href: `/reports/${country.iso}` },
              { n: 3, label: fr ? 'Réalisez vos' : 'Build your', cta: fr ? 'Business plan' : 'Business plan', href: `/country/${country.iso}/plan` },
              { n: 4, label: fr ? 'Accédez aux ressources de' : 'Access resources from', cta: fr ? 'Formation' : 'Training', href: `/formation?country=${country.iso}` },
              { n: 5, label: fr ? 'Bénéficiez de fichiers' : 'Get leads files', cta: fr ? 'Clients' : 'Clients', href: `/leads?country=${country.iso}`, note: fr ? 'business plan préalable' : 'business plan required' },
              { n: 6, label: fr ? 'Optionnel :' : 'Optional:', cta: fr ? 'Boutique e-commerce clé en main' : 'Turnkey e-commerce store', href: `/shop/create?country=${country.iso}`, optional: true },
            ].map(item => (
              <Link
                key={item.n}
                href={item.href}
                target="_blank"
                className="group flex items-center gap-3 bg-[#111827] border border-white/5 rounded-xl p-3 hover:border-[#C9A84C]/40 transition-colors"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-bold shrink-0">
                  {item.n}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.optional ? 'text-[#34D399]' : 'text-white'} group-hover:text-[#C9A84C] transition-colors`}>
                    {item.cta}
                  </p>
                  {item.note && <p className="text-[10px] text-gray-500 italic mt-0.5">⓵ {item.note}</p>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 group-hover:text-[#C9A84C] shrink-0">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
            ))}
          </div>
        )}

        {tab === 'example' && (
          <>
            <p className="text-xs text-gray-500">
              {fr ? '3 exemples de gaps de marché identifiés par l\'IA sur ce pays.' : '3 example market gaps identified by AI for this country.'}
            </p>
            {DEMO_OPPORTUNITIES.map((opp, i) => (
              <OpportunityCard key={i} opp={opp} />
            ))}
            <Link
              href={`/reports/${country.iso}`}
              target="_blank"
              className="block w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors text-center mt-2"
            >
              📊 {fr ? 'Rapport complet des opportunités' : 'Full opportunities report'}
            </Link>
          </>
        )}
      </div>

      {/* Footer CTA — Rapport complet des opportunités (pleine largeur) */}
      <div className="p-4 border-t border-[rgba(201,168,76,.1)]">
        <Link
          href={`/reports/${country.iso}`}
          target="_blank"
          className="block w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors text-center"
        >
          📊 {fr ? 'Rapport complet des opportunités' : 'Full opportunities report'}
        </Link>
      </div>
    </div>
  )
}

// ── Opportunity card with 3-plan selector ────────────────────────────────────

type OppData = typeof DEMO_OPPORTUNITIES[0]

function OpportunityCard({ opp }: { opp: OppData }) {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [plan, setPlan] = useState<PlanKey>('trade')
  const selected = opp.plans[plan]
  const meta = PLAN_META[plan]

  return (
    <div className="bg-[#111827] rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{opp.product}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{opp.volume} · {fr ? 'moy.' : 'avg'} {opp.avg_price}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[#C9A84C] font-bold text-sm">{opp.market_value}</div>
          <div className="text-[10px] text-gray-500">{fr ? 'marché/an' : 'market/year'}</div>
        </div>
      </div>

      {/* Plan tabs */}
      <div className="flex gap-1">
        {(Object.keys(PLAN_META) as PlanKey[]).map(k => (
          <button
            key={k}
            onClick={() => setPlan(k)}
            className="flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all"
            style={plan === k
              ? { background: PLAN_META[k].color + '22', color: PLAN_META[k].color, border: `1px solid ${PLAN_META[k].color}44` }
              : { background: 'transparent', color: '#6B7280', border: '1px solid #1F2937' }}
          >
            {PLAN_META[k].icon} {fr ? PLAN_META[k].label_fr : PLAN_META[k].label}
          </button>
        ))}
      </div>

      {/* Selected plan summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: fr ? 'Stratégie' : 'Strategy', value: selected.label },
          { label: 'Capex',    value: selected.capex },
          { label: fr ? 'Marge' : 'Margin',   value: selected.margin },
        ].map(item => (
          <div key={item.label} className="bg-[#1F2937] rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">{item.label}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>⏱ {fr ? 'Délai' : 'Time to market'}: <strong className="text-gray-300">{selected.time}</strong></span>
        <span className="text-[#C9A84C] font-medium cursor-pointer hover:underline">{fr ? 'Plan complet →' : 'Full plan →'}</span>
      </div>
    </div>
  )
}
