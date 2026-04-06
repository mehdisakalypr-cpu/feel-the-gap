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

// ── Influencer Module ────────────────────────────────────────────────────────

const INFLUENCER_TYPES = [
  { icon: '🎥', label: 'YouTube', desc: 'Long-form reviews & vlogs', avg_reach: '250K', commission: '8-15%' },
  { icon: '📱', label: 'Instagram', desc: 'Stories + Reels product demos', avg_reach: '45K', commission: '5-12%' },
  { icon: '🎵', label: 'TikTok', desc: 'Short viral product content', avg_reach: '180K', commission: '6-10%' },
  { icon: '✍️', label: 'Blog / SEO', desc: 'Review articles + affiliate links', avg_reach: '30K/mo', commission: '10-20%' },
]

function InfluencerModule({ product, affiliateLink }: { product: string; affiliateLink: string }) {
  const [open, setOpen] = useState(false)
  const [commissionPct, setCommissionPct] = useState(10)
  const hasLink = affiliateLink.trim().length > 0

  const platformFee = (commissionPct * 0.05).toFixed(1)

  return (
    <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📲</span>
          <div className="text-left">
            <div className="font-semibold text-white">Influencer & Affiliate Module</div>
            <div className="text-xs text-gray-400">Connect your product with content creators — pay only on results</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasLink && <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded-full font-semibold">Affiliate link ready</span>}
          <span className="text-gray-500 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/5">
          {/* How it works */}
          <div className="pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How it works</div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              {[
                { step: '1', label: 'You provide', desc: 'affiliate link + commission %' },
                { step: '2', label: 'We match', desc: 'content creators in your niche' },
                { step: '3', label: 'They promote', desc: 'pay 5% of their commission' },
              ].map(s => (
                <div key={s.step} className="bg-white/5 rounded-xl p-3">
                  <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] font-bold text-sm flex items-center justify-center mx-auto mb-2">{s.step}</div>
                  <div className="font-semibold text-white mb-0.5">{s.label}</div>
                  <div className="text-gray-500">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission simulator */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">Commission simulator</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Your commission:</span>
                <input
                  type="number" min={1} max={40} value={commissionPct}
                  onChange={e => setCommissionPct(Number(e.target.value))}
                  className="w-14 px-2 py-1 bg-[#111827] border border-white/10 rounded-lg text-white text-xs text-center focus:outline-none focus:border-[#C9A84C]"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              {[
                { label: '€1,000 sale', commission: 1000 * commissionPct / 100, fee: 1000 * commissionPct / 100 * 0.05 },
                { label: '€5,000/mo',   commission: 5000 * commissionPct / 100, fee: 5000 * commissionPct / 100 * 0.05 },
                { label: '€20,000/mo',  commission: 20000 * commissionPct / 100, fee: 20000 * commissionPct / 100 * 0.05 },
              ].map(sim => (
                <div key={sim.label} className="bg-[#07090F] rounded-lg p-2.5">
                  <div className="text-gray-500 mb-1">{sim.label}</div>
                  <div className="text-emerald-400 font-semibold">€{sim.commission.toFixed(0)} earned</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">Platform fee: €{sim.fee.toFixed(0)}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2 text-center">
              Influencers pay {platformFee}% of their commission earnings as platform subscription — zero upfront cost for you.
            </p>
          </div>

          {/* Channel types */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Matched creator types for <span className="text-white">{product || 'your product'}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {INFLUENCER_TYPES.map(t => (
                <div key={t.label} className="bg-white/5 rounded-xl p-3 flex items-start gap-2.5">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                    <div className="text-[10px] text-gray-600 mt-1">Avg reach: {t.avg_reach} · Commission: {t.commission}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Affiliate link status */}
          {hasLink ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="text-emerald-400">✓</span>
              <div>
                <div className="text-sm text-emerald-300 font-medium">Affiliate link configured</div>
                <div className="text-xs text-gray-500 truncate max-w-xs">{affiliateLink}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <span className="text-yellow-400">⚠</span>
              <div>
                <div className="text-sm text-yellow-300 font-medium">No affiliate link provided</div>
                <div className="text-xs text-gray-500">Add your affiliate link in the form above to activate influencer matching</div>
              </div>
            </div>
          )}

          <a href="/pricing" className="block w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm text-center rounded-xl hover:opacity-90 transition-opacity">
            Activate influencer matching — Pro plan
          </a>
        </div>
      )}
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

            {/* ── Influencer Module ── */}
            <InfluencerModule product={form.product} affiliateLink={form.affiliateLink} />

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
