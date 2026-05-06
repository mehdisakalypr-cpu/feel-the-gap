import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'
import { detectCountryFromHeaders, getGeoPrice } from '@/lib/geo-pricing'
import { PLAN_PRICE_EUR } from '@/lib/credits/costs'

/**
 * GET /api/stripe/checkout?plan=solo_producer|starter|strategy|premium|ultimate[&cc=XX]  → subscription checkout
 * GET /api/stripe/checkout?pack=10|20|30|50              → one-shot credit pack
 *
 * Redirects to Stripe hosted checkout or to /auth/login if not authenticated.
 *
 * Geo-pricing: when a subscription plan is requested, the handler applies the
 * PPP multiplier (from lib/geo-pricing.ts). If the adjusted price matches the
 * EU baseline, the canonical Stripe Price ID is used. Otherwise the session is
 * created with an inline price_data describing the geo-adjusted unit_amount so
 * we don't have to maintain ~195 × 2 Stripe Price objects.
 */
const PRICE_IDS: Record<string, string | undefined> = {
  plan_solo_producer: process.env.STRIPE_PRICE_SOLO_PRODUCER_MONTHLY,
  plan_starter:  process.env.STRIPE_PRICE_STARTER_MONTHLY,
  plan_strategy: process.env.STRIPE_PRICE_STRATEGY_MONTHLY,
  plan_premium:  process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  plan_ultimate: process.env.STRIPE_PRICE_ULTIMATE_MONTHLY,
  pack_10: process.env.STRIPE_PRICE_PACK_10,
  pack_20: process.env.STRIPE_PRICE_PACK_20,
  pack_30: process.env.STRIPE_PRICE_PACK_30,
  pack_50: process.env.STRIPE_PRICE_PACK_50,
}

const PLAN_PRODUCT_IDS: Record<string, string | undefined> = {
  solo_producer: process.env.STRIPE_PRODUCT_SOLO_PRODUCER,
  starter:  process.env.STRIPE_PRODUCT_STARTER,
  strategy: process.env.STRIPE_PRODUCT_STRATEGY,
  premium:  process.env.STRIPE_PRODUCT_PREMIUM,
  ultimate: process.env.STRIPE_PRODUCT_ULTIMATE,
}

const PLAN_BASE_EUR: Record<string, number> = {
  solo_producer: PLAN_PRICE_EUR.solo_producer,
  starter:  PLAN_PRICE_EUR.starter,
  strategy: PLAN_PRICE_EUR.strategy,
  premium:  PLAN_PRICE_EUR.premium,
  ultimate: PLAN_PRICE_EUR.ultimate,
}

export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get('plan')
  const pack = req.nextUrl.searchParams.get('pack')
  const key = plan ? `plan_${plan}` : pack ? `pack_${pack}` : null
  if (!key || !(key in PRICE_IDS)) {
    return NextResponse.redirect(new URL('/pricing?err=invalid', req.url))
  }
  const priceId = PRICE_IDS[key]

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const stripeReady = stripeKey && !stripeKey.includes('REMPLACER') && !!priceId
  if (!stripeReady) {
    const wlUrl = new URL('/waitlist', req.url)
    if (plan) wlUrl.searchParams.set('plan', plan)
    if (pack) wlUrl.searchParams.set('pack', pack)
    return NextResponse.redirect(wlUrl)
  }

  const user = await getAuthUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?next=/api/stripe/checkout?${req.nextUrl.searchParams.toString()}`, req.url))
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const base = new URL('/', req.url).origin
  const isPack = !!pack

  // Geo-pricing: resolve country for subscription plans.
  const ccParam = req.nextUrl.searchParams.get('cc')
  const detectedCC = ccParam ?? detectCountryFromHeaders(req.headers)
  let geoMultiplier = 1
  let geoCountry = 'XX'
  let lineItem: { price: string; quantity: 1 } | {
    price_data: {
      currency: string
      unit_amount: number
      product: string
      recurring: { interval: 'month' }
    }
    quantity: 1
  } = { price: priceId, quantity: 1 }

  if (!isPack && plan && plan in PLAN_BASE_EUR) {
    const baseEUR = PLAN_BASE_EUR[plan]
    const gp = getGeoPrice(baseEUR, detectedCC)
    geoMultiplier = gp.multiplier
    geoCountry = gp.countryCode
    // Only build inline price_data when we actually diverge from the baseline
    // AND we have a Stripe product mapped (otherwise keep the fixed priceId).
    const productId = PLAN_PRODUCT_IDS[plan]
    if (gp.multiplier !== 1 && productId) {
      lineItem = {
        price_data: {
          currency: 'eur',
          unit_amount: gp.price * 100, // cents
          product: productId,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: isPack ? 'payment' : 'subscription',
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      product: 'ftg',                      // cross-product webhook routing guard
      user_id: user.id,
      kind: isPack ? 'credit_pack' : 'subscription',
      pack_size: pack ?? '',
      plan: plan ?? '',
      geo_country: geoCountry,
      geo_multiplier: geoMultiplier.toFixed(3),
    },
    ...(isPack ? {} : {
      subscription_data: {
        metadata: {
          product: 'ftg',
          user_id: user.id,
          kind: 'subscription',
          plan: plan ?? '',
          geo_country: geoCountry,
          geo_multiplier: geoMultiplier.toFixed(3),
        },
      },
    }),
    line_items: [lineItem],
    success_url: `${base}/pricing?success=1`,
    cancel_url: `${base}/pricing?cancel=1`,
    allow_promotion_codes: true,
  })
  return NextResponse.redirect(session.url ?? `${base}/pricing`, { status: 303 })
}


export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, successUrl, cancelUrl, planLabel } = await req.json()
    // Use authenticated user instead of trusting client-supplied userId/email
    const userId = user.id
    const userEmail = user.email

    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('REMPLACER')) {
      return NextResponse.json({ url: '/pricing' })
    }

    // Récupérer le stripe_customer_id existant si l'utilisateur est connu
    let stripeCustomerId: string | undefined
    let referrerId: string | null = null
    let referralCode: string | null = null
    if (userId) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
      const { data: profile } = await sb
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
      stripeCustomerId = profile?.stripe_customer_id ?? undefined

      // Lookup pending referral for this referee (signed_up, not yet converted)
      const { data: ref } = await sb
        .from('user_referrals')
        .select('referrer_id, code, status')
        .eq('referee_id', userId)
        .in('status', ['signed_up', 'clicked'])
        .maybeSingle()
      if (ref) {
        referrerId = ref.referrer_id
        referralCode = ref.code
      }
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Lier au client existant ou créer avec l'email
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: userEmail }),
      // Métadonnées pour le webhook
      metadata: {
        product:    'ftg',                 // cross-product webhook routing guard
        user_id:    userId    ?? '',
        user_email: userEmail ?? '',
        plan_label: planLabel ?? '',
        ...(referrerId    ? { referrer_id: referrerId }   : {}),
        ...(referralCode  ? { referral_code: referralCode } : {}),
      },
      subscription_data: {
        metadata: {
          product:    'ftg',
          user_id:    userId    ?? '',
          user_email: userEmail ?? '',
          plan_label: planLabel ?? '',
          ...(referrerId    ? { referrer_id: referrerId }   : {}),
          ...(referralCode  ? { referral_code: referralCode } : {}),
        },
      },
      // Autoriser les promotions Stripe
      allow_promotion_codes: true,
      // Facturation mois en cours + renouvellement auto
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/checkout]', err)
    return NextResponse.json({ url: '/pricing' })
  }
}
