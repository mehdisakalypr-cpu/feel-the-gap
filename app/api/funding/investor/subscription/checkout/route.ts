import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'
import { detectCountryFromHeaders, getGeoPrice } from '@/lib/geo-pricing'
import {
  INVESTOR_TIER_PRICE_EUR,
  INVESTOR_TIER_QUOTA,
  INVESTOR_TIER_LABEL,
  computeEffectiveMonthly,
  type InvestorTierKey,
  type InvestorRoleKind,
  type DurationMonths,
} from '@/lib/funding/investor-tiers'

export const runtime = 'nodejs'

// GET /api/funding/investor/subscription/checkout?tier=explorer|active|pro
//   &role=financeur|investisseur
//   &duration=1|12|24|36
//   [&cc=XX]
//
// Creates a Stripe Checkout Session for a funding marketplace subscription.
// Founding-pioneer discount is resolved server-side from marketplace_state — never trusted from query.
// Billed upfront (1 × monthly for duration=1, N × monthly_effective for longer commitments).

const VALID_TIERS: InvestorTierKey[] = ['explorer', 'active', 'pro']
const VALID_ROLES: InvestorRoleKind[] = ['financeur', 'investisseur']
const VALID_DURATIONS = new Set<DurationMonths>([1, 12, 24, 36])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tierParam = searchParams.get('tier') as InvestorTierKey | null
  const roleParam = searchParams.get('role') as InvestorRoleKind | null
  const durationRaw = Number(searchParams.get('duration') ?? '1')
  const duration = VALID_DURATIONS.has(durationRaw as DurationMonths) ? (durationRaw as DurationMonths) : 1

  if (!tierParam || !VALID_TIERS.includes(tierParam)) {
    return NextResponse.redirect(new URL('/pricing/funding?err=invalid_tier', req.url))
  }
  if (!roleParam || !VALID_ROLES.includes(roleParam)) {
    return NextResponse.redirect(new URL('/pricing/funding?err=invalid_role', req.url))
  }

  const user = await getAuthUser()
  if (!user) {
    const next = `/api/funding/investor/subscription/checkout?${searchParams.toString()}`
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(next)}`, req.url))
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey || stripeKey.includes('REMPLACER')) {
    return NextResponse.redirect(new URL('/pricing/funding?err=stripe_not_configured', req.url))
  }

  // Resolve founding-pioneer eligibility from marketplace_state (single source of truth).
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: state } = await sb
    .from('marketplace_state')
    .select('founding_pioneer_limit, founding_pioneer_used, founding_pioneer_discount_pct')
    .eq('id', 1)
    .single()
  const pioneerSeatsLeft = Math.max(0, (state?.founding_pioneer_limit ?? 50) - (state?.founding_pioneer_used ?? 0))
  const foundingPioneer = pioneerSeatsLeft > 0

  // Geo-pricing
  const ccParam = searchParams.get('cc')
  const detectedCC = ccParam ?? detectCountryFromHeaders(req.headers)
  const geoBase = INVESTOR_TIER_PRICE_EUR[tierParam]
  const gp = getGeoPrice(geoBase, detectedCC)
  const geoMultiplier = gp.multiplier
  const geoCountry = gp.countryCode

  const pricing = computeEffectiveMonthly(tierParam, duration, foundingPioneer, geoMultiplier)
  const monthlyEffectiveCents = pricing.monthlyEffective * 100
  const baselineCents = pricing.monthlyBaseline * 100

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

  const base = new URL('/', req.url).origin
  const isAnnualCommitment = duration > 1

  // For 1-month: pure monthly subscription.
  // For 12/24/36: charge upfront via one-time payment + granting N months of quota.
  // We use Stripe `mode=subscription` with interval=month for duration=1,
  // and `mode=payment` with metadata-driven multi-month grant for longer commitments.
  const metadata = {
    product: 'ftg',
    kind: 'funding_investor_subscription',
    user_id: user.id,
    role_kind: roleParam,
    tier: tierParam,
    duration_months: String(duration),
    founding_pioneer: String(foundingPioneer),
    quota_month: String(INVESTOR_TIER_QUOTA[tierParam]),
    geo_country: geoCountry,
    geo_multiplier: geoMultiplier.toFixed(3),
    baseline_cents: String(baselineCents),
    monthly_effective_cents: String(monthlyEffectiveCents),
  }

  const productName = `FTG Funding ${INVESTOR_TIER_LABEL[tierParam]} — ${roleParam === 'financeur' ? 'Financeur' : 'Investisseur'}${foundingPioneer ? ' (Founding Pioneer -30%)' : ''}`

  const session = await stripe.checkout.sessions.create({
    mode: isAnnualCommitment ? 'payment' : 'subscription',
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata,
    ...(isAnnualCommitment
      ? {}
      : { subscription_data: { metadata } }),
    line_items: [
      isAnnualCommitment
        ? {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: monthlyEffectiveCents * duration,
              product_data: {
                name: `${productName} · ${duration} mois payés d'avance`,
                description: `${INVESTOR_TIER_QUOTA[tierParam]} acceptations/mois · Pipeline de suivi · Dossiers complets`,
              },
            },
          }
        : {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: monthlyEffectiveCents,
              recurring: { interval: 'month' },
              product_data: {
                name: productName,
                description: `${INVESTOR_TIER_QUOTA[tierParam]} acceptations/mois · Pipeline de suivi · Dossiers complets`,
              },
            },
          },
    ],
    success_url: `${base}/${roleParam === 'financeur' ? 'finance' : 'invest'}/dashboard?success=1`,
    cancel_url: `${base}/pricing/funding?role=${roleParam}&cancel=1`,
    allow_promotion_codes: true,
  })

  return NextResponse.redirect(session.url ?? `${base}/pricing/funding`, { status: 303 })
}
