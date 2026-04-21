import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { EXTRA_CREDIT_PACKS, type ExtraCreditPackKind } from '@/lib/funding/investor-tiers'
import { detectCountryFromHeaders, getGeoPrice } from '@/lib/geo-pricing'

export const runtime = 'nodejs'

// GET /api/funding/investor/credits/checkout?pack=single|pack5|pack10|pack25
// One-shot Stripe payment for extra acceptance credits. Webhook inserts a
// funding_credits row and increments investor_subscriptions.extra_credits.

export async function GET(req: NextRequest) {
  const packParam = new URL(req.url).searchParams.get('pack') as ExtraCreditPackKind | null
  const pack = EXTRA_CREDIT_PACKS.find((p) => p.kind === packParam)
  if (!pack) {
    return NextResponse.redirect(new URL('/pricing/funding?err=invalid_pack', req.url))
  }

  const user = await getAuthUser()
  if (!user) {
    const next = `/api/funding/investor/credits/checkout?pack=${pack.kind}`
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url))
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('REMPLACER')) {
    return NextResponse.redirect(new URL('/pricing/funding?err=stripe_not_configured', req.url))
  }

  const detectedCC = detectCountryFromHeaders(req.headers)
  const gp = getGeoPrice(pack.price_eur, detectedCC)
  const unitAmount = gp.price * 100

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const base = new URL('/', req.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      product: 'ftg',
      kind: 'funding_investor_credits',
      user_id: user.id,
      pack_kind: pack.kind,
      credits: String(pack.credits),
      baseline_eur: String(pack.price_eur),
      adjusted_eur: String(gp.price),
      geo_country: gp.countryCode,
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: unitAmount,
        product_data: {
          name: `FTG Funding — +${pack.credits} acceptation${pack.credits > 1 ? 's' : ''}`,
          description: `Pack one-shot · €${gp.price} · €${(gp.price / pack.credits).toFixed(2)}/acceptation`,
        },
      },
    }],
    success_url: `${base}/invest/dashboard?credits=1`,
    cancel_url: `${base}/pricing/funding?cancel=1`,
  })

  return NextResponse.redirect(session.url ?? `${base}/pricing/funding`, { status: 303 })
}
