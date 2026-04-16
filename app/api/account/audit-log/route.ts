import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// GET /api/account/audit-log — last 10 events
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()
  const { data } = await sb
    .from('account_audit_log')
    .select('id, event, ip, user_agent, details, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ events: data ?? [] })
}
