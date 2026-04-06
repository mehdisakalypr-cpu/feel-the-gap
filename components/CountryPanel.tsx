'use client'

import { useState } from 'react'
import type { CountryMapData } from '@/types/database'

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

const PLAN_META: Record<PlanKey, { icon: string; color: string; label: string }> = {
  trade:      { icon: '🚢', color: '#60A5FA', label: 'Import & Sell' },
  production: { icon: '🏭', color: '#22C55E', label: 'Produce Locally' },
  training:   { icon: '🤝', color: '#C9A84C', label: 'Train Locals' },
}

export default function CountryPanel({ country, onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'opportunities' | 'reports'>('overview')
  const balance = country.trade_balance_usd ?? 0
  const balancePositive = balance >= 0

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-[#0D1117] border-l border-[rgba(201,168,76,.15)] flex flex-col z-[500] shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(201,168,76,.1)]">
        <span className="text-3xl">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white text-base truncate">{country.name_fr}</h2>
          <p className="text-xs text-gray-500">{country.region} · Data {country.data_year ?? '2023'}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(201,168,76,.1)]">
        {(['overview', 'opportunities', 'reports'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'overview' && (
          <>
            {/* Trade balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Imports</p>
                <p className="text-lg font-bold text-red-400">{fmtUsd(country.total_imports_usd)}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Exports</p>
                <p className="text-lg font-bold text-green-400">{fmtUsd(country.total_exports_usd)}</p>
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Trade Balance</span>
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

            {/* Top category */}
            {country.top_import_category && (
              <div className="bg-[#111827] rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{CATEGORY_ICONS[country.top_import_category]}</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Top Import Category</p>
                  <p className="text-sm font-medium text-white capitalize mt-0.5">{country.top_import_category}</p>
                </div>
              </div>
            )}

            {/* Opportunity score */}
            {country.top_opportunity_score && (
              <div className="bg-gradient-to-br from-[#C9A84C]/10 to-transparent border border-[rgba(201,168,76,.2)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[#C9A84C]">⚡ Opportunity Score</p>
                  <span className="text-lg font-bold text-[#C9A84C]">{country.top_opportunity_score}/100</span>
                </div>
                <div className="h-1.5 bg-[#1F2937] rounded-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]"
                    style={{ width: `${country.top_opportunity_score}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {country.opportunity_count} business opportunities identified
                </p>
              </div>
            )}
          </>
        )}

        {tab === 'opportunities' && (
          <>
            <p className="text-xs text-gray-500">Market gaps identified by AI — choose your entry strategy</p>
            {DEMO_OPPORTUNITIES.map((opp, i) => (
              <OpportunityCard key={i} opp={opp} />
            ))}

            {/* Paywall */}
            <div className="bg-[#111827] border border-[rgba(201,168,76,.2)] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1 font-medium">
                +{Math.max(0, country.opportunity_count - 3)} more opportunities
              </p>
              <p className="text-[10px] text-gray-500 mb-3">Full market values & detailed plans require Pro</p>
              <button className="px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold rounded-lg hover:bg-[#C9A84C]/20 transition-colors">
                Upgrade to Strategist — €99/mo
              </button>
            </div>
          </>
        )}

        {tab === 'reports' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Country intelligence reports</p>
            {[
              { title: `${country.name_fr} — Trade Overview 2023`, tier: 'free', updated: '2024-03-01' },
              { title: `Agriculture Gap Analysis — ${country.name_fr}`, tier: 'basic', updated: '2024-02-15' },
              { title: `Top 10 Import Opportunities Report`, tier: 'pro', updated: '2024-03-10' },
            ].map((r, i) => (
              <div key={i} className="bg-[#111827] rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{r.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Updated {r.updated}</p>
                </div>
                {r.tier === 'free' ? (
                  <button className="shrink-0 text-xs text-[#C9A84C] hover:underline">Read →</button>
                ) : (
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    r.tier === 'basic' ? 'bg-blue-500/15 text-blue-400' : 'bg-[#C9A84C]/15 text-[#C9A84C]'
                  }`}>
                    {r.tier === 'basic' ? 'Basic' : 'Pro'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="p-4 border-t border-[rgba(201,168,76,.1)]">
        <button className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-semibold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors">
          Get Full {country.name_fr} Report
        </button>
      </div>
    </div>
  )
}

// ── Opportunity card with 3-plan selector ────────────────────────────────────

type OppData = typeof DEMO_OPPORTUNITIES[0]

function OpportunityCard({ opp }: { opp: OppData }) {
  const [plan, setPlan] = useState<PlanKey>('trade')
  const selected = opp.plans[plan]
  const meta = PLAN_META[plan]

  return (
    <div className="bg-[#111827] rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{opp.product}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{opp.volume} · avg {opp.avg_price}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[#C9A84C] font-bold text-sm">{opp.market_value}</div>
          <div className="text-[10px] text-gray-500">market/year</div>
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
            {PLAN_META[k].icon} {PLAN_META[k].label}
          </button>
        ))}
      </div>

      {/* Selected plan summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Strategy', value: selected.label },
          { label: 'Capex',    value: selected.capex },
          { label: 'Margin',   value: selected.margin },
        ].map(item => (
          <div key={item.label} className="bg-[#1F2937] rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">{item.label}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>⏱ Time to market: <strong className="text-gray-300">{selected.time}</strong></span>
        <span className="text-[#C9A84C] font-medium cursor-pointer hover:underline">Full plan →</span>
      </div>
    </div>
  )
}
