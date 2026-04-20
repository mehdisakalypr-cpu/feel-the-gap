// © 2025-2026 Feel The Gap — buyer RGPD article 17 soft-delete (per store)
import { NextRequest, NextResponse } from 'next/server'
import { authBuyerForStore, supabaseAdmin } from '../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, ctx: Params) {
  const { slug } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, store, user } = auth

  let confirm = ''
  try {
    const body = (await req.json()) as { confirm?: string }
    confirm = String(body?.confirm ?? '')
  } catch { /* ignore */ }
  if (confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent') ?? null

  const admin = supabaseAdmin()

  // 1) Cancel any Stripe subscription on the user's profile (best effort, mirrors /api/account/delete).
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (stripeKey && !stripeKey.includes('REMPLACER') && profile?.stripe_subscription_id) {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
      try {
        await stripe.subscriptions.update(String(profile.stripe_subscription_id), { cancel_at_period_end: true })
      } catch (err) { console.error('[store/account/delete] stripe sub', err) }
    }
  } catch (err) {
    console.error('[store/account/delete] stripe profile lookup', err)
  }

  // 2) Hard-delete buyer-only resources scoped to THIS store.
  await sb.from('store_buyer_addresses').delete().eq('user_id', user.id)
  await sb.from('store_carts').delete().eq('buyer_user_id', user.id).eq('store_id', store.id)

  // 3) Anonymize past orders for this store (keep order rows for legal retention, drop PII).
  const anonEmail = `deleted-${user.id}@deleted.local`
  await admin.from('store_orders').update({
    buyer_email: anonEmail,
    buyer_name: null,
    buyer_address: {},
    notes: null,
  }).eq('store_id', store.id).eq('buyer_user_id', user.id)

  // 4) Mark profile soft-deleted (mirrors /api/account/delete behaviour).
  await admin.from('profiles').update({
    email: anonEmail,
    username: null,
    deleted_at: new Date().toISOString(),
  }).eq('id', user.id)

  // 5) Audit log + global signout.
  try {
    await admin.from('account_audit_log').insert({
      user_id: user.id,
      event: 'store_account_deleted',
      details: { store_id: store.id, slug: store.slug },
      ip,
      user_agent: ua,
    })
  } catch { /* noop */ }
  try { await admin.auth.admin.signOut(user.id, 'global') } catch { /* noop */ }

  return NextResponse.json({ ok: true })
}
