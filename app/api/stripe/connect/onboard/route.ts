import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, stripeConfigured } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/connect/onboard
 * Create-or-retrieve un Stripe Connect Express account pour l'utilisateur
 * courant (producteur), puis génère un AccountLink pour l'onboarding.
 *
 * Body: { return_url?: string, refresh_url?: string }
 * Retourne : { account_id, onboarding_url }
 *
 * L'utilisateur complète le flow Stripe (KYC, bank account). Le webhook
 * `account.updated` met à jour stripe_connect_charges_enabled/payouts_enabled.
 */
export async function POST(req: Request) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (!stripeConfigured()) {
    return NextResponse.json({
      error: 'stripe_not_configured',
      message: 'Stripe live non activé (bloqué par LLC Wyoming).',
    }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'https://feel-the-gap.vercel.app'
  const return_url: string = typeof body?.return_url === 'string' ? body.return_url : `${origin}/seller?connect=success`
  const refresh_url: string = typeof body?.refresh_url === 'string' ? body.refresh_url : `${origin}/seller?connect=retry`

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_connect_account_id, country_iso')
    .eq('id', user.id)
    .single()

  const stripe = getStripe()
  let accountId = profile?.stripe_connect_account_id as string | null

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      email: user.email ?? undefined,
      country: profile?.country_iso === 'FRA' ? 'FR' : 'FR', // default FR — Stripe Connect Express nécessite un pays connu
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { ftg_user_id: user.id },
    })
    accountId = acct.id
    await admin
      .from('profiles')
      .update({
        stripe_connect_account_id: acct.id,
        stripe_connect_charges_enabled: acct.charges_enabled,
        stripe_connect_payouts_enabled: acct.payouts_enabled,
        stripe_connect_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url,
    refresh_url,
    type: 'account_onboarding',
  })

  return NextResponse.json({
    account_id: accountId,
    onboarding_url: link.url,
  })
}
