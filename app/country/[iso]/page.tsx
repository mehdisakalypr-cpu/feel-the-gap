'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Country {
  id: string; name: string; name_fr: string; flag: string; region: string
  sub_region: string; population: number | null; gdp_usd: number | null
  total_imports_usd: number | null; total_exports_usd: number | null
  trade_balance_usd: number | null; top_import_category: string | null; data_year: number | null
  arable_land_pct: number | null; labor_cost_index: number | null; infrastructure_score: number | null
}

interface Opportunity {
  id: string; type: string; opportunity_score: number; gap_value_usd: number | null
  summary: string | null; land_availability: string | null
  products: { name: string; category: string } | null
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null) {
  if (!v) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(1) + 'T'
  if (a >= 1e9)  return s + '$' + (a / 1e9).toFixed(1) + 'B'
  if (a >= 1e6)  return s + '$' + (a / 1e6).toFixed(0) + 'M'
  return s + '$' + a.toLocaleString()
}

const TYPE_LABEL: Record<string, string> = {
  direct_trade: 'Direct Trade', local_production: 'Local Production'
}
const CATEGORY_ICON: Record<string, string> = {
  agriculture: '🌾', energy: '⚡', materials: '🪨', manufactured: '🏭', resources: '💧'
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

function AIChat({ country }: { country: Country }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const userMsg: ChatMsg = { role: 'user', content: input }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs,
          context: {
            country: country.name_fr, iso: country.id,
            product: country.top_import_category ?? 'général',
            category: country.top_import_category ?? 'général',
            strategy: 'trade',
          },
        }),
      })

      if (!res.ok) throw new Error('API error')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let aiText = ''
      setMsgs(m => [...m, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const delta = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content
            if (delta) {
              aiText += delta
              setMsgs(m => [...m.slice(0, -1), { role: 'assistant', content: aiText }])
            }
          } catch {}
        }
      }
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Sorry, AI advisor unavailable right now.' }])
    }
    setStreaming(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl text-[#C9A84C] font-semibold text-sm hover:bg-[#C9A84C]/20 transition-colors flex items-center justify-center gap-2">
        <span>✨</span> Ask AI about this market
      </button>
    )
  }

  return (
    <div className="border border-[#C9A84C]/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#C9A84C]/10 border-b border-[#C9A84C]/20">
        <span className="text-xs font-semibold text-[#C9A84C]">✨ AI Trade Advisor — {country.name_fr}</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
      </div>
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-[#07090F]">
        {msgs.length === 0 && (
          <p className="text-xs text-gray-500">Ask anything about trade opportunities, entry strategies, or market conditions in {country.name_fr}.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${m.role === 'user' ? 'bg-[#C9A84C] text-[#07090F] font-medium' : 'bg-[#111827] text-gray-300'}`}>
              {m.content || <span className="animate-pulse">▋</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-white/5 bg-[#0D1117]">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="What's the best entry strategy?" disabled={streaming}
          className="flex-1 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors" />
        <button type="submit" disabled={streaming || !input.trim()}
          className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-lg text-sm disabled:opacity-40 hover:bg-[#E8C97A] transition-colors">→</button>
      </form>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CountryPage() {
  const { iso } = useParams<{ iso: string }>()
  const router = useRouter()
  const [country, setCountry] = useState<Country | null>(null)
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!iso) return
    Promise.all([
      supabase.from('countries').select('*').eq('id', iso.toUpperCase()).single(),
      supabase.from('opportunities')
        .select('id, type, opportunity_score, gap_value_usd, summary, land_availability, products(name, category)')
        .eq('country_iso', iso.toUpperCase())
        .order('opportunity_score', { ascending: false })
        .limit(10),
    ]).then(([{ data: c }, { data: o }]) => {
      if (!c) { router.push('/reports'); return }
      setCountry(c as Country)
      setOpps((o ?? []).map((x: any) => ({ ...x, products: Array.isArray(x.products) ? x.products[0] ?? null : x.products })) as Opportunity[])
      setLoading(false)
    })
  }, [iso, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!country) return null

  const balance = country.trade_balance_usd ?? 0

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />

      <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <span className="text-5xl">{country.flag}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link href="/reports" className="text-xs text-gray-500 hover:text-gray-300">← Reports</Link>
            </div>
            <h1 className="text-3xl font-bold text-white">{country.name_fr}</h1>
            <p className="text-gray-400 text-sm">{country.sub_region} · {country.region}</p>
          </div>
          <Link href="/map" className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/10 transition-colors">
            View on map
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Imports', value: fmt(country.total_imports_usd), color: '#60A5FA' },
            { label: 'Total Exports', value: fmt(country.total_exports_usd), color: '#34D399' },
            { label: 'Trade Balance', value: fmt(country.trade_balance_usd), color: balance < 0 ? '#F87171' : '#34D399' },
            { label: 'GDP', value: fmt(country.gdp_usd), color: '#C9A84C' },
          ].map(k => (
            <div key={k.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{k.label}</div>
              <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Context row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Population', value: country.population ? (country.population / 1e6).toFixed(1) + 'M' : '—' },
            { label: 'Data year', value: country.data_year?.toString() ?? '—' },
            { label: 'Top category', value: country.top_import_category ? (CATEGORY_ICON[country.top_import_category] ?? '') + ' ' + country.top_import_category : '—' },
          ].map(k => (
            <div key={k.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl px-4 py-3">
              <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
              <div className="text-sm font-semibold text-white capitalize">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opportunities */}
          <div>
            <h2 className="font-bold text-white mb-3 flex items-center gap-2">
              <span>💡</span> Trade Opportunities
              <span className="ml-auto text-xs text-gray-500">{opps.length} identified</span>
            </h2>
            {opps.length === 0 ? (
              <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm">No opportunities in database yet.</p>
                <Link href="/admin/data" className="text-xs text-[#C9A84C] mt-2 inline-block hover:underline">Seed data →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opps.map(opp => (
                  <div key={opp.id} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4 hover:border-[#C9A84C]/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-white">
                          {opp.products ? (CATEGORY_ICON[opp.products.category] ?? '') + ' ' + opp.products.name : 'Product'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 capitalize">{TYPE_LABEL[opp.type] ?? opp.type}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#C9A84C]">{opp.opportunity_score}</div>
                        <div className="text-[10px] text-gray-500">score</div>
                      </div>
                    </div>
                    {opp.gap_value_usd && (
                      <div className="text-xs text-emerald-400 mb-1.5">Gap: {fmt(opp.gap_value_usd)}/yr</div>
                    )}
                    {opp.summary && (
                      <p className="text-xs text-gray-400 line-clamp-2">{opp.summary}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Link href="/pricing" className="text-[10px] text-[#C9A84C] hover:underline">Full business plan →</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: AI + context */}
          <div className="space-y-4">
            <AIChat country={country} />

            {/* Investment context */}
            <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Investment Context</h3>
              <div className="space-y-2">
                {[
                  { label: 'Arable land', value: country.arable_land_pct != null ? country.arable_land_pct + '%' : '—' },
                  { label: 'Labor cost index', value: country.labor_cost_index != null ? country.labor_cost_index + ' / 100' : '—' },
                  { label: 'Infrastructure', value: country.infrastructure_score != null ? country.infrastructure_score + ' / 10' : '—' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="text-white font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-[#C9A84C]/10 to-transparent border border-[#C9A84C]/25 rounded-xl p-4">
              <div className="font-semibold text-white text-sm mb-1">Get the full {country.name_fr} report</div>
              <div className="text-xs text-gray-400 mb-3">Complete business plans, supplier contacts, ROI models.</div>
              <Link href="/pricing" className="block w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm text-center rounded-xl hover:bg-[#E8C97A] transition-colors">
                Upgrade to Pro →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
