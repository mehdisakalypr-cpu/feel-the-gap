/**
 * POST /api/auth/reset
 *
 * - CSRF, Turnstile, rate-limit (IP 5/15min, email 10/15min)
 * - verifyOtp(email, 'reset', code) — generic failure on any mismatch/expiry
 * - checkPasswordPolicy (HIBP)
 * - supabaseAdmin.auth.admin.updateUserById(userId, { password })
 * - revokeAllSessions(userId) — force re-auth everywhere
 * - deleteCredentialsForUser(userId) — force passkey re-enrollment (compromise hypothesis)
 * - Does NOT create a session — client must redirect to /auth/login
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  supabaseAdmin,
  rateLimit,
  getClientIp,
  verifyTurnstile,
  checkPasswordPolicy,
  verifyOtp,
  revokeAllSessions,
  deleteCredentialsForUser,
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

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { email?: unknown; code?: unknown; password?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const code = typeof body?.code === 'string' ? body!.code.trim() : null
  const password = typeof body?.password === 'string' ? body!.password : null
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null

  if (!email || !code || !password) return jsonError(400, 'invalid_input')

  const [ipRl, emailRl] = await Promise.all([
    rateLimit({ key: `reset:ip:${ip}`, limit: 5, windowSec: 900 }),
    rateLimit({ key: `reset:email:${email}`, limit: 10, windowSec: 900 }),
  ])
  if (!ipRl.ok || !emailRl.ok) {
    const retryAfter = Math.max(ipRl.retryAfter, emailRl.retryAfter) || 60
    const res = jsonError(429, 'Trop de tentatives. Réessayez plus tard.', { retry_after: retryAfter })
    res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  const turnstile = await verifyTurnstile(captchaToken, ip)
  if (!turnstile.ok) return jsonError(400, 'Vérification anti-bot échouée')

  // Verify OTP BEFORE password policy to avoid leaking "email unknown" via fast policy-only responses.
  const otp = await verifyOtp({ email, purpose: 'reset', code })
  if (!otp.ok) {
    await logEvent({ event: 'reset_verify_fail', ip, ua, meta: { reason: otp.reason ?? 'invalid' } })
    return jsonError(400, 'Code invalide ou expiré')
  }

  // Policy check AFTER OTP verify (we already know the user is who they claim).
  const policy = await checkPasswordPolicy(password)
  if (!policy.ok) {
    return jsonError(400, policy.hint ?? 'Password does not meet policy', { reason: policy.reason })
  }

  // Locate user id (OTP table uses email_hash, not user_id).
  const admin = supabaseAdmin()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!profile?.id) {
    // Should never happen (OTP only created for existing users) — treat as internal.
    await logEvent({ event: 'reset_verify_fail', ip, ua, meta: { reason: 'no_user_after_otp' } })
    return jsonError(400, 'Code invalide ou expiré')
  }

  const userId = profile.id as string

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password })
  if (updateErr) {
    await logEvent({ userId, event: 'reset_verify_fail', ip, ua, meta: { reason: 'supabase_update', err: updateErr.message.slice(0, 140) } })
    return jsonError(500, 'Reset failed')
  }

  // Tear down everything — force full re-auth.
  try { await revokeAllSessions(userId) } catch { /* best-effort */ }
  try { await deleteCredentialsForUser(userId) } catch { /* best-effort */ }

  await logEvent({ userId, event: 'reset_completed', ip, ua })

  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
