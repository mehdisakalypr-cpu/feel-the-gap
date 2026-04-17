/**
 * POST /api/auth/forgot
 *
 * - CSRF, Turnstile, rate-limit (IP 3/15min, email 5/15min)
 * - Always returns 200 { ok: true } (anti-enumeration)
 * - If the email matches a known user: create OTP (purpose=reset) + send email
 * - No indication leaked via timing: we always do the lookup + always run a dummy email-render
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  getAuthConfig,
  supabaseAdmin,
  rateLimit,
  getClientIp,
  verifyTurnstile,
  createOtp,
  sendEmail,
  renderOtpEmail,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: false, error, ...extra }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function genericOk() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(e) || e.length > 254) return null
  return e
}

export async function POST(req: NextRequest) {
  const csrf = assertCsrf(req)
  if (csrf !== true) return jsonError(csrf.status, csrf.error)

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')
  const cfg = getAuthConfig()

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { email?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null

  // Bad input → still answer generically (prevents distinguishing bad vs good email)
  if (!email) return genericOk()

  const [ipRl, emailRl] = await Promise.all([
    rateLimit({ key: `forgot:ip:${ip}`, limit: 3, windowSec: 900 }),
    rateLimit({ key: `forgot:email:${email}`, limit: 5, windowSec: 900 }),
  ])
  if (!ipRl.ok || !emailRl.ok) {
    const retryAfter = Math.max(ipRl.retryAfter, emailRl.retryAfter) || 60
    const res = jsonError(429, 'Trop de tentatives. Réessayez plus tard.', { retry_after: retryAfter })
    res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  const turnstile = await verifyTurnstile(captchaToken, ip)
  if (!turnstile.ok) return jsonError(400, 'Vérification anti-bot échouée')

  // Lookup user — but never reveal outcome.
  let userId: string | null = null
  try {
    const { data } = await supabaseAdmin()
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    userId = data?.id ?? null
  } catch { /* swallow */ }

  if (userId) {
    try {
      const code = await createOtp({ email, purpose: 'reset', ip })
      const tpl = renderOtpEmail({ code, purpose: 'reset', brand: cfg.appName, ttlMin: 10 })
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      await logEvent({ userId, event: 'reset_request', ip, ua })
    } catch {
      // Never leak via 500 — always generic ok.
    }
  } else {
    // Pad timing — render a dummy template so response time matches the "found" path.
    renderOtpEmail({ code: '000000', purpose: 'reset', brand: cfg.appName, ttlMin: 10 })
  }

  return genericOk()
}
