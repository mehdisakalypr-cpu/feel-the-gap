// © 2025-2026 Feel The Gap — dynamic shipping quote (Shippo live rates)

import { NextRequest, NextResponse } from 'next/server'
import { getShippoRates, shippoConfigured, type ShippoAddress, type ShippoParcel } from '@/lib/shipping/shippo'
import { getStoreBySlug } from '@/app/store/[slug]/account/_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteCtx { params: Promise<{ slug: string }> }

interface QuoteBody {
  to: {
    name: string
    company?: string | null
    line1: string
    line2?: string | null
    postal_code: string
    city: string
    state?: string | null
    country_iso2: string
    phone?: string | null
  }
  parcel?: ShippoParcel
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  if (!shippoConfigured()) {
    return NextResponse.json({ ok: false, stub: true, error: 'shippo_not_configured', rates: [] }, { status: 200 })
  }
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })

  const origin = (store as { shipping_origin?: unknown }).shipping_origin as ShippoAddress | null
  if (!origin || !origin.street1 || !origin.city || !origin.country) {
    return NextResponse.json({ ok: false, error: 'shipping_origin_missing', rates: [] }, { status: 200 })
  }

  let body: QuoteBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!body.to?.line1 || !body.to.city || !body.to.postal_code || !body.to.country_iso2) {
    return NextResponse.json({ error: 'invalid_to_address' }, { status: 400 })
  }

  const to: ShippoAddress = {
    name: body.to.name,
    company: body.to.company ?? null,
    street1: body.to.line1,
    street2: body.to.line2 ?? null,
    city: body.to.city,
    state: body.to.state ?? null,
    zip: body.to.postal_code,
    country: body.to.country_iso2.toUpperCase(),
    phone: body.to.phone ?? null,
  }

  const r = await getShippoRates({ from: origin, to, parcel: body.parcel })
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error, rates: [] }, { status: 200 })

  const rates = r.rates
    .map(rt => ({
      rate_id: rt.object_id,
      carrier: rt.provider,
      service: rt.servicelevel.name,
      service_code: rt.servicelevel.token,
      price_cents: Math.round(parseFloat(rt.amount) * 100),
      currency: rt.currency,
      estimated_days: rt.estimated_days,
      duration_terms: rt.duration_terms,
    }))
    .sort((a, b) => a.price_cents - b.price_cents)

  return NextResponse.json({ ok: true, shipment_id: r.shipment_id, rates })
}
