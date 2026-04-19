'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Carte influenceur — MVP grid-based (pas Leaflet, plus rapide à livrer).
// Affiche les pays d'origine des produits du catalogue, menu filtre à gauche
// par PRODUIT (au lieu de catégorie). Clic sur un produit → met en valeur son pays.

interface Product {
  id: string
  name: string
  slug: string
  price_eur: number
  category: string
  hero_image_url: string | null
  origin_country: string | null
  commission_pct: number
  influencer_pct: number
}

// ISO → name + flag map for common demo countries. Fallback to ISO code.
const COUNTRY_META: Record<string, { name: string; flag: string }> = {
  'Côte d\'Ivoire':   { name: 'Côte d\'Ivoire',  flag: '🇨🇮' },
  'Maroc':            { name: 'Maroc',           flag: '🇲🇦' },
  'Sénégal':          { name: 'Sénégal',         flag: '🇸🇳' },
  'Madagascar':       { name: 'Madagascar',      flag: '🇲🇬' },
  'Guinée':           { name: 'Guinée',          flag: '🇬🇳' },
  'Vietnam':          { name: 'Vietnam',         flag: '🇻🇳' },
  'Colombie':         { name: 'Colombie',        flag: '🇨🇴' },
  'France':           { name: 'France',          flag: '🇫🇷' },
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function InfluencerMapPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/catalog/products')
      .then((r) => r.json())
      .then((j) => setProducts(j.products ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Group products by country
  const byCountry = useMemo(() => {
    const map: Record<string, Product[]> = {}
    for (const p of products) {
      const c = p.origin_country ?? '—'
      if (!map[c]) map[c] = []
      map[c].push(p)
    }
    return map
  }, [products])

  const countries = Object.keys(byCountry).sort()
  const filteredCountries = selectedProductId
    ? countries.filter((c) => byCountry[c].some((p) => p.id === selectedProductId))
    : countries

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-xs text-gray-500 mb-2">
          <Link href="/influencer/welcome" className="hover:text-gray-300">← Retour</Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Carte des produits</h1>
        <p className="text-gray-400 mb-8 max-w-2xl">
          Explorez les pays d'origine des produits du catalogue. Sélectionnez un produit dans la
          sidebar pour voir son pays mis en valeur.
        </p>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── Sidebar: products ──────────────────────── */}
          <aside className="lg:w-80 shrink-0">
            <div className="sticky top-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">
                Filtrer par produit
              </div>
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-2">
                <button
                  onClick={() => { setSelectedProductId(null); setHighlightedCountry(null) }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                  style={{
                    background: selectedProductId === null ? 'rgba(167,139,250,0.12)' : 'transparent',
                    border: selectedProductId === null ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                    color: selectedProductId === null ? '#C4B5FD' : '#9CA3AF',
                  }}
                >
                  Tous les produits <span className="text-[10px] opacity-60">({products.length})</span>
                </button>
                {loading ? (
                  <div className="text-xs text-gray-500 text-center py-3">Chargement…</div>
                ) : products.map((p) => {
                  const active = selectedProductId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProductId(p.id)
                        setHighlightedCountry(p.origin_country)
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2.5"
                      style={{
                        background: active ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.02)',
                        border: active ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden"
                        style={{ background: '#1a1a2e' }}>
                        {p.hero_image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.hero_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm opacity-50">📦</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                          {COUNTRY_META[p.origin_country ?? '']?.flag ?? '📍'}
                          {p.origin_country ?? 'Origine inconnue'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          {/* ── Main: country grid ─────────────────────── */}
          <main className="flex-1 min-w-0">
            {filteredCountries.length === 0 ? (
              <div className="rounded-3xl p-12 text-center" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-5xl mb-3">🗺️</div>
                <div className="text-white font-semibold mb-1">Aucun pays pour cette sélection</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredCountries.map((country) => {
                  const countryProducts = byCountry[country]
                  const isHighlighted = highlightedCountry === country
                  const meta = COUNTRY_META[country] ?? { name: country, flag: '📍' }
                  return (
                    <div
                      key={country}
                      className="rounded-3xl p-5 transition-all duration-500"
                      style={{
                        background: '#0D1117',
                        border: isHighlighted
                          ? '2px solid rgba(167,139,250,0.6)'
                          : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isHighlighted
                          ? '0 16px 40px rgba(167,139,250,0.2)'
                          : 'none',
                        transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-3xl">{meta.flag}</div>
                        <div>
                          <h3 className="font-bold text-white">{meta.name}</h3>
                          <div className="text-[10px] text-gray-500">
                            {countryProducts.length} produit{countryProducts.length > 1 ? 's' : ''} disponible{countryProducts.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {countryProducts.map((p) => {
                          const isSelected = selectedProductId === p.id
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                              style={{
                                background: isSelected ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.02)',
                              }}
                            >
                              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: '#1a1a2e' }}>
                                {p.hero_image_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={p.hero_image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-sm opacity-50">📦</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                                <div className="text-[10px] text-gray-500">{fmtEur(p.price_eur)}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[9px] text-gray-500 uppercase">Votre part</div>
                                <div className="text-xs font-bold text-[#34D399]">
                                  {((p.commission_pct * p.influencer_pct) / 100).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-8 text-center">
              <Link
                href="/influencer/catalog"
                className="inline-block px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}
              >
                🎨 Voir le catalogue complet →
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
