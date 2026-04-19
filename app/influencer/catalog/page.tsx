'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'

// Catalogue produits style Apple pour les influenceurs.
// - Sidebar gauche : catégories (sticky)
// - Droite : grid de cards avec fade-in au scroll (IntersectionObserver)
// - Clic card → drawer/modal avec détails complets + bouton "Sauvegarder"

interface Product {
  id: string
  name: string
  slug: string
  short_pitch: string | null
  description: string | null
  price_eur: number
  currency: string
  category: string
  images: string[]
  hero_image_url: string | null
  benefits: string[]
  ingredients: string[]
  variants: string[]
  origin_country: string | null
  impact_data: Record<string, unknown>
  commission_pct: number
  platform_pct: number
  influencer_pct: number
  external_url: string | null
  our_go_code: string | null
  saves_count: number
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  agriculture: { label: 'Agriculture & terroir', icon: '🌾', color: '#C9A84C' },
  food:        { label: 'Alimentation',          icon: '🍫', color: '#F59E0B' },
  cosmetics:   { label: 'Cosmétique',            icon: '💄', color: '#EC4899' },
  fashion:     { label: 'Mode & accessoires',    icon: '👜', color: '#A78BFA' },
  energy:      { label: 'Énergie & utilitaire',  icon: '⚡', color: '#60A5FA' },
  services:    { label: 'Services',              icon: '🛎️', color: '#34D399' },
  other:       { label: 'Autre',                 icon: '✨', color: '#9CA3AF' },
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

// Animated card wrapper — fade+slide-in when it enters viewport
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useMemo(() => {
    if (typeof window === 'undefined') return null
    return { current: null as HTMLDivElement | null }
  }, [])

  return (
    <div
      ref={(el) => {
        if (!el || visible) return
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              setTimeout(() => setVisible(true), delay)
              io.disconnect()
            }
          })
        }, { threshold: 0.1 })
        io.observe(el)
      }}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
        transition: 'opacity 700ms ease, transform 700ms ease',
      }}
    >
      {children}
    </div>
  )
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [isInfluencer, setIsInfluencer] = useState(false)

  useEffect(() => {
    // Load products + user state in parallel
    Promise.all([
      fetch('/api/catalog/products').then((r) => r.json()),
      (async () => {
        const sb = createSupabaseBrowser()
        const { data } = await sb.auth.getUser()
        if (!data.user) return { favorites: [], isInfluencer: false }
        const { data: profile } = await sb.from('profiles').select('roles').eq('id', data.user.id).single()
        const hasInfluencer = ((profile?.roles ?? []) as string[]).includes('influenceur')
        const res = await fetch('/api/influencer/favorites')
        const favJson = res.ok ? await res.json() : { favorites: [] }
        return { favorites: favJson.favorites ?? [], isInfluencer: hasInfluencer }
      })(),
    ])
      .then(([catalog, userState]) => {
        setProducts(catalog.products ?? [])
        setCategories(catalog.categories ?? {})
        setFavorites(new Set((userState.favorites as Array<{ product_id: string }>).map((f) => f.product_id)))
        setIsInfluencer(userState.isInfluencer)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return products
    return products.filter((p) => p.category === activeCategory)
  }, [products, activeCategory])

  async function toggleFavorite(product: Product) {
    if (!isInfluencer) {
      window.location.href = '/influencer/welcome'
      return
    }
    const isFav = favorites.has(product.id)
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(product.id); else next.add(product.id)
      return next
    })
    try {
      if (isFav) {
        await fetch(`/api/influencer/favorites?product_id=${product.id}`, { method: 'DELETE' })
      } else {
        await fetch('/api/influencer/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: product.id }),
        })
      }
    } catch {
      // Revert
      setFavorites((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(product.id); else next.delete(product.id)
        return next
      })
    }
  }

  const categoryKeys = Object.keys(categories).sort((a, b) => categories[b] - categories[a])

  return (
    <div className="min-h-screen bg-[#07090F] text-white">

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="text-xs text-gray-500 mb-2">
            <Link href="/influencer/welcome" className="hover:text-gray-300">← Retour</Link>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">
            Le catalogue<br />
            <span style={{ background: 'linear-gradient(135deg,#A78BFA,#EC4899,#C9A84C)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              des produits en qui vous croyez.
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl">
            Chaque produit est validé manuellement. Sauvegardez ceux qui résonnent avec votre audience —
            vous générerez un lien d'affiliation unique pour chacun.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* ── Sidebar categories ───────────────────────────── */}
          <aside className="md:w-60 shrink-0">
            <div className="sticky top-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Catégories</div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between"
                  style={{
                    background: activeCategory === 'all' ? 'rgba(167,139,250,0.12)' : 'transparent',
                    border: activeCategory === 'all' ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                    color: activeCategory === 'all' ? '#C4B5FD' : '#9CA3AF',
                  }}
                >
                  <span className="text-sm font-medium">Tous les produits</span>
                  <span className="text-[10px] font-bold opacity-60">{products.length}</span>
                </button>
                {categoryKeys.map((key) => {
                  const meta = CATEGORY_META[key] ?? { label: key, icon: '✨', color: '#9CA3AF' }
                  const active = activeCategory === key
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2"
                      style={{
                        background: active ? meta.color + '15' : 'transparent',
                        border: active ? `1px solid ${meta.color}40` : '1px solid transparent',
                      }}
                    >
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-sm font-medium flex-1" style={{ color: active ? meta.color : '#d1d5db' }}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold opacity-60">{categories[key]}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* ── Grid products ────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="rounded-3xl aspect-[4/5] animate-pulse" style={{ background: '#0D1117' }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl p-16 text-center" style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-5xl mb-3">🍃</div>
                <div className="text-white font-semibold mb-1">Aucun produit dans cette catégorie</div>
                <div className="text-sm text-gray-500">Le catalogue s'enrichit chaque semaine — revenez bientôt.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((p, idx) => {
                  const meta = CATEGORY_META[p.category] ?? { label: p.category, icon: '✨', color: '#9CA3AF' }
                  const isFav = favorites.has(p.id)
                  const heroImg = p.hero_image_url ?? p.images?.[0] ?? null
                  return (
                    <FadeIn key={p.id} delay={(idx % 6) * 80}>
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="group text-left w-full rounded-3xl overflow-hidden transition-all duration-500"
                        style={{
                          background: '#0D1117',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {/* Image */}
                        <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}15, #0D1117)` }}>
                          {heroImg ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={heroImg}
                              alt={p.name}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-6xl opacity-50">
                              {meta.icon}
                            </div>
                          )}
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(7,9,15,0.75) 100%)' }} />
                          <div className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur"
                            style={{ background: meta.color + '25', color: meta.color, border: `1px solid ${meta.color}40` }}>
                            {meta.icon} {meta.label}
                          </div>
                        </div>
                        {/* Body */}
                        <div className="p-5">
                          <h3 className="font-bold text-white text-lg mb-1 line-clamp-1">{p.name}</h3>
                          {p.short_pitch && (
                            <p className="text-xs text-gray-400 mb-3 line-clamp-2">{p.short_pitch}</p>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase">Prix</div>
                              <div className="text-white font-semibold">{fmtEur(p.price_eur)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-gray-500 uppercase">Votre part</div>
                              <div className="font-semibold" style={{ color: '#34D399' }}>
                                {((p.commission_pct * p.influencer_pct) / 100).toFixed(1)} %
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </FadeIn>
                  )
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Product drawer/modal ─────────────────────────────────── */}
      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          isFavorite={favorites.has(selectedProduct.id)}
          onClose={() => setSelectedProduct(null)}
          onToggleFavorite={() => toggleFavorite(selectedProduct)}
          isInfluencer={isInfluencer}
        />
      )}
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────

function ProductDrawer({ product, isFavorite, onClose, onToggleFavorite, isInfluencer }: {
  product: Product
  isFavorite: boolean
  onClose: () => void
  onToggleFavorite: () => void
  isInfluencer: boolean
}) {
  const [carouselIdx, setCarouselIdx] = useState(0)
  const meta = CATEGORY_META[product.category] ?? { label: product.category, icon: '✨', color: '#9CA3AF' }
  const images = product.images?.length ? product.images : (product.hero_image_url ? [product.hero_image_url] : [])
  const mainImg = images[carouselIdx] ?? null

  const influencerPart = (product.commission_pct * product.influencer_pct) / 100

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl"
        style={{
          background: '#0D1117',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'drawerIn 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* ── Image carousel ── */}
          <div className="relative min-h-[300px] md:min-h-[500px] flex flex-col" style={{ background: `linear-gradient(135deg, ${meta.color}12, #0D1117)` }}>
            {mainImg ? (
              <div className="flex-1 flex items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainImg} alt={product.name} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-8xl opacity-40">{meta.icon}</div>
            )}
            {images.length > 1 && (
              <div className="flex gap-2 justify-center p-4">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    className="w-8 h-1.5 rounded-full transition-all"
                    style={{ background: i === carouselIdx ? meta.color : 'rgba(255,255,255,0.15)' }}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Details ── */}
          <div className="p-6 md:p-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mb-4"
              style={{ background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}40` }}>
              {meta.icon} {meta.label}
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">{product.name}</h2>
            {product.short_pitch && <p className="text-sm text-gray-400 mb-5">{product.short_pitch}</p>}

            {product.description && (
              <p className="text-sm text-gray-300 leading-relaxed mb-5">{product.description}</p>
            )}

            {/* Benefits */}
            {product.benefits?.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Bénéfices</div>
                <ul className="space-y-1.5">
                  {product.benefits.map((b, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-[#34D399] mt-0.5 shrink-0">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Variants */}
            {product.variants?.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Variantes</div>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <span key={v} className="px-3 py-1 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients */}
            {product.ingredients?.length > 0 && (
              <div className="mb-5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Ingrédients</div>
                <p className="text-xs text-gray-400">{product.ingredients.join(' · ')}</p>
              </div>
            )}

            {/* Origin */}
            {product.origin_country && (
              <div className="mb-5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Origine</div>
                <div className="text-sm text-white">{product.origin_country}</div>
              </div>
            )}

            {/* Price + commission */}
            <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">Prix public</div>
                  <div className="text-xl font-bold text-white">{fmtEur(product.price_eur)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase">Votre commission</div>
                  <div className="text-xl font-bold text-[#34D399]">{influencerPart.toFixed(1)} %</div>
                  <div className="text-[10px] text-gray-500">
                    {fmtEur((product.price_eur * influencerPart) / 100)} / vente
                  </div>
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={onToggleFavorite}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all"
              style={{
                background: isFavorite
                  ? 'rgba(52,211,153,0.15)'
                  : 'linear-gradient(135deg,#A78BFA,#EC4899)',
                color: isFavorite ? '#34D399' : '#07090F',
                border: isFavorite ? '1px solid rgba(52,211,153,0.4)' : 'none',
              }}
            >
              {isFavorite ? '✓ Dans vos favoris' : (isInfluencer ? '⭐ Sauvegarder ce produit' : '⭐ Activer mon accès pour sauvegarder')}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes drawerIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
