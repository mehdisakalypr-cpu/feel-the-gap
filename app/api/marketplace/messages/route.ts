import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SendInput = {
  recipient_user_id?: unknown
  thread_id?: unknown
  rfq_id?: unknown
  body?: unknown
  attachments?: unknown
}

function s(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

/**
 * POST /api/marketplace/messages — envoyer un message
 * GET  /api/marketplace/messages — liste des threads (avec dernier message + unread count)
 *
 * thread_id stratégie : si non fourni, on dérive un UUID stable depuis (sender,recipient,rfq?)
 * via lookup d'un message existant ; sinon génère un nouveau UUID.
 */
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let raw: SendInput
  try {
    raw = (await req.json()) as SendInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const recipient = s(raw.recipient_user_id)
  const body = s(raw.body)
  const rfqId = s(raw.rfq_id)
  let threadId = s(raw.thread_id)

  if (!recipient) return NextResponse.json({ error: 'recipient_required' }, { status: 400 })
  if (recipient === user.id) return NextResponse.json({ error: 'self_message_forbidden' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'body_required' }, { status: 400 })
  if (body.length > 8000) return NextResponse.json({ error: 'body_too_long' }, { status: 400 })

  // Résout / crée le thread_id : cherche un message existant entre les 2 (et même rfq si fourni)
  if (!threadId) {
    let q = sb
      .from('marketplace_messages')
      .select('thread_id')
      .or(`and(sender_user_id.eq.${user.id},recipient_user_id.eq.${recipient}),and(sender_user_id.eq.${recipient},recipient_user_id.eq.${user.id})`)
      .limit(1)
    if (rfqId) q = q.eq('rfq_id', rfqId)
    const { data: existing } = await q
    threadId = existing?.[0]?.thread_id ?? randomUUID()
  }

  const attachments = Array.isArray(raw.attachments) ? raw.attachments : null

  const { data, error } = await sb
    .from('marketplace_messages')
    .insert({
      thread_id: threadId,
      sender_user_id: user.id,
      recipient_user_id: recipient,
      rfq_id: rfqId,
      body,
      attachments,
    })
    .select('id, thread_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: data })
}

export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Tous mes messages (envoyés ou reçus), groupés par thread côté JS
  const { data, error } = await sb
    .from('marketplace_messages')
    .select('id, thread_id, sender_user_id, recipient_user_id, rfq_id, body, read_at, created_at')
    .or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    thread_id: string
    sender_user_id: string
    recipient_user_id: string
    rfq_id: string | null
    body: string
    read_at: string | null
    created_at: string
  }
  const rows = (data ?? []) as Row[]
  const threads = new Map<string, {
    thread_id: string
    other_user_id: string
    rfq_id: string | null
    last_body: string
    last_at: string
    unread_count: number
  }>()

  for (const r of rows) {
    const otherId = r.sender_user_id === user.id ? r.recipient_user_id : r.sender_user_id
    const cur = threads.get(r.thread_id)
    if (!cur) {
      threads.set(r.thread_id, {
        thread_id: r.thread_id,
        other_user_id: otherId,
        rfq_id: r.rfq_id,
        last_body: r.body,
        last_at: r.created_at,
        unread_count: r.recipient_user_id === user.id && !r.read_at ? 1 : 0,
      })
    } else {
      if (r.recipient_user_id === user.id && !r.read_at) cur.unread_count++
      // ordering DESC déjà → first row est le plus récent
    }
  }

  return NextResponse.json({
    threads: Array.from(threads.values()).sort((a, b) => b.last_at.localeCompare(a.last_at)),
  })
}
