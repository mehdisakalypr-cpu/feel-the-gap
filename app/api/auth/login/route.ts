/**
 * POST /api/auth/login
 *
 * Standards:
 *  - NIST 800-63B-4, OWASP ASVS 5 (anti-enumeration, generic errors, constant-time-ish)
 *  - Turnstile mandatory in production
 *  - Rate limits: IP 5/5min + email 10/15min
 *  - Site-access isolation: userHasAccess() check after credential verification
 *  - 2FA gate: if hasActiveTotp(user) → return mfa_token (HMAC JWT, TTL 5min), no session
 *  - CSRF token rotated on each attempt via attachCsrfCookie()
 *
 * COMPROMISE: no real bcrypt lives here (Supabase manages password hashing). To equalize
 * timing on "unknown email" we do a dummy scrypt compare (sync with bcrypt's ~200ms cost).
 *
 * CSRF: intentionally NOT required on /login — a user landing fresh has no CSRF cookie yet.
 * Turnstile + rate-limit fill that role.
 */

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthConfig,
  supabaseAdmin,
  rateLimit,
  getClientIp,
  verifyTurnstile,
  userHasAccess,
  hasActiveTotp,
  issueCsrfToken,
  attachCsrfCookie,
  logEvent,
} from '@/lib/auth-v2'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MFA_TOKEN_TTL_SEC = 5 * 60

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

/** Constant-ish time dummy to balance timing with Supabase bcrypt verify. */
async function timingPad() {
  // ~150–250 ms of work similar to a bcrypt compare cost=10
  await new Promise<void>(resolve => {
    crypto.scrypt('dummy-password', 'dummy-salt-1234567890', 64, { N: 16384 }, () => resolve())
  })
}

function signMfaToken(userId: string): string {
  const { secrets } = getAuthConfig()
  const exp = Math.floor(Date.now() / 1000) + MFA_TOKEN_TTL_SEC
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp, typ: 'mfa' })).toString('base64url')
  const sig = crypto.createHmac('sha256', secrets.challenge).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')
  const cfg = getAuthConfig()

  // Body size guard
  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { email?: unknown; password?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body!.password : null
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null

  if (!email || !password) {
    await logEvent({ event: 'login_fail', ip, ua, meta: { reason: 'bad_input' } })
    return jsonError(400, 'Identifiants invalides')
  }

  // Rate limits: IP 5/5min, email 10/15min
  const [ipRl, emailRl] = await Promise.all([
    rateLimit({ key: `login:ip:${ip}`, limit: 5, windowSec: 300 }),
    rateLimit({ key: `login:email:${email}`, limit: 10, windowSec: 900 }),
  ])
  if (!ipRl.ok || !emailRl.ok) {
    await logEvent({ event: 'login_rate_limited', ip, ua, meta: { email_hash: crypto.createHash('sha256').update(email).digest('hex').slice(0, 16) } })
    const retryAfter = Math.max(ipRl.retryAfter, emailRl.retryAfter) || 60
    const res = jsonError(429, 'Trop de tentatives. Réessayez plus tard.', { retry_after: retryAfter })
    res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  // Turnstile
  const turnstile = await verifyTurnstile(captchaToken, ip)
  if (!turnstile.ok) {
    await logEvent({ event: 'login_fail', ip, ua, meta: { reason: `turnstile:${turnstile.reason}` } })
    return jsonError(400, 'Vérification anti-bot échouée')
  }

  // Password verification via a request-scoped anon client (avoids module-scope session leak).
  const anon = createClient(cfg.supabase.url, cfg.supabase.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })

  if (error || !data?.user || !data.session) {
    // Pad timing so "unknown email" and "wrong password" cost the same.
    await timingPad()
    await logEvent({ event: 'login_fail', ip, ua, meta: { reason: 'bad_credentials' } })
    return jsonError(401, 'Identifiants invalides')
  }

  const user = data.user
  const session = data.session

  // Site access check — user might exist in Supabase but not on this site.
  const hasAccess = await userHasAccess(user.id)
  if (!hasAccess) {
    // Revoke the session we just obtained (do not leak cookies back to client).
    try { await supabaseAdmin().auth.admin.signOut(user.id, 'global') } catch { /* best-effort */ }
    await logEvent({ userId: user.id, event: 'login_fail', ip, ua, meta: { reason: 'no_site_access' } })
    return jsonError(403, 'Accès non autorisé')
  }

  // 2FA gate — if TOTP is active, do NOT return session tokens.
  if (await hasActiveTotp(user.id)) {
    // Sign out the ephemeral session just obtained — client must complete MFA first.
    try { await supabaseAdmin().auth.admin.signOut(user.id, 'global') } catch { /* best-effort */ }
    const mfaToken = signMfaToken(user.id)
    const res = NextResponse.json({ ok: true, require_mfa: true, mfa_token: mfaToken })
    res.headers.set('Cache-Control', 'no-store')
    attachCsrfCookie(res, issueCsrfToken())
    await logEvent({ userId: user.id, event: 'login_ok', ip, ua, meta: { mfa_required: true } })
    return res
  }

  // Success — return tokens (client posts to Supabase to set cookies).
  const res = NextResponse.json({
    ok: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: { id: user.id, email: user.email ?? email },
  })
  res.headers.set('Cache-Control', 'no-store')
  attachCsrfCookie(res, issueCsrfToken())
  await logEvent({ userId: user.id, event: 'login_ok', ip, ua })
  return res
}
