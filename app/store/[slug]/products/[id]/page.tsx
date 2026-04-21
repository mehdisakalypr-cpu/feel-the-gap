// © 2025-2026 Feel The Gap — public product detail page

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { ProductGallery, type MediaItem } from '@/components/store-public/ProductGallery'
import { AddToCartButton } from '@/components/store-public/AddToCartButton'
import { fmtMoney } from '@/components/store-public/_lib'
import { loadChrome } from '../../_chrome'
import { resolveSegment } from '../../_segment'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string; id: string }>
  searchParams?: Promise<{ segment?: string }>
}

interface ProductDetail {
  id: string
  store_id: string
  name: string
  description: string | null
  sku: string | null
  ean: string | null
  gtin: string | null
  segment: 'b2b' | 'b2c' | 'both'
  packaging_type: string
  packaging_unit: string
  packaging_qty: number | null
  price_b2b_ht_cents: number | null
  price_b2c_ttc_cents: number | null
  vat_rate_pct: number | null
  stock_qty: number
  stock_unlimited: boolean
  labels: string[] | null
  norms: string[] | null
  legal_docs: { name: string; url: string; mandatory?: boolean }[] | null
}

interface VariantRow {
  id: string
  option_values: Record<string, string>
  price_b2c_ttc_cents: number | null
  price_b2b_ht_cents: number | null
  stock_qty: number
  active: boolean
}

interface MediaRow {
  id: string
  type: 'photo' | 'video'
  url: string
  caption: string | null
  position: number
  is_cover: boolean
}

function packagingFullLabel(p: Pick<ProductDetail, 'packaging_type' | 'packaging_unit' | 'packaging_qty'>): string {
  if (p.packaging_type === 'unit') {
    return p.packaging_qty && p.packaging_qty > 1
      ? `Vendu par ${p.packaging_qty} ${p.packaging_unit}`
      : `Vendu à l'unité (${p.packaging_unit})`
  }
  return `Conditionnement : ${p.packaging_qty ?? ''} ${p.packaging_unit}`
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const sp = (await searchParams) ?? {}
  const { store, user, cartCount } = await loadChrome(slug)
  const sb = await createSupabaseServer()
  const accent = store.primary_color || '#C9A84C'

  const { data } = await sb
    .from('store_products')
    .select('id, store_id, name, description, sku, ean, gtin, segment, packaging_type, packaging_unit, packaging_qty, price_b2b_ht_cents, price_b2c_ttc_cents, vat_rate_pct, stock_qty, stock_unlimited, labels, norms, legal_docs')
    .eq('id', id)
    .eq('store_id', store.id)
    .eq('visibility', 'active')
    .maybeSingle()

  if (!data) notFound()
  const product = data as ProductDetail

  // Shaka 2026-04-21 : segment driven by cookie (set by SegmentGate) with ?segment=… override
  const cookieSegment = await resolveSegment(store)
  const segment: 'b2c' | 'b2b' = sp.segment === 'b2b' ? 'b2b' : sp.segment === 'b2c' ? 'b2c' : cookieSegment
  const showVat = segment === 'b2c'
  const priceCents = segment === 'b2b'
    ? product.price_b2b_ht_cents ?? product.price_b2c_ttc_cents ?? 0
    : product.price_b2c_ttc_cents ?? product.price_b2b_ht_cents ?? 0

  const [mediaRes, variantsRes] = await Promise.all([
    sb.from('store_product_media')
      .select('id, type, url, caption, position, is_cover')
      .eq('product_id', product.id)
      .order('is_cover', { ascending: false })
      .order('position', { ascending: true }),
    sb.from('store_product_variants')
      .select('id, option_values, price_b2c_ttc_cents, price_b2b_ht_cents, stock_qty, active')
      .eq('product_id', product.id)
      .eq('active', true)
      .order('position', { ascending: true }),
  ])

  const media: MediaItem[] = ((mediaRes.data ?? []) as MediaRow[]).map(m => ({
    id: m.id,
    type: m.type,
    url: m.url,
    caption: m.caption,
  }))
  const variants: VariantRow[] = (variantsRes.data ?? []) as VariantRow[]
  const variantOptions = variants.map(v => {
    const label = Object.entries(v.option_values || {})
      .map(([k, val]) => `${k}: ${val}`)
      .join(' · ')
    const price = segment === 'b2b'
      ? v.price_b2b_ht_cents ?? priceCents
      : v.price_b2c_ttc_cents ?? priceCents
    return {
      id: v.id,
      label: `${label || 'Variante'} — ${fmtMoney(price)}`,
      price_cents: price,
      stock_qty: Number(v.stock_qty || 0),
    }
  })

  const inStock = product.stock_unlimited || Number(product.stock_qty || 0) > 0
  const stockBanner = product.stock_unlimited
    ? 'Disponible'
    : Number(product.stock_qty || 0) > 0
      ? `${Number(product.stock_qty || 0)} en stock`
      : 'Rupture de stock'

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
        <Link href={`/store/${store.slug}/products`} className="text-xs text-gray-400 hover:text-white">
          ← Catalogue
        </Link>

        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div>
            <ProductGallery media={media} alt={product.name} />
          </div>
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold text-white">{product.name}</h1>
              {(product.sku || product.ean) && (
                <div className="mt-1 text-[10px] font-mono text-gray-500">
                  {product.sku && <span>SKU {product.sku}</span>}
                  {product.sku && product.ean && <span> · </span>}
                  {product.ean && <span>EAN {product.ean}</span>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-3xl font-bold" style={{ color: accent }}>
                {fmtMoney(priceCents)}
              </div>
              <span className="text-xs text-gray-400">
                {showVat ? `TTC (TVA ${product.vat_rate_pct ?? 20}%)` : 'HT (entreprises)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  inStock ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                }`}
              >
                {stockBanner}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">
                {packagingFullLabel(product)}
              </span>
            </div>

            {product.description && (
              <div className="prose prose-invert max-w-none rounded-2xl border border-white/5 bg-[#0D1117] p-5 text-sm text-gray-200">
                <p className="whitespace-pre-line leading-relaxed">{product.description}</p>
              </div>
            )}

            <AddToCartButton
              storeSlug={store.slug}
              productId={product.id}
              variants={variantOptions.length > 0 ? variantOptions : undefined}
              accent={accent}
              maxQty={product.stock_unlimited ? 9999 : Number(product.stock_qty || 1)}
              unitLabel={product.packaging_unit}
              disabled={!inStock}
            />

            {(product.labels?.length || product.norms?.length) ? (
              <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Labels & Normes
                </h2>
                <div className="flex flex-wrap gap-2">
                  {product.labels?.map(l => (
                    <span key={`label-${l}`} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                      🌿 {l}
                    </span>
                  ))}
                  {product.norms?.map(n => (
                    <span key={`norm-${n}`} className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                      ✓ {n}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {product.legal_docs && product.legal_docs.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Documents légaux
                </h2>
                <ul className="space-y-2 text-sm">
                  {product.legal_docs.map((d, i) => (
                    <li key={i}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-gray-200 hover:text-[#C9A84C] hover:underline"
                      >
                        📄 {d.name}
                        {d.mandatory && <span className="text-[10px] text-amber-400">(obligatoire)</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reviews placeholder (P1) */}
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0D1117]/50 p-5 text-center text-xs text-gray-500">
              ⭐ Avis clients — bientôt disponibles
            </div>
          </div>
        </div>
      </div>
    </StoreChrome>
  )
}
