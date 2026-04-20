// © 2025-2026 Feel The Gap — refund partial / total (Stripe + log)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'
import { getStripe, stripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

interface RefundBody {
  amount_cents?: number
  reason?: string | null
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id: orderId } = await params

  const sb = await createSupabaseServer()
  const { data: order } = await sb
    .from('store_orders')
    .select('id, store_id, total_cents, status, stripe_payment_intent, stripe_charge_id, currency')
    .eq('id', orderId)
    .eq('store_id', auth.storeId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!['paid', 'fulfilled', 'refunded'].includes(String(order.status))) {
    return NextResponse.json({ error: 'invalid_status', message: 'Commande non remboursable' }, { status: 400 })
  }

  let body: RefundBody = {}
  try { body = (await req.json()) as RefundBody } catch { /* body optionnel */ }

  // Compute remaining refundable
  const { data: prevRefunds } = await sb
    .from('store_refunds')
    .select('amount_cents, status')
    .eq('order_id', orderId)
  const refunded = (prevRefunds ?? []).filter(r => r.status === 'succeeded').reduce((s, r) => s + Number(r.amount_cents), 0)
  const refundable = Math.max(0, Number(order.total_cents) - refunded)
  const amount = Math.min(refundable, body.amount_cents ?? refundable)

  if (amount <= 0) return NextResponse.json({ error: 'nothing_refundable' }, { status: 400 })

  const refundType: 'partial' | 'total' = amount === refundable && refunded === 0 ? 'total' : 'partial'

  let stripeRefundId: string | null = null
  let stripeStatus: 'succeeded' | 'failed' | 'pending' = 'pending'

  if (stripeConfigured() && order.stripe_payment_intent) {
    try {
      const stripe = getStripe()
      const refund = await stripe.refunds.create({
        payment_intent: String(order.stripe_payment_intent),
        amount,
        reason: 'requested_by_customer',
      })
      stripeRefundId = refund.id
      stripeStatus = (refund.status as 'succeeded' | 'failed' | 'pending') ?? 'pending'
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'stripe_error'
      // Persist failed attempt for audit
      await sb.from('store_refunds').insert({
        order_id: orderId,
        amount_cents: amount,
        type: refundType,
        reason: body.reason ?? null,
        stripe_refund_id: null,
        status: 'failed',
        created_by: auth.user.id,
      })
      return NextResponse.json({ error: 'stripe_failed', message }, { status: 502 })
    }
  } else {
    // Mode degraded : log refund as succeeded but with no stripe id (test/no-stripe env)
    stripeStatus = stripeConfigured() ? 'pending' : 'succeeded'
  }

  const { data: refundRow, error: insErr } = await sb
    .from('store_refunds')
    .insert({
      order_id: orderId,
      amount_cents: amount,
      type: refundType,
      reason: body.reason ?? null,
      stripe_refund_id: stripeRefundId,
      status: stripeStatus,
      created_by: auth.user.id,
      processed_at: stripeStatus === 'succeeded' ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (insErr) return NextResponse.json({ error: 'db_failed', message: insErr.message }, { status: 500 })

  // Update order status only when full refund processed succeeded
  if (stripeStatus === 'succeeded') {
    const newRefunded = refunded + amount
    if (newRefunded >= Number(order.total_cents)) {
      await sb.from('store_orders').update({ status: 'refunded' }).eq('id', orderId)
    }
  }

  return NextResponse.json({ refund: refundRow })
}
