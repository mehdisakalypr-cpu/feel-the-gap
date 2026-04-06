'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface DbStats {
  countries: number | null
  products: number | null
  opportunities: number | null
  seed_available: number
}

interface TableRow {
  id: string
  name_fr?: string
  name?: string
  region?: string
  trade_balance_usd?: number
  total_imports_usd?: number
  opportunity_score?: number
  category?: string
  gap_value_usd?: number
  country_iso?: string
}

type Tab = 'countries' | 'products' | 'opportunities'

function fmt(v: number | null) {
  if (!v) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(1) + 'T'
  if (a >= 1e9)  return s + '$' + (a / 1e9).toFixed(1) + 'B'
  if (a >= 1e6)  return s + '$' + (a / 1e6).toFixed(0) + 'M'
  return s + '$' + a.toLocaleString()
}

const ACTION_CONFIG = [
  { action: 'reseed_countries',     label: 'Re-seed Countries',     color: '#60A5FA', desc: 'Upsert 92 countries from seed data' },
  { action: 'reseed_products',      label: 'Re-seed Products',      color: '#34D399', desc: 'Upsert 105 products (HS codes)' },
  { action: 'clear_opportunities',  label: 'Clear Opportunities',   color: '#F87171', desc: 'Delete all opportunity rows' },
  { action: 'reseed_opportunities', label: 'Re-seed Opportunities', color: '#C9A84C', desc: 'Insert ~97 opportunities from gaps' },
]

export default function AdminDataPage() {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [tab, setTab] = useState<Tab>('countries')
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])
  const [running, setRunning] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin/seed')
    if (res.ok) setStats(await res.json())
  }, [])

  const fetchRows = useCallback(async (t: Tab) => {
    setLoading(true)
    let data: TableRow[] = []
    if (t === 'countries') {
      const { data: d } = await supabase.from('countries')
        .select('id,name_fr,region,trade_balance_usd,total_imports_usd')
        .order('total_imports_usd', { ascending: false }).limit(50)
      data = (d ?? []).map(r => ({ ...r, id: r.id }))
    } else if (t === 'products') {
      const { data: d } = await supabase.from('products')
        .select('id,name,category').order('category').limit(50)
      data = d ?? []
    } else {
      const { data: d } = await supabase.from('opportunities')
        .select('id,country_iso,opportunity_score,gap_value_usd,type')
        .order('opportunity_score', { ascending: false }).limit(50)
      data = d ?? []
    }
    setRows(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchRows(tab) }, [tab, fetchRows])

  async function runAction(action: string) {
    setRunning(action)
    const ts = new Date().toLocaleTimeString()
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.error) {
        setActionLog(l => [`[${ts}] ❌ ${action}: ${json.error}`, ...l])
      } else {
        setActionLog(l => [`[${ts}] ✅ ${action}: ${json.count != null ? json.count + ' rows' : 'done'}`, ...l])
        fetchStats()
        fetchRows(tab)
      }
    } catch (e) {
      setActionLog(l => [`[${ts}] ❌ ${action}: network error`, ...l])
    }
    setRunning(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Data Management</h1>
        <p className="text-sm text-gray-500 mt-1">Seed, inspect and manage the Supabase database</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Countries', value: stats?.countries, color: '#C9A84C' },
          { label: 'Products', value: stats?.products, color: '#34D399' },
          { label: 'Opportunities', value: stats?.opportunities, color: '#60A5FA' },
          { label: 'Seed available', value: stats?.seed_available, color: '#A78BFA' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value ?? '…'}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Seed Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {ACTION_CONFIG.map(a => (
            <button
              key={a.action}
              onClick={() => runAction(a.action)}
              disabled={running !== null}
              className="flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all hover:opacity-90 disabled:opacity-40"
              style={{ borderColor: a.color + '44', background: a.color + '12' }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: a.color }}>{a.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{a.desc}</div>
              </div>
              {running === a.action && (
                <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Action log */}
        {actionLog.length > 0 && (
          <div className="bg-black/30 rounded-lg p-3 font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
            {actionLog.map((line, i) => (
              <div key={i} className={line.includes('❌') ? 'text-red-400' : 'text-emerald-400'}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Table viewer */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-white">Table Preview</h2>
          <div className="flex gap-1 ml-auto">
            {(['countries', 'products', 'opportunities'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No data — run a seed action above</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 uppercase tracking-wide border-b border-white/5">
                  {tab === 'countries' && <><th className="pb-2 pr-4">ISO</th><th className="pb-2 pr-4">Name</th><th className="pb-2 pr-4">Region</th><th className="pb-2 pr-4">Imports</th><th className="pb-2">Balance</th></>}
                  {tab === 'products'  && <><th className="pb-2 pr-4">ID</th><th className="pb-2 pr-4">Name</th><th className="pb-2">Category</th></>}
                  {tab === 'opportunities' && <><th className="pb-2 pr-4">Country</th><th className="pb-2 pr-4">Type</th><th className="pb-2 pr-4">Score</th><th className="pb-2">Gap</th></>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r, i) => (
                  <tr key={i} className="text-gray-300">
                    {tab === 'countries' && <>
                      <td className="py-2 pr-4 font-mono text-[#C9A84C]">{r.id}</td>
                      <td className="py-2 pr-4 text-white">{r.name_fr}</td>
                      <td className="py-2 pr-4 text-gray-500">{r.region}</td>
                      <td className="py-2 pr-4">{fmt(r.total_imports_usd ?? null)}</td>
                      <td className="py-2" style={{ color: (r.trade_balance_usd ?? 0) < 0 ? '#F87171' : '#34D399' }}>{fmt(r.trade_balance_usd ?? null)}</td>
                    </>}
                    {tab === 'products' && <>
                      <td className="py-2 pr-4 font-mono text-[#C9A84C] text-[10px]">{r.id}</td>
                      <td className="py-2 pr-4 text-white">{r.name}</td>
                      <td className="py-2"><span className="px-2 py-0.5 bg-white/5 rounded-full capitalize">{r.category}</span></td>
                    </>}
                    {tab === 'opportunities' && <>
                      <td className="py-2 pr-4 font-mono text-[#C9A84C]">{r.country_iso}</td>
                      <td className="py-2 pr-4 text-gray-400 capitalize">{(r as any).type?.replace('_', ' ')}</td>
                      <td className="py-2 pr-4 font-bold text-white">{r.opportunity_score}</td>
                      <td className="py-2 text-emerald-400">{fmt(r.gap_value_usd ?? null)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-600 mt-3">Showing top 50 rows</p>
          </div>
        )}
      </div>
    </div>
  )
}
