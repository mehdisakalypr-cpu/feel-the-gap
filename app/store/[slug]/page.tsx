// © 2025-2026 Feel The Gap — vitrine boutique (hero + featured + categories)

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { ProductCard, type ProductCardData } from '@/components/store-public/ProductCard'
import { loadChrome } from './_chrome'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
}

interface ProductRow {
  id: string
  name: string
  segment: 'b2b' | 'b2c' | 'both'
  price_b2c_ttc_cents: number | null
  price_b2b_ht_cents: number | null
  packaging_type: string
  packaging_unit: string
  packaging_qty: number | null
  stock_qty: number
  stock_unlimited: boolean
  labels: string[] | null
  category_id: string | null
}

interface CategoryRow {
  id: string
  name: string
  slug: string
}

interface MediaRow {
  product_id: string
  url: string
}

function packagingLabel(p: ProductRow): string | null {
  if (p.packaging_type === 'unit') {
    return p.packaging_qty && p.packaging_qty > 1
      ? `Pack de ${p.packaging_qty}`
      : null
  }
  if (p.packaging_qty) {
    return `${p.packaging_qty} ${p.packaging_unit}`
  }
  return null
}

function pickPriceCents(p: ProductRow, segment: 'b2c' | 'b2b'): number {
  if (segment === 'b2b' && p.price_b2b_ht_cents != null) return p.price_b2b_ht_cents
  if (p.price_b2c_ttc_cents != null) return p.price_b2c_ttc_cents
  return p.price_b2b_ht_cents ?? 0
}

export default async function StoreHomePage({ params }: Props) {
  const { slug } = await params
  const { store, user, cartCount } = await loadChrome(slug)
  const sb = await createSupabaseServer()
  const accent = store.primary_color || '#C9A84C'

  // Fetch up to 8 active products (cover photo via separate join), categories
  const [productsRes, categoriesRes] = await Promise.all([
    sb.from('store_products')
      .select('id, name, segment, price_b2c_ttc_cents, price_b2b_ht_cents, packaging_type, packaging_unit, packaging_qty, stock_qty, stock_unlimited, labels, category_id')
      .eq('store_id', store.id)
      .eq('visibility', 'active')
      .order('position', { ascending: true })
      .limit(8),
    sb.from('store_product_categories')
      .select('id, name, slug')
      .eq('store_id', store.id)
      .order('position', { ascending: true })
      .limit(8),
  ])

  const products: ProductRow[] = (productsRes.data ?? []) as ProductRow[]
  const categories: CategoryRow[] = (categoriesRes.data ?? []) as CategoryRow[]

  // Cover media
  const productIds = products.map(p => p.id)
  const coverByProduct = new Map<string, string>()
  if (productIds.length > 0) {
    const { data: media } = await sb
      .from('store_product_media')
      .select('product_id, url, position, is_cover')
      .in('product_id', productIds)
      .eq('type', 'photo')
      .order('is_cover', { ascending: false })
      .order('position', { ascending: true })
    for (const m of (media ?? []) as (MediaRow & { is_cover?: boolean; position?: number })[]) {
      if (!coverByProduct.has(m.product_id)) coverByProduct.set(m.product_id, m.url)
    }
  }

  // Visitor segment heuristic: anonymous defaults to b2c
  const visitorSegment: 'b2c' | 'b2b' = 'b2c'

  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <section
        className="border-b border-white/5 bg-gradient-to-b from-[#0B0F1A] to-[#07090F] px-4 py-16 text-center"
      >
        <div className="mx-auto max-w-3xl">
          {store.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.name} className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-2xl" />
          ) : (
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-[#07090F] shadow-2xl"
              style={{ background: accent }}
            >
              {store.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="mt-6 text-4xl font-bold text-white sm:text-5xl">{store.name}</h1>
          <p className="mt-3 text-base text-gray-400">
            Bienvenue. Découvrez notre sélection et passez commande en quelques clics.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/store/${store.slug}/products`}
              className="rounded-xl px-6 py-3 text-sm font-bold text-[#07090F]"
              style={{ background: accent }}
            >
              Voir le catalogue →
            </Link>
            <Link
              href={`/store/${store.slug}/cart`}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Mon panier
            </Link>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Catégories
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <Link
                key={c.id}
                href={`/store/${store.slug}/products?category=${encodeURIComponent(c.slug)}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:border-[rgba(201,168,76,.4)] hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-bold text-white">Sélection du moment</h2>
          <Link href={`/store/${store.slug}/products`} className="text-sm text-[#C9A84C] hover:underline">
            Tout voir →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-[#0D1117] p-8 text-center text-sm text-gray-500">
            Aucun produit disponible pour le moment. Revenez bientôt !
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map(p => {
              const data: ProductCardData = {
                id: p.id,
                name: p.name,
                cover_url: coverByProduct.get(p.id) ?? null,
                price_cents: pickPriceCents(p, visitorSegment),
                segment: p.segment,
                packaging_label: packagingLabel(p),
                stock_qty: Number(p.stock_qty || 0),
                stock_unlimited: p.stock_unlimited,
                labels: p.labels,
              }
              return <ProductCard key={p.id} storeSlug={store.slug} product={data} accent={accent} />
            })}
          </div>
        )}
      </section>
    </StoreChrome>
  )
}
