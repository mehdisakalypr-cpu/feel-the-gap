import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomInt } from 'crypto'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM = process.env.RESET_FROM_EMAIL || process.env.EMAIL_FROM || 'Feel The Gap <noreply@gapup.io>'

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000)) // 6 digits
}

async function sendEmailViaResend(to: string, otp: string) {
  const subject = 'Code de réinitialisation Feel The Gap'
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#07090F;font-family:system-ui,-apple-system,sans-serif;color:#E5E7EB">
<div style="max-width:480px;margin:40px auto;background:#0D1117;border:1px solid #C9A84C26;border-radius:16px;padding:32px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:#C9A84C;color:#07090F;font-weight:900;font-size:26px;line-height:48px">F</div>
  </div>
  <h1 style="color:#fff;font-size:22px;margin:0 0 8px;text-align:center">Réinitialisation du mot de passe</h1>
  <p style="color:#9CA3AF;font-size:14px;margin:0 0 24px;text-align:center">Ton code de vérification :</p>
  <div style="background:#111827;border:1px solid #C9A84C40;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
    <div style="font-family:monospace;font-size:36px;letter-spacing:8px;color:#C9A84C;font-weight:700">${otp}</div>
  </div>
  <p style="color:#6B7280;font-size:12px;margin:0 0 8px;text-align:center">Ce code expire dans 10 minutes.</p>
  <p style="color:#6B7280;font-size:12px;margin:0;text-align:center">Si tu n'as rien demandé, ignore cet email — aucune action n'est requise.</p>
</div>
<p style="text-align:center;color:#4B5563;font-size:11px;margin:16px 0">Feel The Gap · Plateforme SaaS données import/export</p>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`)
  }
}

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const ip = getClientIp(req)

  // Rate limit per IP: 3 requests / 15 min
  const ipRl = await rateLimit({ key: `pwreset:ip:${ip}`, limit: 3, windowSec: 900 })
  if (!ipRl.ok) {
    return NextResponse.json({ error: 'Trop de demandes, patiente quelques minutes.', retryAfter: ipRl.retryAfter }, { status: 429 })
  }
  // Per-email: 5 / 15 min
  const emailRl = await rateLimit({ key: `pwreset:email:${email}`, limit: 5, windowSec: 900 })
  if (!emailRl.ok) {
    return NextResponse.json({ error: 'Trop de demandes pour ce compte.', retryAfter: emailRl.retryAfter }, { status: 429 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Check user exists — but return 200 unconditionally (no user-enumeration)
  // We still generate/send only if the user exists.
  const { data: userLookup } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()

  if (userLookup?.id) {
    const otp = generateOtp()
    const codeHash = sha256(otp)

    await admin.from('password_reset_otps').insert({
      email,
      code_hash: codeHash,
      ip_address: ip,
      user_agent: req.headers.get('user-agent') || null,
    })

    try {
      await sendEmailViaResend(email, otp)
    } catch (err) {
      console.error('[pwreset/send] Resend error:', (err as Error).message)
      // Best effort — return generic 200 so we don't leak account existence
    }
  }

  return NextResponse.json({
    ok: true,
    message: 'Si cet email correspond à un compte, un code vient d\'être envoyé.',
  })
}
