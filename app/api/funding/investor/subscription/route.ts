import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/funding/investor/subscription
// Returns the caller's investor_subscriptions row + extra_credits + remaining quota.
export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub, error } = await sb
    .from('investor_subscriptions')
    .select('*')
    .eq('investor_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!sub) {
    return NextResponse.json({ subscription: null, quota_remaining: 0, extra_credits: 0 })
  }

  const quotaRemaining = Math.max(0, (sub.quota_month ?? 0) - (sub.quota_used_month ?? 0))
  return NextResponse.json({
    subscription: sub,
    quota_remaining: quotaRemaining,
    extra_credits: sub.extra_credits ?? 0,
    can_make_offer: (quotaRemaining > 0 || (sub.extra_credits ?? 0) > 0) && sub.status === 'active',
  })
}
