'use client'

import { useState } from 'react'
import Topbar from '@/components/Topbar'
import type { OpportunityScanResult, GeoOpportunity, ChannelOption } from '@/agents/opportunity-scanner'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconTarget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  )
}
function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}
function IconTrending() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `€${(n / 1e3).toFixed(0)}k`
  return `€${n}`
}

function riskLabel(score: number) {
  if (score <= 2) return { label: 'Low', color: '#34D399' }
  if (score <= 3) return { label: 'Medium', color: '#FBBF24' }
  return { label: 'High', color: '#F87171' }
}

const CHANNEL_ICONS: Record<string, string> = {
  local_distribution:  '🤝',
  own_point_of_sale:   '🏪',
  operator_partnership:'🧗',
  affiliate_ecommerce: '📲',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GeoCard({ geo, rank }: { geo: GeoOpportunity; rank: number }) {
  return (
    <div className="bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl p-4 hover:border-[#C9A84C]/40 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-xs text-[#C9A84C] font-semibold mr-2">#{rank}</span>
          <span className="font-semibold text-white">{geo.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${geo.score}%`, background: geo.score > 70 ? '#C9A84C' : geo.score > 50 ? '#60A5FA' : '#6B7280' }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: geo.score > 70 ? '#C9A84C' : geo.score > 50 ? '#60A5FA' : '#9CA3AF' }}>
            {geo.score}
          </span>
        </div>
      </div>
      <p className="text-gray-400 text-xs mb-3">{geo.rationale}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{geo.countries.slice(0, 3).join(', ')}</span>
        <span className="text-xs font-semibold text-emerald-400">{fmt(geo.market_size_eur)} market</span>
      </div>
      {geo.key_use_cases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {geo.key_use_cases.slice(0, 2).map(uc => (
            <span key={uc} className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{uc}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function ChannelCard({ ch, isRecommended }: { ch: ChannelOption; isRecommended: boolean }) {
  const risk = riskLabel(ch.risk_score)
  return (
    <div className={`relative bg-[#111827] rounded-xl p-5 border transition-all ${isRecommended ? 'border-[#C9A84C]' : 'border-[rgba(201,168,76,.15)] hover:border-[#C9A84C]/30'}`}>
      {isRecommended && (
        <div className="absolute -top-3 left-4 px-2 py-0.5 bg-[#C9A84C] text-[#07090F] text-[10px] font-bold rounded-full uppercase tracking-wide">
          Recommended
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{CHANNEL_ICONS[ch.channel]}</span>
        <span className="font-semibold text-white">{ch.label}</span>
      </div>
      <p className="text-gray-400 text-xs mb-4">{ch.description}</p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 mb-0.5">Capex</div>
          <div className="font-semibold text-white text-sm">{fmt(ch.capex_eur)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 mb-0.5">Margin</div>
          <div className="font-semibold text-emerald-400 text-sm">{ch.margin_pct}%</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 mb-0.5">Time to market</div>
          <div className="font-semibold text-blue-400 text-sm">{ch.time_to_market_weeks}w</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 mb-0.5">Risk</div>
          <div className="font-semibold text-sm" style={{ color: risk.color }}>{risk.label}</div>
        </div>
      </div>

      {/* ROI comparison */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white/5 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">ROI 12m</div>
          <div className={`font-bold text-sm ${ch.roi_12m_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {ch.roi_12m_pct > 0 ? '+' : ''}{ch.roi_12m_pct}%
          </div>
        </div>
        <div className="flex-1 bg-white/5 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">ROI 36m</div>
          <div className={`font-bold text-sm ${ch.roi_36m_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {ch.roi_36m_pct > 0 ? '+' : ''}{ch.roi_36m_pct}%
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Next steps</div>
        <ul className="space-y-1">
          {ch.next_steps.slice(0, 3).map((s, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
              <span className="text-[#C9A84C] mt-0.5 shrink-0">›</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FarmingPage() {
  const [form, setForm] = useState({
    product: '',
    manufacturer: '',
    geography: '',
    budget: '',
    affiliateLink: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpportunityScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/farming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-semibold rounded-full uppercase tracking-wide">
              Product Opportunity Farming
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Find where your product <span className="text-[#C9A84C]">can win</span>
          </h1>
          <p className="text-gray-400 max-w-xl">
            Enter your product — our AI maps the best geographies, competitors, and distribution channels with profitability comparison and time-to-market.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleScan} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Product — full width */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Product description <span className="text-[#C9A84C]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Exoskeleton hiking assistance device — reduces knee strain on descents"
                value={form.product}
                onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
                className="w-full px-4 py-3 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Manufacturer / Distributor
              </label>
              <input
                type="text"
                placeholder="e.g. ExoWalk Technologies"
                value={form.manufacturer}
                onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                className="w-full px-4 py-3 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Target geography
              </label>
              <input
                type="text"
                placeholder="e.g. Alps region, Southeast Asia, worldwide…"
                value={form.geography}
                onChange={e => setForm(f => ({ ...f, geography: e.target.value }))}
                className="w-full px-4 py-3 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Budget available
              </label>
              <input
                type="text"
                placeholder="e.g. 50 000 – 200 000 EUR"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                className="w-full px-4 py-3 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Affiliate link <span className="text-gray-600 normal-case font-normal">(enables influencer matching)</span>
              </label>
              <input
                type="url"
                placeholder="https://your-store.com?ref=partner"
                value={form.affiliateLink}
                onChange={e => setForm(f => ({ ...f, affiliateLink: e.target.value }))}
                className="w-full px-4 py-3 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !form.product.trim()}
            className="w-full py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                AI scanning opportunities…
              </>
            ) : (
              <>
                <IconTarget />
                Scan opportunities
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Executive summary */}
            <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <IconZap />
                <h2 className="font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{result.executive_summary}</p>
            </div>

            {/* Geographic opportunities */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <IconGlobe />
                <h2 className="font-bold text-white text-lg">Top Geographies</h2>
                <span className="ml-auto text-xs text-gray-500">{result.top_geographies.length} markets identified</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.top_geographies
                  .sort((a, b) => b.score - a.score)
                  .map((geo, i) => (
                    <GeoCard key={geo.name} geo={geo} rank={i + 1} />
                  ))}
              </div>
            </div>

            {/* Channel strategy */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <IconTrending />
                <h2 className="font-bold text-white text-lg">Channel Strategy Comparison</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.channel_options.map(ch => (
                  <ChannelCard
                    key={ch.channel}
                    ch={ch}
                    isRecommended={ch.channel === result.recommended_channel}
                  />
                ))}
              </div>
            </div>

            {/* Competitor map */}
            {result.competitor_map.length > 0 && (
              <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6">
                <h2 className="font-bold text-white mb-4">Competitor Landscape</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-white/5">
                        <th className="pb-2 pr-4">Company</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Geography</th>
                        <th className="pb-2 pr-4">Share</th>
                        <th className="pb-2">Weakness to exploit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.competitor_map.map((c, i) => (
                        <tr key={i} className="text-gray-300">
                          <td className="py-2.5 pr-4 font-medium text-white">{c.name}</td>
                          <td className="py-2.5 pr-4">
                            <span className="px-2 py-0.5 bg-white/5 rounded-full text-xs capitalize">{c.type}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-gray-400">{c.geography}</td>
                          <td className="py-2.5 pr-4 text-gray-400">
                            {c.market_share_pct != null ? `${c.market_share_pct}%` : '—'}
                          </td>
                          <td className="py-2.5 text-xs text-gray-500">{c.weakness ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Influencer angles */}
            {result.influencer_angles && result.influencer_angles.length > 0 && (
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📲</span>
                  <h2 className="font-bold text-white">Influencer Content Angles</h2>
                  <span className="ml-auto px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">Affiliate module</span>
                </div>
                <ul className="space-y-2">
                  {result.influencer_angles.map((angle, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-purple-400 mt-0.5 shrink-0">›</span>
                      {angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-6 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white mb-1">Want a full GTM execution plan?</div>
                <div className="text-sm text-gray-400">Get detailed action plans, operator contacts, and influencer matching for each channel.</div>
              </div>
              <a href="/pricing" className="shrink-0 ml-4 px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
                Upgrade to Pro
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
