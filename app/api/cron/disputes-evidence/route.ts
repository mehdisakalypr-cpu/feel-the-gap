// © 2025-2026 Feel The Gap — cron: auto-submit Stripe dispute evidence
//
// Picks up `store_fraud_events` rows of type 'charge.dispute.created' in the
// last 14 days that have no companion 'evidence_submitted' row, fetches the
// dispute from Stripe, builds a text-only evidence envelope from the linked
// order + shipment + store CGV, and submits it via stripe.disputes.update.
//
// Idempotency: a marker row (event_type='evidence_submitted', stripe_event_id=
// `evidence_${disputeId}`) is inserted on success, blocking re-submission on
// the next run thanks to the unique stripe_event_id index.
//
// Vercel Hobby: daily cron (06h UTC, before shipments-labels at 07h).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

interface DisputeEventRow {
  id: string
  stripe_event_id: string
  charge_id: string | null
  payment_intent_id: string | null
  raw: Record<string, unknown> | null
  created_at: string
}

function fmtAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return ''
  const a = addr as Record<string, unknown>
  return [a.line1, a.line2, a.postal, a.city, a.country, a.phone]
    .filter(Boolean).join(', ')
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ ok: true, skipped: 'stripe_not_configured', processed: 0 })
  }

  const sb = admin()
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()

  const { data: disputes, error: dErr } = await sb
    .from('store_fraud_events')
    .select('id, stripe_event_id, charge_id, payment_intent_id, raw, created_at')
    .eq('event_type', 'charge.dispute.created')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (dErr) {
    console.error('[disputes-evidence] fetch failed', dErr.message)
    return NextResponse.json({ error: dErr.message }, { status: 500 })
  }

  const rows = (disputes ?? []) as DisputeEventRow[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, candidates: 0 })
  }

  // Filter out disputes that already have a submission marker
  const disputeIds = rows.map(r => {
    const raw = r.raw as Record<string, unknown> | null
    return (raw?.id as string) || ''
  }).filter(Boolean)

  const markerIds = disputeIds.map(id => `evidence_${id}`)
  const { data: markers } = await sb
    .from('store_fraud_events')
    .select('stripe_event_id')
    .in('stripe_event_id', markerIds)
  const submitted = new Set((markers ?? []).map(m => m.stripe_event_id))

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const results: Array<{ dispute_id: string; status: string; reason?: string }> = []

  for (const row of rows) {
    const raw = row.raw as Record<string, unknown> | null
    const disputeId = raw?.id as string | undefined
    if (!disputeId) {
      results.push({ dispute_id: 'unknown', status: 'skipped', reason: 'no_dispute_id' })
      continue
    }
    if (submitted.has(`evidence_${disputeId}`)) {
      results.push({ dispute_id: disputeId, status: 'already_submitted' })
      continue
    }

    try {
      const dispute = await stripe.disputes.retrieve(disputeId)
      if (dispute.status !== 'needs_response' && dispute.status !== 'warning_needs_response') {
        results.push({ dispute_id: disputeId, status: 'skipped', reason: `status_${dispute.status}` })
        continue
      }
      if (dispute.evidence_details?.submission_count && dispute.evidence_details.submission_count > 0) {
        results.push({ dispute_id: disputeId, status: 'skipped', reason: 'evidence_already_submitted' })
        continue
      }

      // Look up order via payment_intent
      const pi = row.payment_intent_id || (typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null)
      if (!pi) {
        results.push({ dispute_id: disputeId, status: 'skipped', reason: 'no_payment_intent' })
        continue
      }

      const { data: order } = await sb
        .from('store_orders')
        .select(`
          id, store_id, buyer_email, buyer_name, buyer_address,
          subtotal_cents, shipping_cents, total_cents, currency,
          stripe_payment_intent, stripe_charge_id, paid_at, created_at,
          store:store_id ( id, name, billing_entity, cgv_version, cgv_signed_at )
        `)
        .eq('stripe_payment_intent', pi)
        .maybeSingle()

      if (!order) {
        results.push({ dispute_id: disputeId, status: 'skipped', reason: 'order_not_found' })
        continue
      }

      const { data: shipment } = await sb
        .from('store_shipments')
        .select('carrier, tracking_number, tracking_url, shipped_at, delivered_at, status')
        .eq('order_id', order.id)
        .maybeSingle()

      const store = (order as unknown as { store: { name: string; billing_entity: Record<string, unknown> | null; cgv_version: string | null; cgv_signed_at: string | null } | null }).store
      const billing = store?.billing_entity ?? {}
      const totalEur = ((order.total_cents ?? 0) / 100).toFixed(2)

      const productDesc = `Order #${order.id} from ${store?.name ?? 'store'} — ${order.currency} ${totalEur} (paid ${order.paid_at ?? order.created_at}).`

      const summary = [
        `Order ${order.id}, store "${store?.name ?? '-'}".`,
        `Total ${order.currency} ${totalEur} (subtotal ${(order.subtotal_cents/100).toFixed(2)}, shipping ${(order.shipping_cents/100).toFixed(2)}).`,
        `Buyer ${order.buyer_name ?? order.buyer_email ?? 'anonymous'}.`,
        `Billing entity: ${(billing as { legal_name?: string }).legal_name ?? '-'}.`,
        store?.cgv_version ? `CGV version ${store.cgv_version}, accepted by buyer at checkout.` : '',
        shipment?.tracking_number ? `Shipment ${shipment.carrier ?? ''} #${shipment.tracking_number}, status ${shipment.status}, shipped ${shipment.shipped_at ?? '-'}, delivered ${shipment.delivered_at ?? '-'}.` : 'No shipment recorded.',
      ].filter(Boolean).join(' ')

      const evidence: Record<string, string> = {
        product_description: productDesc.slice(0, 20000),
        customer_email_address: order.buyer_email ?? '',
        customer_name: order.buyer_name ?? '',
        billing_address: fmtAddress(order.buyer_address).slice(0, 20000),
        uncategorized_text: summary.slice(0, 20000),
      }
      if (shipment?.tracking_number) {
        evidence.shipping_tracking_number = shipment.tracking_number
        if (shipment.carrier) evidence.shipping_carrier = shipment.carrier
        if (shipment.shipped_at) evidence.shipping_date = shipment.shipped_at.slice(0, 10)
        evidence.shipping_address = fmtAddress(order.buyer_address).slice(0, 20000)
      }
      if (store?.cgv_version) {
        evidence.refund_policy_disclosure = `CGV ${store.cgv_version} acceptées au checkout (${store.cgv_signed_at ?? ''}).`
      }

      // Strip empty fields — Stripe rejects empty strings on some fields
      for (const k of Object.keys(evidence)) if (!evidence[k]) delete evidence[k]

      await stripe.disputes.update(disputeId, {
        evidence,
        // Do NOT submit yet — leave submitted=false so the merchant can review.
        // Switch to true once we have human-in-the-loop confirmation.
        submit: false,
      })

      // Idempotency marker
      await sb.from('store_fraud_events').insert({
        stripe_event_id: `evidence_${disputeId}`,
        event_type: 'evidence_submitted',
        payment_intent_id: pi,
        charge_id: row.charge_id,
        reason: dispute.reason,
        amount_cents: dispute.amount,
        currency: (dispute.currency || '').toUpperCase(),
        livemode: dispute.livemode,
        raw: { dispute_id: disputeId, fields: Object.keys(evidence), submitted: false },
      })

      results.push({ dispute_id: disputeId, status: 'evidence_filled' })
    } catch (err) {
      console.error('[disputes-evidence] dispute failed', disputeId, err)
      results.push({ dispute_id: disputeId, status: 'error', reason: (err as Error).message })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
