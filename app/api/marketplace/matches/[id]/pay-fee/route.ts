/**
 * POST /api/marketplace/matches/[id]/pay-fee
 * Shaka 2026-04-21 — Stripe one-shot checkout pour la commission marketplace (pay-per-act).
 *
 * Déclenché quand status='confirmed' (les 2 parties ont accepté). Le buyer paie la commission
 * pricing_tier_fee_eur (déjà calculée + ajustée PPP dans decide/route.ts).
 *
 * Si buyer a un abonnement marketplace actif + quota restant → on consomme le quota (pas de Stripe)
 * et on marque direct le match paid + identities_revealed_at.
 * Sinon → on redirige vers Stripe Checkout one-shot.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', redirect: '/auth/login' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Load match with buyer verification
  const { data: match, error: loadErr } = await sb
    .from('marketplace_matches')
    .select(`
      id, status, pricing_tier_fee_eur, pricing_tier_label, proposed_total_eur,
      demand_id, volume_id,
      buyer_demands!inner(buyer_id, delivery_country_iso)
    `)
    .eq('id', id)
    .maybeSingle()
  if (loadErr || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const buyer = match.buyer_demands as unknown as { buyer_id: string; delivery_country_iso: string | null } | null
  if (!buyer || buyer.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Only the buyer can pay the commission' }, { status: 403 })
  }
  if (match.status !== 'confirmed') {
    return NextResponse.json({ error: `Match is ${match.status}, expected confirmed` }, { status: 409 })
  }
  const feeCents = match.pricing_tier_fee_eur
  if (!feeCents || feeCents <= 0) {
    return NextResponse.json({ error: 'Fee not calculated — try reloading the match' }, { status: 400 })
  }

  // ── Check active marketplace subscription with quota remaining ───────────
  const { data: billing } = await sb
    .rpc('marketplace_billing_mode' as never, { user_id: user.id }) as { data: Array<{ mode: string; subscription_id: string | null; quota_remaining: number }> | null }
  const sub = billing?.[0]

  if (sub?.mode === 'subscription' && sub.subscription_id && sub.quota_remaining > 0) {
    // Consume quota + mark paid inline
    const now = new Date().toISOString()
    await sb
      .from('marketplace_subscriptions')
      .update({ matches_used_this_period: (await sb.from('marketplace_subscriptions').select('matches_used_this_period').eq('id', sub.subscription_id).single()).data?.matches_used_this_period + 1, updated_at: now })
      .eq('id', sub.subscription_id)

    await sb
      .from('marketplace_matches')
      .update({
        status: 'paid',
        identities_revealed_at: now,
      })
      .eq('id', id)

    // Track revenue (€0 for subscription consumption — already charged in abo)
    await sb.from('revenue_events').upsert({
      id: `mp_fee_sub_${id}`,
      product: 'feel-the-gap',
      event_type: 'marketplace_fee_subscription_consumed',
      user_id: user.id,
      amount_eur: 0,
      metadata: { match_id: id, subscription_id: sub.subscription_id, tier_label: match.pricing_tier_label },
      created_at: now,
    }, { onConflict: 'id', ignoreDuplicates: true })

    return NextResponse.json({
      ok: true,
      mode: 'subscription',
      subscription_id: sub.subscription_id,
      quota_remaining_after: sub.quota_remaining - 1,
      redirect: `/marketplace/my-offers?paid=${id}`,
    })
  }

  // ── Pay-per-act → Stripe Checkout one-shot ────────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('REMPLACER')) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
  const base = new URL('/', req.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: feeCents,
        product_data: {
          name: `Marketplace fee — ${match.pricing_tier_label ?? 'Tier'}`,
          description: `Commission pour déverrouiller les identités du match #${id.slice(0, 8)} (volume transaction €${Number(match.proposed_total_eur ?? 0).toLocaleString('fr-FR')})`,
        },
      },
      quantity: 1,
    }],
    metadata: {
      product:        'ftg',
      user_id:        user.id,
      kind:           'marketplace_fee',
      match_id:       id,
      fee_cents:      String(feeCents),
      country:        buyer.delivery_country_iso ?? '',
      tier_label:     match.pricing_tier_label ?? '',
    },
    payment_intent_data: {
      metadata: {
        product:  'ftg',
        user_id:  user.id,
        kind:     'marketplace_fee',
        match_id: id,
      },
    },
    success_url: `${base}/marketplace/my-offers?paid=${id}`,
    cancel_url:  `${base}/marketplace/my-offers?cancel=${id}`,
  })

  return NextResponse.json({ url: session.url, mode: 'pay_per_act' })
}
