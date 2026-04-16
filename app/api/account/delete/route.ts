import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// POST /api/account/delete
// Body: { confirm: "DELETE" }
// Soft delete: anonymize profile + set deleted_at. Cancels any active Stripe subscription.
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let confirm = ''
  try { const body = await req.json(); confirm = String(body?.confirm || '') } catch {}
  if (confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 })
  }

  const sb = admin()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null

  // Fetch profile for stripe cancel
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle()

  // Cancel active Stripe sub (best effort)
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey && !stripeKey.includes('REMPLACER') && profile?.stripe_subscription_id) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
      await stripe.subscriptions.update(profile.stripe_subscription_id, { cancel_at_period_end: true })
    } catch (err) {
      console.error('[account/delete] stripe cancel', err)
    }
  }

  // Anonymize profile
  const anonEmail = `deleted-${user.id}@deleted.local`
  await sb.from('profiles').update({
    email: anonEmail,
    username: null,
    deleted_at: new Date().toISOString(),
    tier: 'explorer',
  }).eq('id', user.id)

  // Audit log before we kill the session
  await sb.from('account_audit_log').insert({
    user_id: user.id, event: 'account_deleted', ip, user_agent: ua,
  })

  // Sign the user out everywhere
  try { await sb.auth.admin.signOut(user.id, 'global') } catch {}

  // Optional: schedule hard delete via auth admin after 30 days (not implemented here)
  return NextResponse.json({ ok: true })
}
