import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/marketplace/messages/[thread_id] — fetch tous les messages du thread
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ thread_id: string }> }) {
  const { thread_id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await sb
    .from('marketplace_messages')
    .select('id, thread_id, sender_user_id, recipient_user_id, rfq_id, body, attachments, read_at, created_at')
    .eq('thread_id', thread_id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}
