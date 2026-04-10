'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Shared component used by /finance/reports and /invest/reports.
// Displays an anonymized list of dossiers filtered by type + filters.

interface DossierFeedItem {
  id: string
  public_number: number
  type: 'financement' | 'investissement'
  country_iso: string | null
  product_slug: string | null
  amount_eur: number
  status: string
  quality_score: number | null
  submitted_at: string | null
  display_name: string
}

function fmtEur(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

function qualityColor(score: number | null): string {
  if (!score) return '#9CA3AF'
  if (score >= 80) return '#34D399'
  if (score >= 60) return '#C9A84C'
  if (score >= 40) return '#F59E0B'
  return '#F97316'
}

interface DossierFeedProps {
  type: 'financement' | 'investissement'
  baseHref: string   // '/finance/reports' or '/invest/reports'
  accentColor: string
  title: string
  subtitle: string
}

export default function DossierFeed({ type, baseHref, accentColor, title, subtitle }: DossierFeedProps) {
  const [dossiers, setDossiers] = useState<DossierFeedItem[]>([])
  const [countries, setCountries] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [minQuality, setMinQuality] = useState(0)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ type })
    if (countryFilter !== 'all') params.set('country', countryFilter)
    if (minAmount) params.set('min', minAmount)
    if (maxAmount) params.set('max', maxAmount)

    fetch(`/api/funding/dossiers/feed?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setDossiers(j.dossiers ?? [])
        setCountries(j.countries ?? {})
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [type, countryFilter, minAmount, maxAmount])

  const filtered = useMemo(() => {
    return dossiers.filter((d) => (d.quality_score ?? 0) >= minQuality)
  }, [dossiers, minQuality])

  const countryKeys = Object.keys(countries).sort((a, b) => countries[b] - countries[a])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
        <p className="text-gray-400">{subtitle}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-4 space-y-4">
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Qualité du dossier</div>
              <div className="rounded-xl p-3" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400">Score min.</span>
                  <span className="font-bold" style={{ color: qualityColor(minQuality) }}>{minQuality}/100</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={minQuality}
                  onChange={(e) => setMinQuality(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor }}
                />
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Pays</div>
              <div className="space-y-1">
                <button
                  onClick={() => setCountryFilter('all')}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    background: countryFilter === 'all' ? accentColor + '15' : 'transparent',
                    border: countryFilter === 'all' ? `1px solid ${accentColor}40` : '1px solid transparent',
                    color: countryFilter === 'all' ? accentColor : '#9CA3AF',
                  }}
                >
                  Tous les pays <span className="text-[10px] opacity-60 ml-1">({dossiers.length})</span>
                </button>
                {countryKeys.map((iso) => (
                  <button
                    key={iso}
                    onClick={() => setCountryFilter(iso)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: countryFilter === iso ? accentColor + '15' : 'transparent',
                      border: countryFilter === iso ? `1px solid ${accentColor}40` : '1px solid transparent',
                      color: countryFilter === iso ? accentColor : '#9CA3AF',
                    }}
                  >
                    {iso} <span className="text-[10px] opacity-60 ml-1">({countries[iso]})</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Ticket</div>
              <div className="space-y-2">
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="Min €"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="Max €"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 min-w-0">
          {error && (
            <div className="rounded-xl p-4 mb-4 text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="mb-4 text-xs text-gray-500">
            {loading ? 'Chargement…' : `${filtered.length} dossier${filtered.length > 1 ? 's' : ''} ${filtered.length > 1 ? 'qualifiés' : 'qualifié'}`}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#0D1117' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl p-12 text-center" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-4xl mb-2">📭</div>
              <div className="text-white font-semibold mb-1">Aucun dossier ne correspond à vos critères</div>
              <div className="text-sm text-gray-500">Ajustez les filtres pour élargir votre deal flow.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => {
                const q = d.quality_score ?? 0
                return (
                  <Link
                    key={d.id}
                    href={`${baseHref}/${d.id}`}
                    className="block rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                    style={{ background: '#0D1117', border: `1px solid ${accentColor}15` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Quality score circle */}
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: `${qualityColor(q)}15`,
                          border: `2px solid ${qualityColor(q)}50`,
                        }}
                      >
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color: qualityColor(q) }}>{q}</div>
                          <div className="text-[8px] text-gray-500 -mt-0.5">/100</div>
                        </div>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-white">{d.display_name}</span>
                          {d.country_iso && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: accentColor + '20', color: accentColor }}>
                              {d.country_iso}
                            </span>
                          )}
                          {d.product_slug && (
                            <span className="text-xs text-gray-500">· {d.product_slug}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Soumis {d.submitted_at ? new Date(d.submitted_at).toLocaleDateString('fr-FR') : '—'} · Statut {d.status}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-gray-500 uppercase">Ticket</div>
                        <div className="text-lg font-bold text-white">{fmtEur(d.amount_eur)}</div>
                      </div>

                      <div className="text-gray-500 shrink-0">→</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
