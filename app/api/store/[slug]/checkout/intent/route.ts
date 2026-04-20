// © 2025-2026 Feel The Gap — checkout intent (creates pending order + Stripe PaymentIntent)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getStoreBySlug } from '@/app/store/[slug]/account/_lib/store-auth'
import { readCart } from '@/app/store/[slug]/_cart'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

function admin() {
  return createClient(ADMIN_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

interface AddressInput {
  full_name: string
  company?: string | null
  line1: string
  line2?: string | null
  postal_code: string
  city: string
  country_iso2: string
  phone?: string | null
}

interface AddressPayload {
  address_id?: string
  draft?: AddressInput
}

interface ResolvedAddress {
  full_name: string
  company: string | null
  line1: string
  line2: string | null
  postal_code: string
  city: string
  country_iso2: string
  phone: string | null
}

async function resolveAddress(payload: AddressPayload | undefined, userId: string | null): Promise<ResolvedAddress | null> {
  if (!payload) return null
  if (payload.address_id && userId) {
    const { data } = await admin()
      .from('store_buyer_addresses')
      .select('full_name, company, line1, line2, postal_code, city, country_iso2, phone, user_id')
      .eq('id', payload.address_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return null
    return {
      full_name: String(data.full_name || ''),
      company: data.company ? String(data.company) : null,
      line1: String(data.line1 || ''),
      line2: data.line2 ? String(data.line2) : null,
      postal_code: String(data.postal_code || ''),
      city: String(data.city || ''),
      country_iso2: String(data.country_iso2 || ''),
      phone: data.phone ? String(data.phone) : null,
    }
  }
  if (payload.draft) {
    const d = payload.draft
    if (!d.full_name || !d.line1 || !d.postal_code || !d.city || !d.country_iso2) return null
    return {
      full_name: d.full_name,
      company: d.company ?? null,
      line1: d.line1,
      line2: d.line2 ?? null,
      postal_code: d.postal_code,
      city: d.city,
      country_iso2: d.country_iso2.toUpperCase().slice(0, 2),
      phone: d.phone ?? null,
    }
  }
  return null
}

interface ShippingRate {
  id: string
  zone_id: string
  price_cents: number
  free_above_cents: number | null
  active: boolean
  store_id?: string
}

async function fetchRate(rateId: string, storeId: string): Promise<ShippingRate | null> {
  const { data } = await admin()
    .from('store_shipping_rates')
    .select('id, zone_id, price_cents, free_above_cents, active, store_shipping_zones!inner(store_id)')
    .eq('id', rateId)
    .eq('active', true)
    .maybeSingle()
  if (!data) return null
  // join produced `store_shipping_zones.store_id` — verify it matches
  const zoneStoreId = ((data as unknown as { store_shipping_zones?: { store_id?: string } }).store_shipping_zones?.store_id) ?? null
  if (zoneStoreId !== storeId) return null
  return {
    id: String(data.id),
    zone_id: String(data.zone_id),
    price_cents: Number(data.price_cents || 0),
    free_above_cents: data.free_above_cents != null ? Number(data.free_above_cents) : null,
    active: !!data.active,
  }
}

interface DiscountRow {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_uses: number | null
  used_count: number
  starts_at: string
  ends_at: string | null
  applies_to: 'cart' | 'products'
  product_ids: string[] | null
  active: boolean
}

async function fetchDiscount(code: string, storeId: string): Promise<DiscountRow | null> {
  if (!code) return null
  const { data } = await admin()
    .from('store_discount_codes')
    .select('id, code, discount_type, discount_value, max_uses, used_count, starts_at, ends_at, applies_to, product_ids, active')
    .eq('store_id', storeId)
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .maybeSingle()
  if (!data) return null
  const now = Date.now()
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return null
  if (data.ends_at && new Date(data.ends_at).getTime() < now) return null
  if (data.max_uses != null && Number(data.used_count || 0) >= Number(data.max_uses)) return null
  return data as DiscountRow
}

interface RouteCtx { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
  }
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })

  let body: {
    email?: string
    shipping?: AddressPayload
    billing?: AddressPayload
    rate_id?: string
    discount_code?: string | null
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  const buyerEmail = (user?.email || body.email || '').trim().toLowerCase()
  if (!buyerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 })
  }

  const cart = await readCart(store.id)
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: 'cart_empty' }, { status: 400 })
  }

  const shipping = await resolveAddress(body.shipping, user?.id ?? null)
  if (!shipping) return NextResponse.json({ error: 'shipping_address_required' }, { status: 400 })
  const billing = await resolveAddress(body.billing, user?.id ?? null) ?? shipping

  // Shipping rate
  let shippingCents = 0
  if (body.rate_id) {
    const rate = await fetchRate(String(body.rate_id), store.id)
    if (!rate) return NextResponse.json({ error: 'invalid_shipping_rate' }, { status: 400 })
    shippingCents = rate.price_cents
    // Free above threshold (computed against subtotal incl. VAT)
    const preShipSubtotal = cart.items.reduce((acc, it) => {
      const line = it.unit_price_cents * it.qty
      const vat = Math.round(line * (it.vat_rate_pct / 100))
      return acc + line + vat
    }, 0)
    if (rate.free_above_cents != null && preShipSubtotal >= rate.free_above_cents) {
      shippingCents = 0
    }
  }

  // Compute totals
  const subtotal = cart.items.reduce((acc, it) => acc + it.unit_price_cents * it.qty, 0)
  const vatTotal = cart.items.reduce(
    (acc, it) => acc + Math.round(it.unit_price_cents * it.qty * (it.vat_rate_pct / 100)),
    0,
  )

  // Discount
  let discountCents = 0
  let discountCode: string | null = null
  let discountSource: DiscountRow | null = null
  if (body.discount_code) {
    discountSource = await fetchDiscount(String(body.discount_code), store.id)
    if (discountSource) {
      const eligibleSubtotal = discountSource.applies_to === 'products' && discountSource.product_ids?.length
        ? cart.items
          .filter(it => discountSource!.product_ids!.includes(it.product_id))
          .reduce((acc, it) => acc + it.unit_price_cents * it.qty, 0)
        : subtotal
      if (discountSource.discount_type === 'percent') {
        discountCents = Math.round(eligibleSubtotal * (Number(discountSource.discount_value) / 100))
      } else {
        // Treat fixed value as cents
        discountCents = Math.min(eligibleSubtotal, Math.round(Number(discountSource.discount_value)))
      }
      if (discountCents > 0) discountCode = discountSource.code
    }
  }

  const totalCents = Math.max(0, subtotal + vatTotal + shippingCents - discountCents)
  if (totalCents < 50) {
    return NextResponse.json({ error: 'total_below_minimum' }, { status: 400 })
  }
  const currency = (cart.currency || 'EUR').toLowerCase()

  // Determine segment from items (mostly homogeneous in practice)
  const segments = new Set(cart.items.map(it => it.segment))
  const orderSegment: 'b2b' | 'b2c' = segments.has('b2b') && !segments.has('b2c') ? 'b2b' : 'b2c'

  // Insert order in `pending`
  const { data: orderInsert, error: orderErr } = await admin()
    .from('store_orders')
    .insert({
      store_id: store.id,
      buyer_user_id: user?.id ?? null,
      buyer_email: buyerEmail,
      buyer_name: shipping.full_name,
      buyer_address: {
        line1: shipping.line1,
        line2: shipping.line2,
        postal: shipping.postal_code,
        city: shipping.city,
        country: shipping.country_iso2,
        phone: shipping.phone,
        company: shipping.company,
        billing,
      },
      subtotal_cents: subtotal,
      discount_cents: discountCents,
      vat_cents: vatTotal,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      currency: currency.toUpperCase(),
      status: 'pending',
      discount_code: discountCode,
      segment: orderSegment,
      notes: null,
    })
    .select('id')
    .single()
  if (orderErr || !orderInsert) {
    console.error('[store-checkout-intent] order insert failed', orderErr)
    return NextResponse.json({ error: 'order_insert_failed', detail: orderErr?.message }, { status: 500 })
  }
  const orderId = String(orderInsert.id)

  // Stripe PaymentIntent
  const stripe = getStripe()
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency,
      // automatic_payment_methods covers card, Apple Pay, Google Pay, Link, etc.
      automatic_payment_methods: { enabled: true },
      receipt_email: buyerEmail,
      description: `Order ${orderId} — ${store.name}`,
      metadata: {
        product: 'ftg-store',
        store_id: store.id,
        store_slug: store.slug,
        order_id: orderId,
        cart_id: cart.id,
        buyer_email: buyerEmail,
        buyer_user_id: user?.id ?? '',
      },
    })
  } catch (err) {
    console.error('[store-checkout-intent] stripe pi failed', err)
    // Mark order as cancelled
    await admin().from('store_orders').update({ status: 'cancelled' }).eq('id', orderId)
    return NextResponse.json({
      error: 'stripe_intent_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    }, { status: 500 })
  }

  await admin()
    .from('store_orders')
    .update({ stripe_payment_intent: paymentIntent.id })
    .eq('id', orderId)

  return NextResponse.json({
    ok: true,
    order_id: orderId,
    client_secret: paymentIntent.client_secret,
    total_cents: totalCents,
    currency: currency.toUpperCase(),
  })
}
