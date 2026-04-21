import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { ids?: string[]; action?: 'approved' | 'rejected' }
  if (!body.ids?.length || !['approved', 'rejected'].includes(String(body.action))) {
    return NextResponse.json({ error: 'ids + action required' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { error } = await db.from('ftg_leads')
    .update({
      approval_status: body.action,
      approved_at: new Date().toISOString(),
      approved_by: 'mehdi',
    })
    .in('id', body.ids)
    .eq('approval_status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: body.ids.length })
}
