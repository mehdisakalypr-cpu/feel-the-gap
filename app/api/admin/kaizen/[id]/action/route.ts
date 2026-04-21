import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await isAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { action?: string; proposal_idx?: number }
  const action = body.action
  if (!['applied', 'deferred', 'rejected'].includes(String(action))) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const patch: any = { status: action }
  if (action === 'applied') patch.applied_at = new Date().toISOString()

  const { error } = await db.from('ftg_kaizen_proposals').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
