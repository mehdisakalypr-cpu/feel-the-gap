// © 2025-2026 Feel The Gap — public products grid + filters

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { ProductCard, type ProductCardData } from '@/components/store-public/ProductCard'
import { loadChrome } from '../_chrome'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{
    category?: string
    q?: string
    min?: string
    max?: string
    segment?: string
    in_stock?: string
  }>
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

function packagingLabel(p: ProductRow): string | null {
  if (p.packaging_type === 'unit') {
    return p.packaging_qty && p.packaging_qty > 1 ? `Pack de ${p.packaging_qty}` : null
  }
  if (p.packaging_qty) return `${p.packaging_qty} ${p.packaging_unit}`
  return null
}

function pickPriceCents(p: ProductRow, segment: 'b2c' | 'b2b'): number {
  if (segment === 'b2b' && p.price_b2b_ht_cents != null) return p.price_b2b_ht_cents
  if (p.price_b2c_ttc_cents != null) return p.price_b2c_ttc_cents
  return p.price_b2b_ht_cents ?? 0
}

export default async function ProductsListPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const { store, user, cartCount } = await loadChrome(slug)
  const sb = await createSupabaseServer()
  const accent = store.primary_color || '#C9A84C'

  const segment: 'b2c' | 'b2b' = sp.segment === 'b2b' ? 'b2b' : 'b2c'
  const minCents = sp.min ? Math.max(0, Math.round(Number(sp.min) * 100)) : null
  const maxCents = sp.max ? Math.max(0, Math.round(Number(sp.max) * 100)) : null
  const inStockOnly = sp.in_stock === '1'
  const search = (sp.q ?? '').trim().slice(0, 80)
  const catSlug = (sp.category ?? '').trim().slice(0, 80)

  // Resolve category id from slug
  let categoryId: string | null = null
  if (catSlug) {
    const { data: cat } = await sb
      .from('store_product_categories')
      .select('id')
      .eq('store_id', store.id)
      .eq('slug', catSlug)
      .maybeSingle()
    categoryId = cat ? String(cat.id) : null
  }

  // Build query
  let q = sb.from('store_products')
    .select('id, name, segment, price_b2c_ttc_cents, price_b2b_ht_cents, packaging_type, packaging_unit, packaging_qty, stock_qty, stock_unlimited, labels, category_id')
    .eq('store_id', store.id)
    .eq('visibility', 'active')
    .order('position', { ascending: true })
    .limit(60)
  if (categoryId) q = q.eq('category_id', categoryId)
  if (search) q = q.ilike('name', `%${search}%`)
  if (segment === 'b2b') q = q.in('segment', ['b2b', 'both'])
  else q = q.in('segment', ['b2c', 'both'])

  const { data: rawProducts } = await q
  let products: ProductRow[] = (rawProducts ?? []) as ProductRow[]

  // Filter by price + stock client-side (price column depends on segment)
  products = products.filter(p => {
    const price = pickPriceCents(p, segment)
    if (minCents != null && price < minCents) return false
    if (maxCents != null && price > maxCents) return false
    if (inStockOnly && !p.stock_unlimited && Number(p.stock_qty || 0) <= 0) return false
    return true
  })

  // Categories sidebar
  const { data: categoriesData } = await sb
    .from('store_product_categories')
    .select('id, name, slug')
    .eq('store_id', store.id)
    .order('position', { ascending: true })
    .limit(40)
  const categories: CategoryRow[] = (categoriesData ?? []) as CategoryRow[]

  // Cover photos
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
    for (const m of (media ?? []) as { product_id: string; url: string }[]) {
      if (!coverByProduct.has(m.product_id)) coverByProduct.set(m.product_id, m.url)
    }
  }

  const allowB2B = store.billing_entity ? true : true // any visitor may see B2B if mode_b2b enabled — placeholder
  void allowB2B

  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Catalogue</h1>
          <p className="mt-1 text-sm text-gray-400">{products.length} produit{products.length > 1 ? 's' : ''}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <form method="get" className="space-y-4 rounded-2xl border border-white/5 bg-[#0D1117] p-4 text-sm">
              <div>
                <label htmlFor="q" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Recherche</label>
                <input
                  id="q"
                  name="q"
                  defaultValue={search}
                  placeholder="Nom du produit"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="min" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Min €</label>
                  <input id="min" name="min" type="number" step="0.01" defaultValue={sp.min ?? ''} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white focus:border-[#C9A84C] focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="max" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Max €</label>
                  <input id="max" name="max" type="number" step="0.01" defaultValue={sp.max ?? ''} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white focus:border-[#C9A84C] focus:outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="segment" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Segment</label>
                <select id="segment" name="segment" defaultValue={segment} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-1.5 text-xs text-white focus:border-[#C9A84C] focus:outline-none">
                  <option value="b2c">Particulier (TTC)</option>
                  <option value="b2b">Professionnel (HT)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" name="in_stock" value="1" defaultChecked={inStockOnly} className="rounded border-white/10 bg-[#111827]" />
                En stock uniquement
              </label>
              {catSlug && <input type="hidden" name="category" value={catSlug} />}
              <button type="submit" className="w-full rounded-lg bg-[#C9A84C] px-3 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A]">
                Filtrer
              </button>
            </form>

            {categories.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Catégories</div>
                <ul className="space-y-1 text-sm">
                  <li>
                    <Link
                      href={`/store/${store.slug}/products`}
                      className={`block rounded-md px-2 py-1.5 ${!catSlug ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                    >
                      Toutes
                    </Link>
                  </li>
                  {categories.map(c => (
                    <li key={c.id}>
                      <Link
                        href={`/store/${store.slug}/products?category=${encodeURIComponent(c.slug)}`}
                        className={`block rounded-md px-2 py-1.5 ${catSlug === c.slug ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <section>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-8 text-center text-sm text-gray-500">
                Aucun produit ne correspond à ces critères.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {products.map(p => {
                  const data: ProductCardData = {
                    id: p.id,
                    name: p.name,
                    cover_url: coverByProduct.get(p.id) ?? null,
                    price_cents: pickPriceCents(p, segment),
                    segment: p.segment,
                    packaging_label: packagingLabel(p),
                    stock_qty: Number(p.stock_qty || 0),
                    stock_unlimited: p.stock_unlimited,
                    labels: p.labels,
                  }
                  return <ProductCard key={p.id} storeSlug={store.slug} product={data} accent={accent} showSegment />
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </StoreChrome>
  )
}
