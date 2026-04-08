'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { useLang } from '@/components/LanguageProvider'

interface Country {
  iso: string
  name_fr: string
  flag: string
  region: string
  top_opportunity_score: number | null
  opportunity_count: number
  trade_balance_usd: number | null
  total_imports_usd: number | null
}

function fmt(v: number | null) {
  if (!v) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(1) + 'T'
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
}

const REGION_KEYS = ['All', 'Africa', 'Asia', 'Americas', 'Europe', 'Oceania']

function ReportsContent() {
  const { t } = useLang()
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('All')
  const [sort, setSort] = useState<'score' | 'imports' | 'balance'>('score')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    fetch('/api/countries')
      .then(r => r.json())
      .then(data => {
        setCountries(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = countries
    .filter(c => region === 'All' || c.region === region)
    .filter(c => !search || c.name_fr.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'score') return (b.top_opportunity_score ?? 0) - (a.top_opportunity_score ?? 0)
      if (sort === 'imports') return (b.total_imports_usd ?? 0) - (a.total_imports_usd ?? 0)
      return (a.trade_balance_usd ?? 0) - (b.trade_balance_usd ?? 0)
    })

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{t('reports.title')}</h1>
          <p className="text-gray-400 text-sm">
            {countries.length > 0
              ? t('reports.n_countries', { count: String(countries.length) })
              : t('reports.loading')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder={t('reports.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] w-48"
          />
          <div className="flex gap-1">
            {REGION_KEYS.map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${region === r ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-[#111827] text-gray-400 border border-[rgba(201,168,76,.15)] hover:border-[#C9A84C]/40'}`}
              >
                {r === 'All' ? t('reports.all_regions') : r}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="ml-auto px-3 py-1.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-lg text-gray-400 text-xs focus:outline-none focus:border-[#C9A84C]"
          >
            <option value="score">{t('reports.sort_score')}</option>
            <option value="imports">{t('reports.sort_imports')}</option>
            <option value="balance">{t('reports.sort_deficit')}</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-32 bg-[#111827] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🌍</div>
            <div className="text-white font-semibold mb-1">{t('reports.empty_title')}</div>
            <div className="text-gray-400 text-sm mb-4">{t('reports.empty_desc')}</div>
            <Link href="/map" className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-semibold rounded-lg text-sm hover:bg-[#E8C97A] transition-colors">
              {t('reports.explore_map')}
            </Link>
          </div>
        )}

        {/* Country grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => (
              <Link
                key={c.iso}
                href={`/reports/${c.iso}`}
                className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4 hover:border-[#C9A84C]/50 transition-all group"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="text-2xl">{c.flag}</span>
                  <div>
                    <div className="font-semibold text-white text-sm group-hover:text-[#C9A84C] transition-colors">{c.name_fr}</div>
                    <div className="text-xs text-gray-500">{c.region}</div>
                  </div>
                  {c.top_opportunity_score != null && (
                    <div className="ml-auto text-right">
                      <div className="font-bold text-[#C9A84C] text-lg leading-none">{c.top_opportunity_score}</div>
                      <div className="text-[10px] text-gray-500">{t('country.score')}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 rounded-lg px-2.5 py-2">
                    <div className="text-gray-500 mb-0.5">{t('reports.col_imports')}</div>
                    <div className="text-white font-medium">{fmt(c.total_imports_usd)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2.5 py-2">
                    <div className="text-gray-500 mb-0.5">{t('reports.col_balance')}</div>
                    <div className={`font-medium ${(c.trade_balance_usd ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmt(c.trade_balance_usd)}
                    </div>
                  </div>
                </div>

                {c.opportunity_count > 0 && (
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{t('reports.n_opportunities', { count: String(c.opportunity_count) })}</span>
                    <span className="text-xs text-[#C9A84C] group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  )
}
