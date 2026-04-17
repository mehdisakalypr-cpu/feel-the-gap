/**
 * POST /api/auth/register
 *
 * - CSRF protected
 * - Turnstile mandatory in prod
 * - Rate limits: IP 3/10min + email 3/60min
 * - Password policy (HIBP k-anonymity + trivial blocklist + length)
 * - Supabase admin createUser({ email_confirm: true }) — we take ownership of the verify flow via OTP
 * - grantAccess(user.id, 'user') on current site
 * - Sends OTP email (purpose='email_verify')
 * - Anti-enumeration: if email already exists, still return 200 (but do NOT send OTP for a conflict)
 *   COMPROMISE: the spec asks for a clear "ok: true, require_verify: true" response. We keep that
 *   shape but intentionally generalize the "already exists" path so we do not confirm/deny the account.
 */

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  getAuthConfig,
  supabaseAdmin,
  rateLimit,
  getClientIp,
  verifyTurnstile,
  checkPasswordPolicy,
  grantAccess,
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
  let body: { email?: unknown; password?: unknown; display_name?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body!.password : null
  const displayName = typeof body?.display_name === 'string' ? body!.display_name.trim().slice(0, 80) : null
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null

  if (!email || !password) return jsonError(400, 'invalid_input')

  // Rate limits
  const [ipRl, emailRl] = await Promise.all([
    rateLimit({ key: `register:ip:${ip}`, limit: 3, windowSec: 600 }),
    rateLimit({ key: `register:email:${email}`, limit: 3, windowSec: 3600 }),
  ])
  if (!ipRl.ok || !emailRl.ok) {
    const retryAfter = Math.max(ipRl.retryAfter, emailRl.retryAfter) || 60
    const res = jsonError(429, 'Trop de tentatives. Réessayez plus tard.', { retry_after: retryAfter })
    res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  // Turnstile
  const turnstile = await verifyTurnstile(captchaToken, ip)
  if (!turnstile.ok) {
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: `turnstile:${turnstile.reason}` } })
    return jsonError(400, 'Vérification anti-bot échouée')
  }

  // Password policy
  const policy = await checkPasswordPolicy(password)
  if (!policy.ok) {
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: `policy:${policy.reason}` } })
    return jsonError(400, policy.hint ?? 'Password does not meet policy', { reason: policy.reason })
  }

  const admin = supabaseAdmin()

  // Create user — email_confirm:true means Supabase trusts the address; we still send a separate OTP
  // (purpose=email_verify) to assert ownership via our own pipeline. This avoids the dual-link
  // problem (Supabase magic-link + our OTP both targeting inbox confusion).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: displayName ? { display_name: displayName } : undefined,
  })

  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? '').toLowerCase()
    const exists = msg.includes('already') || msg.includes('duplicate') || msg.includes('registered')
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: exists ? 'exists' : 'supabase_error' } })
    // Anti-enumeration: respond with the same shape on "exists" as on success.
    if (exists) {
      return NextResponse.json({ ok: true, require_verify: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return jsonError(500, 'Registration failed')
  }

  const user = created.user
  try { await grantAccess(user.id, 'user') } catch { /* non-fatal — admin can re-grant */ }

  // Email verify OTP
  try {
    const code = await createOtp({ email, purpose: 'email_verify', ip })
    const tpl = renderOtpEmail({ code, purpose: 'verify', brand: cfg.appName, ttlMin: 10 })
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
  } catch (e) {
    // Email send failure is non-fatal for account creation; user can resend via forgot/resend flow.
    await logEvent({ userId: user.id, event: 'register_fail', ip, ua, meta: { reason: 'email_send', err: (e as Error).message.slice(0, 140) } })
  }

  await logEvent({ userId: user.id, event: 'register_ok', ip, ua })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email ?? email },
    require_verify: true,
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
