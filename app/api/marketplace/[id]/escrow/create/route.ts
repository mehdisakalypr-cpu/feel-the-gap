import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, stripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketplace/[id]/escrow/create
 * Buyer déclenche l'escrow sur un match confirmé (producer_accept + buyer_accept).
 *
 * Crée un Stripe PaymentIntent avec :
 * - amount = proposed_total_eur × 100 (cents)
 * - application_fee_amount = commission_amount_eur × 100
 * - capture_method = 'manual' (fonds en hold jusqu'à POD)
 * - transfer_data.destination = producer.stripe_connect_account_id
 * - metadata = { match_id, producer_id, buyer_id, product_slug }
 *
 * Sauvegarde stripe_payment_intent_id + escrow_status='pending_capture'.
 * Retourne le client_secret pour que le buyer valide le paiement côté client.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (!stripeConfigured()) {
    return NextResponse.json({
      error: 'stripe_not_configured',
      message: 'Stripe live non activé (bloqué par LLC Wyoming). Endpoint prêt — s\'activera quand STRIPE_SECRET_KEY sera défini.',
    }, { status: 503 })
  }

  // Service-role client pour lire volume/demand/profiles sans RLS conflict
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: match, error: matchErr } = await admin
    .from('marketplace_matches')
    .select(`
      id, status, proposed_total_eur, commission_amount_eur,
      stripe_payment_intent_id, escrow_status,
      volume_id, demand_id,
      volume:volume_id (producer_id, product_slug, country_iso),
      demand:demand_id (buyer_id)
    `)
    .eq('id', id)
    .single()

  if (matchErr || !match) return NextResponse.json({ error: 'match_not_found' }, { status: 404 })

  const volume = match.volume as unknown as { producer_id: string; product_slug: string; country_iso: string } | null
  const demand = match.demand as unknown as { buyer_id: string } | null
  if (!volume || !demand) return NextResponse.json({ error: 'match_invalid' }, { status: 500 })

  // Seul le buyer peut déclencher l'escrow
  if (demand.buyer_id !== user.id) {
    return NextResponse.json({ error: 'forbidden', message: 'Seul l\'acheteur du match peut initier l\'escrow.' }, { status: 403 })
  }

  if (match.status !== 'confirmed') {
    return NextResponse.json({
      error: 'match_not_confirmed',
      message: `Match doit être 'confirmed' (actuellement '${match.status}'). Producer et buyer doivent avoir accepté d'abord.`,
    }, { status: 409 })
  }

  if (match.escrow_status !== 'not_initiated' || match.stripe_payment_intent_id) {
    return NextResponse.json({
      error: 'escrow_already_initiated',
      message: `Escrow déjà au statut '${match.escrow_status}'.`,
      stripe_payment_intent_id: match.stripe_payment_intent_id,
    }, { status: 409 })
  }

  // Récupère le stripe_connect_account_id du producer
  const { data: producerProfile } = await admin
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_charges_enabled')
    .eq('id', volume.producer_id)
    .single()

  if (!producerProfile?.stripe_connect_account_id) {
    return NextResponse.json({
      error: 'producer_not_onboarded',
      message: 'Le producteur doit compléter son onboarding Stripe Connect avant qu\'un escrow puisse être initié.',
      next_step: `/api/stripe/connect/onboarding-link`,
    }, { status: 409 })
  }
  if (!producerProfile.stripe_connect_charges_enabled) {
    return NextResponse.json({
      error: 'producer_charges_disabled',
      message: 'Compte Stripe Connect producteur en attente de vérification (KYC).',
    }, { status: 409 })
  }

  const stripe = getStripe()
  const amount = Math.round(Number(match.proposed_total_eur) * 100)
  const commission = Math.round(Number(match.commission_amount_eur) * 100)

  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'eur',
    capture_method: 'manual',
    application_fee_amount: commission,
    transfer_data: { destination: producerProfile.stripe_connect_account_id },
    on_behalf_of: producerProfile.stripe_connect_account_id,
    metadata: {
      match_id: id,
      producer_id: volume.producer_id,
      buyer_id: demand.buyer_id,
      product_slug: volume.product_slug,
      country_iso: volume.country_iso,
    },
    description: `FTG marketplace escrow · match ${id.slice(0, 8)} · ${volume.product_slug} · ${volume.country_iso}`,
  })

  const { error: updateErr } = await admin
    .from('marketplace_matches')
    .update({
      stripe_payment_intent_id: pi.id,
      escrow_status: 'pending_capture',
      escrow_initiated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    // PI créé en Stripe mais DB update failed → log and return client_secret quand même
    console.error('[escrow/create] DB update failed post-PI:', updateErr.message, 'PI:', pi.id)
  }

  return NextResponse.json({
    ok: true,
    stripe_payment_intent_id: pi.id,
    client_secret: pi.client_secret,
    amount_eur: amount / 100,
    commission_eur: commission / 100,
    status: 'pending_capture',
  })
}
