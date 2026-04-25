import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  email?: string
  message?: string
  source_path?: string
}

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT = process.env.TELEGRAM_ALERT_CHAT_ID ?? '1269815358'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const email = (body.email ?? '').trim().toLowerCase()
  const message = (body.message ?? '').slice(0, 1000).trim()
  const source_path = (body.source_path ?? '').slice(0, 200)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'config' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ip_hash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null
  const country_iso = req.headers.get('x-vercel-ip-country') ?? null
  const user_agent = req.headers.get('user-agent')?.slice(0, 200) ?? null

  const { data, error } = await sb
    .from('inbound_contacts')
    .insert({
      email,
      message: message || null,
      source: 'ftg_contact_widget',
      source_path: source_path || null,
      country_iso,
      ip_hash,
      user_agent,
      prospect_state: 'engaged',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[contact] insert error', error.message)
    return NextResponse.json({ ok: false, error: 'db' }, { status: 500 })
  }

  // Fire-and-forget Telegram alert (don't block response if TG fails)
  if (TG_TOKEN) {
    const text = `💬 Nouveau contact FTG\n\n📧 ${email}\n📍 ${country_iso ?? '?'} · ${source_path || '/'}\n${message ? `\n«${message.slice(0, 300)}»` : ''}\n\nID: ${data?.id ?? '?'}`
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
    }).catch((e) => console.warn('[contact] tg fanout failed', e))
  }

  return NextResponse.json({ ok: true, id: data?.id })
}
