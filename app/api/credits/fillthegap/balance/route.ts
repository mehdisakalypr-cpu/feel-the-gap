import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// GET /api/credits/fillthegap/balance
// Returns the Fill-the-Gap monthly quota state for the authenticated user.
// Shape: { balance, grant, plan, periodEnd }
// 401 if unauthenticated, 500 on RPC error.
export async function GET() {
  try {
    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await sb.rpc('fillthegap_balance', { p_user_id: user.id })

    if (error) {
      console.error('[/api/credits/fillthegap/balance] rpc error', error)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    // The RPC returns a single-row table.
    const row = Array.isArray(data) ? data[0] : data
    const balance       = typeof row?.balance === 'number' ? row.balance : 0
    const monthly_grant = typeof row?.monthly_grant === 'number' ? row.monthly_grant : 0
    const plan          = typeof row?.plan === 'string' ? row.plan : 'free'
    const periodEnd     = row?.period_end ?? null

    return NextResponse.json({
      ok: true,
      balance,
      grant: monthly_grant,
      plan,
      periodEnd,
    })
  } catch (err) {
    console.error('[/api/credits/fillthegap/balance]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
