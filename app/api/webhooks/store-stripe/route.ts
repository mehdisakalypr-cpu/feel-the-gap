// © 2025-2026 Feel The Gap — store-specific Stripe webhook
// Sécurisé via STORE_STRIPE_WEBHOOK_SECRET (variable dédiée). Distinct du webhook
// principal FTG : ce handler ne traite que les events portant `metadata.product = 'ftg-store'`.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { confirmFromIntent } from '@/app/store/[slug]/_confirm-helper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

function admin() {
  return createClient(ADMIN_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const ACCEPTED_PRODUCTS = new Set(['ftg-store', 'store', 'ftg_store'])

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Store Stripe webhook actif' })
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret =
    process.env.STORE_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 })
  }

  const StripeMod = (await import('stripe')).default
  const stripe = new StripeMod(stripeKey, { apiVersion: '2025-03-31.basil' })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[store-webhook] signature error', err)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  // Only handle events for the store product. Other events (FTG subscriptions,
  // marketplace, etc.) are routed to their own webhook.
  const obj = event.data.object as { metadata?: Record<string, string> | null }
  const product = (obj?.metadata?.product || '').toLowerCase()
  if (!ACCEPTED_PRODUCTS.has(product)) {
    return NextResponse.json({ received: true, skipped: true, reason: `not store product: ${product || 'none'}` })
  }

  // ── payment_intent.succeeded → confirm order ───────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const storeId = pi.metadata?.store_id
    const orderId = pi.metadata?.order_id
    if (!storeId || !orderId) {
      console.error('[store-webhook] pi.succeeded missing metadata', { id: pi.id })
      return NextResponse.json({ received: true, skipped: 'missing_metadata' })
    }
    const result = await confirmFromIntent({
      storeId,
      paymentIntentId: pi.id,
      orderId,
    })
    if (!result.ok) {
      console.error('[store-webhook] confirm failed', result.error)
      return NextResponse.json({ received: true, error: result.error }, { status: 200 })
    }
    return NextResponse.json({ received: true, ...result })
  }

  // ── payment_intent.payment_failed / canceled → cancel order ────────────
  if (
    event.type === 'payment_intent.payment_failed' ||
    event.type === 'payment_intent.canceled'
  ) {
    const pi = event.data.object as Stripe.PaymentIntent
    const orderId = pi.metadata?.order_id
    if (orderId) {
      await admin()
        .from('store_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('status', 'pending')
    }
    return NextResponse.json({ received: true, action: 'cancelled', order_id: orderId })
  }

  // ── charge.refunded → mark order as refunded + log refund row ──────────
  if (event.type === 'charge.refunded') {
    const ch = event.data.object as Stripe.Charge
    const a = admin()
    // Identify the order via PI metadata or chargeId on order
    let orderId: string | null = (ch.metadata?.order_id as string | undefined) ?? null
    if (!orderId) {
      const { data } = await a
        .from('store_orders')
        .select('id')
        .eq('stripe_charge_id', ch.id)
        .maybeSingle()
      orderId = (data?.id as string | undefined) ?? null
    }
    if (orderId) {
      const isFull = ch.amount_refunded != null && ch.amount_refunded >= (ch.amount ?? 0)
      await a
        .from('store_orders')
        .update({ status: isFull ? 'refunded' : 'paid' })
        .eq('id', orderId)
    }
    return NextResponse.json({ received: true, action: 'refund', order_id: orderId })
  }

  return NextResponse.json({ received: true, event: event.type, action: 'ignored' })
}
