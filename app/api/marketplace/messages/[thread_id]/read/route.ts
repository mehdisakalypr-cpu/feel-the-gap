import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/marketplace/messages/[thread_id]/read
 * Marque tous les messages reçus du thread comme lus.
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ thread_id: string }> }) {
  const { thread_id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { error, count } = await sb
    .from('marketplace_messages')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .eq('thread_id', thread_id)
    .eq('recipient_user_id', user.id)
    .is('read_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, marked: count ?? 0 })
}
