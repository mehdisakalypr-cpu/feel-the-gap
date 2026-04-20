// © 2025-2026 Feel The Gap — cron: create Shippo labels for paid orders without labels
//
// Vercel Hobby: daily only. Pour scale, déplacer sur VPS avec tsx runner.
//
// Pick up `store_shipments` with status='pending' WHERE order paid+address ok,
// get best rate, buy label, persist tracking.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getShippoRates, createShippoLabel, shippoConfigured, type ShippoAddress } from '@/lib/shipping/shippo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // allow in dev
  const h = req.headers.get('authorization') || ''
  return h === `Bearer ${secret}`
}

interface PendingShipment {
  id: string
  order_id: string
  store_id: string
  order: {
    id: string
    buyer_email: string | null
    buyer_name: string | null
    buyer_address: Record<string, unknown> | null
  } | null
  store: {
    id: string
    name: string
    shipping_origin: ShippoAddress | null
  } | null
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!shippoConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'shippo_not_configured', processed: 0 })
  }

  const sb = admin()
  const { data: rows, error } = await sb
    .from('store_shipments')
    .select(`
      id, order_id, store_id,
      order:order_id ( id, buyer_email, buyer_name, buyer_address ),
      store:store_id ( id, name, shipping_origin )
    `)
    .eq('status', 'pending')
    .is('label_url', null)
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (rows ?? []) as unknown as PendingShipment[]
  let processed = 0
  let ok = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const s of items) {
    processed++
    const order = s.order
    const store = s.store
    if (!order || !store) { errors.push({ id: s.id, error: 'missing_relations' }); continue }
    const origin = store.shipping_origin
    if (!origin || !origin.street1) { errors.push({ id: s.id, error: 'no_origin' }); continue }

    const addr = (order.buyer_address ?? {}) as Record<string, unknown>
    const toLine1 = typeof addr.line1 === 'string' ? addr.line1 : ''
    const toCity = typeof addr.city === 'string' ? addr.city : ''
    const toZip = typeof addr.postal === 'string' ? addr.postal : ''
    const toCountry = typeof addr.country === 'string' ? addr.country : ''
    if (!toLine1 || !toCity || !toZip || !toCountry) {
      errors.push({ id: s.id, error: 'incomplete_buyer_address' })
      await sb.from('store_shipments').update({ status: 'failed', error_message: 'incomplete_buyer_address' }).eq('id', s.id)
      continue
    }

    const to: ShippoAddress = {
      name: order.buyer_name ?? (typeof addr.full_name === 'string' ? addr.full_name : 'Recipient'),
      company: typeof addr.company === 'string' ? addr.company : null,
      street1: toLine1,
      street2: typeof addr.line2 === 'string' ? addr.line2 : null,
      city: toCity,
      zip: toZip,
      country: toCountry,
      phone: typeof addr.phone === 'string' ? addr.phone : null,
      email: order.buyer_email ?? null,
    }

    const ratesRes = await getShippoRates({ from: origin, to })
    if (!ratesRes.ok || ratesRes.rates.length === 0) {
      errors.push({ id: s.id, error: ratesRes.ok ? 'no_rates' : ratesRes.error })
      await sb.from('store_shipments').update({ status: 'failed', error_message: ratesRes.ok ? 'no_rates' : ratesRes.error }).eq('id', s.id)
      continue
    }
    const cheapest = ratesRes.rates
      .slice()
      .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0]

    const labelRes = await createShippoLabel({ rate_id: cheapest.object_id })
    if (!labelRes.ok) {
      errors.push({ id: s.id, error: labelRes.error })
      await sb.from('store_shipments').update({ status: 'failed', error_message: labelRes.error }).eq('id', s.id)
      continue
    }

    await sb.from('store_shipments').update({
      carrier: cheapest.provider,
      service_code: cheapest.servicelevel.token,
      tracking_number: labelRes.label.tracking_number,
      tracking_url: labelRes.label.tracking_url_provider,
      label_url: labelRes.label.label_url,
      cost_cents: Math.round(parseFloat(cheapest.amount) * 100),
      currency: cheapest.currency,
      shippo_rate_id: cheapest.object_id,
      shippo_shipment_id: ratesRes.shipment_id,
      shippo_transaction_id: labelRes.label.object_id,
      status: 'labeled',
      labeled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', s.id)

    await sb.from('store_orders').update({ shipment_id: s.id }).eq('id', s.order_id)
    ok++
  }

  return NextResponse.json({ ok: true, processed, succeeded: ok, failed: errors.length, errors })
}
