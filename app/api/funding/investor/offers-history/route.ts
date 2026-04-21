import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/funding/investor/offers-history
// Returns the caller's offers history (both funding + investor kinds) via the
// investor_offers_history() RPC. Used by the /finance/dashboard and
// /invest/dashboard pipeline tracker.
export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb.rpc('investor_offers_history', { p_user: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ offers: data ?? [] })
}
