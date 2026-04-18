import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, stripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketplace/[id]/escrow/release
 * Buyer confirme POD (proof of delivery) → capture le PI → fonds transférés au
 * producer (application_fee encaissée par FTG sur le même call).
 *
 * Body: { pod_notes?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (!stripeConfigured()) {
    return NextResponse.json({
      error: 'stripe_not_configured',
      message: 'Stripe live non activé. Endpoint prêt — s\'activera quand STRIPE_SECRET_KEY sera défini.',
    }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const podNotes: string | null = typeof body?.pod_notes === 'string' ? body.pod_notes.slice(0, 2000) : null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: match, error } = await admin
    .from('marketplace_matches')
    .select(`
      id, stripe_payment_intent_id, escrow_status,
      demand:demand_id (buyer_id)
    `)
    .eq('id', id)
    .single()

  if (error || !match) return NextResponse.json({ error: 'match_not_found' }, { status: 404 })

  const demand = match.demand as unknown as { buyer_id: string } | null
  if (demand?.buyer_id !== user.id) {
    return NextResponse.json({ error: 'forbidden', message: 'Seul l\'acheteur confirme le POD.' }, { status: 403 })
  }

  if (match.escrow_status !== 'pending_capture' || !match.stripe_payment_intent_id) {
    return NextResponse.json({
      error: 'escrow_not_pending',
      message: `Escrow au statut '${match.escrow_status}' — impossible de release.`,
    }, { status: 409 })
  }

  const stripe = getStripe()
  const captured = await stripe.paymentIntents.capture(match.stripe_payment_intent_id)

  const { error: updateErr } = await admin
    .from('marketplace_matches')
    .update({
      escrow_status: captured.status === 'succeeded' ? 'released' : 'failed',
      escrow_released_at: captured.status === 'succeeded' ? new Date().toISOString() : null,
      pod_confirmed_at: new Date().toISOString(),
      pod_notes: podNotes,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[escrow/release] DB update failed post-capture:', updateErr.message, 'PI:', captured.id)
  }

  return NextResponse.json({
    ok: captured.status === 'succeeded',
    stripe_payment_intent_id: captured.id,
    capture_status: captured.status,
    amount_released_eur: captured.amount_received / 100,
    commission_collected_eur: (captured.application_fee_amount ?? 0) / 100,
  })
}
