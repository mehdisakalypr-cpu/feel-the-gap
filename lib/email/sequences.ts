import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'node:crypto'

/**
 * Email drip sequences — enrollment + batched send.
 * Used by /api/cron/email-drip (every 15min) and by the signup callback.
 */

const FROM_EMAIL = process.env.EMAIL_FROM || 'Feel The Gap <outreach@ofaops.xyz>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'
const UNSUB_SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || 'ftg-unsub-default'

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export function signUnsubToken(enrollmentId: string): string {
  const h = crypto.createHmac('sha256', UNSUB_SECRET).update(enrollmentId).digest('hex').slice(0, 24)
  return `${enrollmentId}.${h}`
}

export function verifyUnsubToken(token: string): string | null {
  const [id, sig] = token.split('.')
  if (!id || !sig) return null
  const expected = crypto.createHmac('sha256', UNSUB_SECRET).update(id).digest('hex').slice(0, 24)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return crypto.timingSafeEqual(a, b) ? id : null
}

export async function enrollUser(userId: string, sequenceCode: string): Promise<{ id: string } | null> {
  const sb = admin()
  const { data: seq } = await sb
    .from('email_sequences')
    .select('id, active')
    .eq('code', sequenceCode)
    .single()
  if (!seq || !seq.active) return null

  const { data: firstStep } = await sb
    .from('email_sequence_steps')
    .select('step_order, delay_hours')
    .eq('sequence_id', seq.id)
    .eq('active', true)
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstStep) return null

  const nextSendAt = new Date(Date.now() + firstStep.delay_hours * 3600_000).toISOString()

  const { data, error } = await sb
    .from('email_sequence_enrollments')
    .upsert(
      {
        user_id: userId,
        sequence_code: sequenceCode,
        current_step: 0,
        next_send_at: nextSendAt,
        status: 'active',
      },
      { onConflict: 'user_id,sequence_code', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[email/enrollUser]', error.message)
    return null
  }
  return data
}

function renderFooter(enrollmentId: string): { html: string; text: string } {
  const token = signUnsubToken(enrollmentId)
  const url = `${APP_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`
  return {
    html: `<div style="margin-top:28px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.4);text-align:center">
Feel The Gap · <a href="${APP_URL}" style="color:#C9A84C;text-decoration:none">feel-the-gap.vercel.app</a><br/>
<a href="${url}" style="color:rgba(255,255,255,.4);text-decoration:underline">Se désabonner</a>
</div>`,
    text: `\n\n---\nSe désabonner : ${url}`,
  }
}

function wrap(html: string, footer: string): string {
  return `<div style="font-family:system-ui,sans-serif;background:#07090F;color:#e2e8f0;padding:40px 32px;max-width:600px;margin:0 auto">
<div style="margin-bottom:24px"><span style="color:#C9A84C;font-weight:800;font-size:18px;letter-spacing:.04em">Feel The Gap</span></div>
${html}
${footer}
</div>`
}

export async function sendNextStep(enrollmentId: string): Promise<{ ok: boolean; resend_id?: string; error?: string }> {
  const sb = admin()
  const { data: enr } = await sb
    .from('email_sequence_enrollments')
    .select('id, user_id, sequence_code, current_step, status')
    .eq('id', enrollmentId)
    .single()
  if (!enr || enr.status !== 'active') return { ok: false, error: 'enrollment not active' }

  const { data: seq } = await sb.from('email_sequences').select('id').eq('code', enr.sequence_code).single()
  if (!seq) return { ok: false, error: 'sequence missing' }

  const nextOrder = enr.current_step + 1
  const { data: step } = await sb
    .from('email_sequence_steps')
    .select('step_order, delay_hours, subject, body_html, body_text')
    .eq('sequence_id', seq.id)
    .eq('step_order', nextOrder)
    .eq('active', true)
    .maybeSingle()

  if (!step) {
    await sb
      .from('email_sequence_enrollments')
      .update({ status: 'completed', next_send_at: null })
      .eq('id', enr.id)
    return { ok: true }
  }

  const { data: auth } = await sb.auth.admin.getUserById(enr.user_id)
  const email = auth?.user?.email
  if (!email) {
    await sb.from('email_sequence_enrollments').update({ status: 'paused' }).eq('id', enr.id)
    return { ok: false, error: 'user email missing' }
  }

  const footer = renderFooter(enr.id)
  const html = wrap(step.body_html, footer.html)
  const text = step.body_text ? `${step.body_text}${footer.text}` : undefined

  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY missing' }
  const resend = new Resend(key)
  let resendId: string | undefined
  try {
    const out = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: step.subject,
      html,
      text,
    })
    resendId = (out as any)?.data?.id
  } catch (err: any) {
    console.error('[email/sendNextStep] resend err', err?.message || err)
    return { ok: false, error: 'resend failed' }
  }

  await sb.from('email_sequence_sends').insert({
    enrollment_id: enr.id,
    step_order: step.step_order,
    resend_id: resendId ?? null,
  })

  // Find next step to schedule
  const { data: following } = await sb
    .from('email_sequence_steps')
    .select('delay_hours')
    .eq('sequence_id', seq.id)
    .eq('active', true)
    .gt('step_order', step.step_order)
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const now = new Date()
  const updates: Record<string, unknown> = {
    current_step: step.step_order,
    last_sent_at: now.toISOString(),
  }
  if (following) {
    updates.next_send_at = new Date(now.getTime() + following.delay_hours * 3600_000).toISOString()
  } else {
    updates.next_send_at = null
    updates.status = 'completed'
  }
  await sb.from('email_sequence_enrollments').update(updates).eq('id', enr.id)

  return { ok: true, resend_id: resendId }
}

export async function processPendingSends(limit = 50): Promise<{
  processed: number
  sent: number
  errors: number
  details: Array<{ enrollment_id: string; ok: boolean; error?: string; resend_id?: string }>
}> {
  const sb = admin()
  const nowIso = new Date().toISOString()
  const { data: pending } = await sb
    .from('email_sequence_enrollments')
    .select('id')
    .eq('status', 'active')
    .lte('next_send_at', nowIso)
    .order('next_send_at', { ascending: true })
    .limit(limit)

  const list = pending ?? []
  let sent = 0
  let errors = 0
  const details: Array<{ enrollment_id: string; ok: boolean; error?: string; resend_id?: string }> = []
  for (const row of list) {
    const res = await sendNextStep(row.id)
    if (res.ok) sent++
    else errors++
    details.push({ enrollment_id: row.id, ...res })
  }
  return { processed: list.length, sent, errors, details }
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const id = verifyUnsubToken(token)
  if (!id) return false
  const sb = admin()
  const { error } = await sb
    .from('email_sequence_enrollments')
    .update({ status: 'unsubscribed', next_send_at: null })
    .eq('id', id)
  return !error
}
