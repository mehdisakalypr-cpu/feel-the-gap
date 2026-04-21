/**
 * POST /api/marketplace/subscriptions/checkout
 * Shaka 2026-04-21 — Stripe subscription checkout pour tiers marketplace (starter/growth/pro/unlimited).
 *
 * Body: { tier: 'starter' | 'growth' | 'pro' | 'unlimited' }
 *
 * - Baseline prices: starter €99 / growth €299 / pro €749 / unlimited €1 499 /mo
 * - PPP multiplier frozen at subscription time (loyalty): uses user profile country
 * - Creates inline Stripe price_data (no Stripe Price object maintenance for 195 countries)
 * - Webhook stripe/webhook handles checkout.session.completed → insert marketplace_subscriptions row
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

type Tier = 'starter' | 'growth' | 'pro' | 'unlimited'

const TIER_BASELINE_CENTS: Record<Tier, number> = {
  starter:   9900,    // €99
  growth:    29900,   // €299
  pro:       74900,   // €749
  unlimited: 149900,  // €1 499
}

const TIER_QUOTA: Record<Tier, number> = {
  starter:   3,
  growth:    10,
  pro:       25,
  unlimited: 2_147_483_647,
}

const TIER_LABEL: Record<Tier, string> = {
  starter:   'Marketplace Starter',
  growth:    'Marketplace Growth',
  pro:       'Marketplace Pro',
  unlimited: 'Marketplace Unlimited',
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', redirect: '/auth/login?next=/marketplace/subscriptions' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { tier?: string }
  const tier = body.tier as Tier | undefined
  if (!tier || !(tier in TIER_BASELINE_CENTS)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('REMPLACER')) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Freeze PPP multiplier at signup time (loyalty contract)
  const { data: profile } = await sb
    .from('profiles')
    .select('country, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  let multiplier = 1.0
  if (profile?.country) {
    const { data: country } = await sb
      .from('countries')
      .select('pricing_multiplier')
      .eq('id', profile.country)
      .maybeSingle()
    if (country?.pricing_multiplier) multiplier = Number(country.pricing_multiplier)
  }

  const baseline = TIER_BASELINE_CENTS[tier]
  const adjusted = Math.max(100, Math.round(baseline * multiplier))  // min €1 sanity floor

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const base = new URL('/', req.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    client_reference_id: user.id,
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: adjusted,
        product_data: { name: TIER_LABEL[tier] },
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: {
      product:        'ftg',
      user_id:        user.id,
      kind:           'marketplace_subscription',
      marketplace_tier: tier,
      baseline_cents: String(baseline),
      adjusted_cents: String(adjusted),
      ppp_multiplier: multiplier.toFixed(3),
      country:        profile?.country ?? '',
      quota:          String(TIER_QUOTA[tier]),
    },
    subscription_data: {
      metadata: {
        product:        'ftg',
        user_id:        user.id,
        kind:           'marketplace_subscription',
        marketplace_tier: tier,
        baseline_cents: String(baseline),
        adjusted_cents: String(adjusted),
        ppp_multiplier: multiplier.toFixed(3),
        country:        profile?.country ?? '',
        quota:          String(TIER_QUOTA[tier]),
      },
    },
    success_url: `${base}/marketplace/my-offers?sub=success`,
    cancel_url:  `${base}/marketplace/subscriptions?sub=cancel`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
