// © 2025-2026 Feel The Gap — Deal Room lead capture (public)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  channel?: 'form' | 'whatsapp' | 'email' | 'phone' | 'other'
  buyer_name?: string
  buyer_email?: string
  buyer_phone?: string
  buyer_country?: string
  company?: string
  qty_requested?: string
  message?: string
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function hashIp(ip: string): string {
  const salt = process.env.DEAL_LEAD_HASH_SALT ?? 'ftg-deal'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

interface RouteCtx { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params

  let body: Body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const channel = body.channel ?? 'form'
  if (channel === 'form') {
    if (!body.buyer_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.buyer_email)) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 })
    }
    if (!body.buyer_name || body.buyer_name.trim().length < 2) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 })
    }
  }

  const sb = admin()
  const { data: room } = await sb
    .from('deal_rooms')
    .select('id, seller_id, title, status, cta_email')
    .eq('slug', slug)
    .maybeSingle()
  if (!room || room.status !== 'published') {
    return NextResponse.json({ error: 'deal_room_not_found' }, { status: 404 })
  }

  const clientIp = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || '0.0.0.0'
  const ip_hash = hashIp(clientIp)
  const userAgent = req.headers.get('user-agent')?.slice(0, 256) || null

  // Basic anti-spam: max 5 leads / hour / IP per deal room
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await sb
    .from('deal_room_leads')
    .select('id', { head: true, count: 'exact' })
    .eq('deal_room_id', room.id)
    .eq('ip_hash', ip_hash)
    .gte('created_at', since)
  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const { data: lead, error } = await sb.from('deal_room_leads').insert({
    deal_room_id: room.id,
    channel,
    buyer_name: body.buyer_name?.trim() || null,
    buyer_email: body.buyer_email?.trim().toLowerCase() || null,
    buyer_phone: body.buyer_phone?.trim() || null,
    buyer_country: body.buyer_country?.toUpperCase().slice(0, 3) || null,
    company: body.company?.trim() || null,
    qty_requested: body.qty_requested?.trim() || null,
    message: body.message?.slice(0, 2000) || null,
    ip_hash,
    user_agent: userAgent,
  }).select('id').single()
  if (error || !lead) {
    return NextResponse.json({ error: 'lead_insert_failed', detail: error?.message }, { status: 500 })
  }

  // Fire-and-forget email notification to seller
  if (room.seller_id) {
    const { data: sellerAuth } = await sb.auth.admin.getUserById(room.seller_id)
    const sellerEmail = sellerAuth?.user?.email
    if (sellerEmail && process.env.RESEND_API_KEY) {
      const { sendResendEmail } = await import('@/lib/email/send')
      await sendResendEmail({
        to: sellerEmail,
        subject: `Nouveau lead Deal Room — ${room.title}`,
        html: buildSellerEmail({ title: room.title, body }),
      }).catch(err => console.error('[deal-lead] seller email failed', err))
      await sb.from('deal_room_leads').update({ notified_seller_at: new Date().toISOString() }).eq('id', lead.id)
    }
  }

  return NextResponse.json({ ok: true, lead_id: lead.id })
}

function buildSellerEmail({ title, body }: { title: string; body: Body }): string {
  const esc = (s: string | null | undefined): string => (s ?? '—').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  return `<div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:24px;background:#07090F;color:#E5E7EB">
<h2 style="color:#C9A84C;margin:0 0 16px">Nouveau lead sur votre deal room</h2>
<p>Un acheteur vient de contacter votre deal room <strong>${esc(title)}</strong>.</p>
<table cellpadding="6" style="width:100%;border-collapse:collapse;margin:16px 0;background:#111827">
<tr><td style="color:#9CA3AF">Nom</td><td>${esc(body.buyer_name)}</td></tr>
<tr><td style="color:#9CA3AF">Email</td><td>${esc(body.buyer_email)}</td></tr>
<tr><td style="color:#9CA3AF">Téléphone</td><td>${esc(body.buyer_phone)}</td></tr>
<tr><td style="color:#9CA3AF">Société</td><td>${esc(body.company)}</td></tr>
<tr><td style="color:#9CA3AF">Pays</td><td>${esc(body.buyer_country)}</td></tr>
<tr><td style="color:#9CA3AF">Quantité</td><td>${esc(body.qty_requested)}</td></tr>
</table>
${body.message ? `<p style="white-space:pre-wrap;background:#0B1220;padding:12px;border-radius:8px;color:#D1D5DB">${esc(body.message)}</p>` : ''}
<p style="color:#9CA3AF;font-size:12px;margin-top:24px">Répondez directement à ce lead depuis votre back-office : <a href="https://feel-the-gap.vercel.app/seller/deal-rooms" style="color:#C9A84C">gérer mes deal rooms</a>.</p>
</div>`
}
