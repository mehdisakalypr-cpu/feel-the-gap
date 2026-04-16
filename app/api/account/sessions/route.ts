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

// GET /api/account/sessions — list recent login events (we don't have Supabase refresh-token listing publicly)
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()

  const { data: events } = await sb
    .from('account_audit_log')
    .select('id, event, ip, user_agent, created_at')
    .eq('user_id', user.id)
    .in('event', ['login', 'password_changed', 'biometric_enabled', 'data_export_requested'])
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ sessions: events ?? [] })
}

// DELETE /api/account/sessions — sign out from all devices (global)
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null

  try { await sb.auth.admin.signOut(user.id, 'global') } catch (err) {
    console.error('[account/sessions] signOut', err)
    return NextResponse.json({ error: 'signout_failed' }, { status: 500 })
  }

  await sb.from('account_audit_log').insert({
    user_id: user.id, event: 'signed_out_all_devices', ip, user_agent: ua,
  })
  return NextResponse.json({ ok: true })
}
