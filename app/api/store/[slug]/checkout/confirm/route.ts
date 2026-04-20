// © 2025-2026 Feel The Gap — manual order confirmation (best-effort, used by success page)

import { NextRequest, NextResponse } from 'next/server'
import { getStoreBySlug } from '@/app/store/[slug]/account/_lib/store-auth'
import { confirmFromIntent } from '@/app/store/[slug]/_confirm-helper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteCtx { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params
  const store = await getStoreBySlug(slug)
  if (!store) return NextResponse.json({ error: 'store_not_found' }, { status: 404 })
  let body: { payment_intent_id?: string; order_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!body.payment_intent_id || !body.order_id) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  const result = await confirmFromIntent({
    storeId: store.id,
    paymentIntentId: String(body.payment_intent_id),
    orderId: String(body.order_id),
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
