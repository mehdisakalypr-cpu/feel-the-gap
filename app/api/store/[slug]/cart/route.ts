// © 2025-2026 Feel The Gap — public cart API (GET/POST/PATCH/DELETE)
// Anonymous carts use cookie `ftg_cart_<storeId>`. Authenticated carts use buyer_user_id.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStoreBySlug } from '@/app/store/[slug]/account/_lib/store-auth'
import { ensureCart, readCart, writeItems } from '@/app/store/[slug]/_cart'
import type { CartItem } from '@/components/store-public/_lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

function admin() {
  return createClient(ADMIN_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

interface ProductLookup {
  id: string
  store_id: string
  name: string
  sku: string | null
  segment: 'b2b' | 'b2c' | 'both'
  packaging_type: string
  packaging_unit: string
  packaging_qty: number | null
  price_b2c_ttc_cents: number | null
  price_b2b_ht_cents: number | null
  vat_rate_pct: number | null
  stock_qty: number
  stock_unlimited: boolean
  visibility: string
}

async function fetchProduct(productId: string, storeId: string): Promise<ProductLookup | null> {
  const { data } = await admin()
    .from('store_products')
    .select('id, store_id, name, sku, segment, packaging_type, packaging_unit, packaging_qty, price_b2c_ttc_cents, price_b2b_ht_cents, vat_rate_pct, stock_qty, stock_unlimited, visibility')
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (!data || data.visibility !== 'active') return null
  return data as ProductLookup
}

async function fetchVariant(variantId: string, productId: string) {
  const { data } = await admin()
    .from('store_product_variants')
    .select('id, sku, price_b2c_ttc_cents, price_b2b_ht_cents, stock_qty, active, option_values')
    .eq('id', variantId)
    .eq('product_id', productId)
    .maybeSingle()
  return data
}

async function fetchCoverPhoto(productId: string): Promise<string | null> {
  const { data } = await admin()
    .from('store_product_media')
    .select('url, is_cover, position')
    .eq('product_id', productId)
    .eq('type', 'photo')
    .order('is_cover', { ascending: false })
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.url as string | undefined) ?? null
}

function pickPrice(p: ProductLookup, segment: 'b2b' | 'b2c'): number {
  if (segment === 'b2b' && p.price_b2b_ht_cents != null) return p.price_b2b_ht_cents
  if (p.price_b2c_ttc_cents != null) return p.price_b2c_ttc_cents
  return p.price_b2b_ht_cents ?? 0
}

function packagingLabel(p: Pick<ProductLookup, 'packaging_type' | 'packaging_unit' | 'packaging_qty'>): string | null {
  if (p.packaging_type === 'unit') {
    return p.packaging_qty && p.packaging_qty > 1 ? `Pack de ${p.packaging_qty}` : null
  }
  if (p.packaging_qty) return `${p.packaging_qty} ${p.packaging_unit}`
  return null
}

interface RouteCtx { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })
  const cart = await readCart(store.id).catch(() => null)
  return NextResponse.json({
    cart: cart ? { id: cart.id, items: cart.items, currency: cart.currency } : null,
  })
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })

  let body: { product_id?: string; variant_id?: string | null; qty?: number; segment?: 'b2c' | 'b2b' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  const productId = String(body.product_id || '')
  const variantId = body.variant_id ? String(body.variant_id) : null
  const qty = Math.max(1, Math.min(9999, Math.floor(Number(body.qty || 1))))
  const segment: 'b2b' | 'b2c' = body.segment === 'b2b' ? 'b2b' : 'b2c'
  if (!productId) return NextResponse.json({ error: 'missing_product_id' }, { status: 400 })

  const p = await fetchProduct(productId, store.id)
  if (!p) return NextResponse.json({ error: 'product_not_available' }, { status: 404 })

  let unitPrice = pickPrice(p, segment)
  let resolvedSku = p.sku ?? null
  if (variantId) {
    const v = await fetchVariant(variantId, productId)
    if (!v || !v.active) return NextResponse.json({ error: 'variant_not_available' }, { status: 400 })
    if (segment === 'b2b' && v.price_b2b_ht_cents != null) unitPrice = v.price_b2b_ht_cents
    else if (v.price_b2c_ttc_cents != null) unitPrice = v.price_b2c_ttc_cents
    if (v.sku) resolvedSku = String(v.sku)
  }

  // Stock check (not enforced for unlimited)
  if (!p.stock_unlimited && Number(p.stock_qty || 0) < qty) {
    return NextResponse.json({ error: 'insufficient_stock', available: Number(p.stock_qty || 0) }, { status: 409 })
  }

  const cart = await ensureCart(store.id)
  const items: CartItem[] = [...cart.items]
  const key = `${productId}::${variantId ?? ''}`
  const existing = items.find(it => `${it.product_id}::${it.variant_id ?? ''}` === key)
  if (existing) {
    existing.qty = Math.min(9999, existing.qty + qty)
    existing.unit_price_cents = unitPrice
  } else {
    const cover = await fetchCoverPhoto(productId)
    items.push({
      product_id: productId,
      variant_id: variantId,
      name: p.name,
      sku: resolvedSku,
      unit_price_cents: unitPrice,
      vat_rate_pct: Number(p.vat_rate_pct ?? 20),
      qty,
      image_url: cover,
      packaging_label: packagingLabel(p),
      segment,
    })
  }
  const updated = await writeItems(cart.id, items)
  return NextResponse.json({ ok: true, cart: { id: updated.id, items: updated.items } })
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })
  let body: { product_id?: string; variant_id?: string | null; qty?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  const productId = String(body.product_id || '')
  const variantId = body.variant_id ? String(body.variant_id) : null
  const qty = Math.max(1, Math.min(9999, Math.floor(Number(body.qty || 1))))
  if (!productId) return NextResponse.json({ error: 'missing_product_id' }, { status: 400 })

  const cart = await readCart(store.id)
  if (!cart) return NextResponse.json({ error: 'cart_empty' }, { status: 404 })
  const key = `${productId}::${variantId ?? ''}`
  const items = cart.items.map(it =>
    `${it.product_id}::${it.variant_id ?? ''}` === key ? { ...it, qty } : it,
  )
  const updated = await writeItems(cart.id, items)
  return NextResponse.json({ ok: true, cart: { id: updated.id, items: updated.items } })
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })
  let body: { product_id?: string; variant_id?: string | null } = {}
  try { body = await req.json() } catch { /* allow empty body to clear */ }
  const cart = await readCart(store.id)
  if (!cart) return NextResponse.json({ ok: true, cart: null })

  const productId = body.product_id ? String(body.product_id) : null
  const variantId = body.variant_id ? String(body.variant_id) : null

  let items: CartItem[]
  if (!productId) {
    items = []
  } else {
    const key = `${productId}::${variantId ?? ''}`
    items = cart.items.filter(it => `${it.product_id}::${it.variant_id ?? ''}` !== key)
  }
  const updated = await writeItems(cart.id, items)
  return NextResponse.json({ ok: true, cart: { id: updated.id, items: updated.items } })
}
