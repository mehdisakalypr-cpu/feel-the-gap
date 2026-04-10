'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Topbar from '@/components/Topbar'

interface FavoriteRow {
  id: string
  notes: string | null
  created_at: string
  product_id: string
  products_catalog: {
    id: string
    name: string
    slug: string
    hero_image_url: string | null
    price_eur: number
    category: string
    commission_pct: number
    influencer_pct: number
  } | null
}

function fmtEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://feel-the-gap.duckdns.org'

export default function InfluencerFavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/influencer/favorites')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setFavorites(j.favorites ?? [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function remove(productId: string) {
    if (!confirm('Retirer ce produit de vos favoris ?')) return
    const res = await fetch(`/api/influencer/favorites?product_id=${productId}`, { method: 'DELETE' })
    if (res.ok) setFavorites((prev) => prev.filter((f) => f.product_id !== productId))
  }

  function copyLink(productId: string) {
    const link = `${APP_URL}/go/inf-${productId.slice(0, 8)}`
    navigator.clipboard.writeText(link)
  }

  const totalPotentialCommission = favorites.reduce((sum, f) => {
    if (!f.products_catalog) return sum
    const p = f.products_catalog
    return sum + (p.price_eur * p.commission_pct * p.influencer_pct) / 10000
  }, 0)

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-xs text-gray-500 mb-2">
          <Link href="/influencer/welcome" className="hover:text-gray-300">← Bienvenue</Link>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Mes favoris</h1>
        <p className="text-gray-400 mb-8">
          Les produits que vous avez sélectionnés pour votre audience. Partagez leur lien d'affiliation unique.
        </p>

        {/* Stats */}
        {favorites.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl p-4" style={{ background: '#0D1117', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div className="text-[10px] text-gray-500 uppercase mb-1">Produits suivis</div>
              <div className="text-2xl font-bold text-white">{favorites.length}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: '#0D1117', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="text-[10px] text-gray-500 uppercase mb-1">Commission / vente (total)</div>
              <div className="text-2xl font-bold text-[#34D399]">{fmtEur(totalPotentialCommission)}</div>
            </div>
            <div className="rounded-2xl p-4 col-span-2 md:col-span-1" style={{ background: '#0D1117', border: '1px solid rgba(236,72,153,0.2)' }}>
              <div className="text-[10px] text-gray-500 uppercase mb-1">Split Feel The Gap</div>
              <div className="text-2xl font-bold text-white">70 % <span className="text-xs text-gray-500 font-normal">pour vous</span></div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-gray-500 py-10">Chargement…</div>
        ) : favorites.length === 0 ? (
          <div className="rounded-3xl p-12 text-center" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-5xl mb-3">⭐</div>
            <div className="text-white font-semibold mb-1">Aucun favori pour le moment</div>
            <div className="text-sm text-gray-500 mb-6">Parcourez le catalogue pour découvrir des produits en qui croire.</div>
            <Link href="/influencer/catalog"
              className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899)', color: '#07090F' }}>
              Parcourir le catalogue →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((f) => {
              const p = f.products_catalog
              if (!p) return null
              const commissionPerSale = (p.price_eur * p.commission_pct * p.influencer_pct) / 10000
              return (
                <div key={f.id} className="rounded-2xl p-5 flex items-center gap-4 flex-wrap md:flex-nowrap"
                  style={{ background: '#0D1117', border: '1px solid rgba(167,139,250,0.15)' }}>
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0"
                    style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {p.hero_image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.hero_image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl opacity-50">📦</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white mb-0.5 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {fmtEur(p.price_eur)} · Commission {((p.commission_pct * p.influencer_pct) / 100).toFixed(1)}%
                    </div>
                    {f.notes && <div className="text-xs text-gray-400 italic mt-1">« {f.notes} »</div>}
                  </div>

                  {/* Commission */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-gray-500 uppercase">Par vente</div>
                    <div className="text-lg font-bold text-[#34D399]">{fmtEur(commissionPerSale)}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => copyLink(p.id)}
                      className="flex-1 md:flex-none px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}>
                      📋 Copier le lien
                    </button>
                    <button onClick={() => remove(p.id)}
                      className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/5">
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
