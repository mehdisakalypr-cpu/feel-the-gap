import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

/**
 * GET /api/stripe/checkout?plan=starter|premium  → subscription checkout
 * GET /api/stripe/checkout?pack=10|20|30|50      → one-shot credit pack
 *
 * Redirects to Stripe hosted checkout or to /auth/login if not authenticated.
 */
const PRICE_IDS: Record<string, string | undefined> = {
  plan_starter: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  plan_premium: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  pack_10: process.env.STRIPE_PRICE_PACK_10,
  pack_20: process.env.STRIPE_PRICE_PACK_20,
  pack_30: process.env.STRIPE_PRICE_PACK_30,
  pack_50: process.env.STRIPE_PRICE_PACK_50,
}

export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get('plan')
  const pack = req.nextUrl.searchParams.get('pack')
  const key = plan ? `plan_${plan}` : pack ? `pack_${pack}` : null
  if (!key || !(key in PRICE_IDS)) {
    return NextResponse.redirect(new URL('/pricing?err=invalid', req.url))
  }
  const priceId = PRICE_IDS[key]
  if (!priceId) {
    return NextResponse.redirect(new URL(`/pricing?err=setup_required&key=${key}`, req.url))
  }

  const user = await getAuthUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/auth/login?next=/api/stripe/checkout?${req.nextUrl.searchParams.toString()}`, req.url))
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('REMPLACER')) {
    return NextResponse.redirect(new URL('/pricing?err=stripe_not_configured', req.url))
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const base = new URL('/', req.url).origin
  const isPack = !!pack
  const session = await stripe.checkout.sessions.create({
    mode: isPack ? 'payment' : 'subscription',
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      kind: isPack ? 'credit_pack' : 'subscription',
      pack_size: pack ?? '',
      plan: plan ?? '',
    },
    line_items: [{ price: priceId, quantity: 1 }],
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
        user_id:    userId    ?? '',
        user_email: userEmail ?? '',
        plan_label: planLabel ?? '',
        ...(referrerId    ? { referrer_id: referrerId }   : {}),
        ...(referralCode  ? { referral_code: referralCode } : {}),
      },
      subscription_data: {
        metadata: {
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
