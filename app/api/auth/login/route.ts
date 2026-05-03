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
  verifySitePassword,
} from '@/lib/auth-v2'
import { detectLegacyCredentials, needsUnification, createUnificationToken } from '@/lib/auth-v2/unification'
import { TERMS_VERSION, PRODUCT_TAG } from '@/lib/terms-version'

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

  // PER-SITE password verification (2026-04-17 Option C).
  // The Supabase auth.users.password is IGNORED here — each site has its own
  // bcrypt hash in public.auth_site_passwords (email, site_slug). A compromised
  // password on one site cannot authenticate on another.
  const pwOk = await verifySitePassword(email, password)
  if (!pwOk) {
    await timingPad()
    await logEvent({ event: 'login_fail', ip, ua, meta: { reason: 'bad_credentials' } })
    return jsonError(401, 'Identifiants invalides')
  }

  // Resolve user_id from Supabase auth.users (matched by email).
  const admin = supabaseAdmin()
  const { data: profileRow } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  const userId = profileRow?.id as string | undefined
  if (!userId) {
    await timingPad()
    await logEvent({ event: 'login_fail', ip, ua, meta: { reason: 'no_profile' } })
    return jsonError(401, 'Identifiants invalides')
  }

  // Site access check.
  const hasAccess = await userHasAccess(userId)
  if (!hasAccess) {
    await logEvent({ userId, event: 'login_fail', ip, ua, meta: { reason: 'no_site_access' } })
    return jsonError(403, 'Accès non autorisé')
  }

  // Terms re-acceptance gate — if user has no signed_agreements row for the
  // current TERMS_VERSION, the client must route them to /legal/accept before
  // using the site. We still mint the session (they need it to post the
  // acceptance), but flag the response.
  let requireTermsReacceptance = false
  try {
    const { data: sig } = await admin
      .from('signed_agreements')
      .select('id')
      .eq('user_id', userId)
      .eq('product', PRODUCT_TAG)
      .eq('agreement_version', TERMS_VERSION)
      .limit(1)
      .maybeSingle()
    requireTermsReacceptance = !sig
  } catch {
    // Fail-open on DB error — do not lock user out.
  }

  // 2FA gate — if TOTP is active, do NOT mint a session yet.
  if (await hasActiveTotp(userId)) {
    const mfaToken = signMfaToken(userId)
    const res = NextResponse.json({ ok: true, require_mfa: true, mfa_token: mfaToken })
    res.headers.set('Cache-Control', 'no-store')
    attachCsrfCookie(res, issueCsrfToken())
    await logEvent({ userId, event: 'login_ok', ip, ua, meta: { mfa_required: true } })
    return res
  }

  // Mint a one-shot magic link via Supabase admin so the client can materialize
  // the session without us ever holding the user's Supabase password.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = link?.properties?.hashed_token
  if (linkErr || !hashedToken) {
    await logEvent({ userId, event: 'login_fail', ip, ua, meta: { reason: 'link_issue', err: linkErr?.message?.slice(0, 140) } })
    return jsonError(500, 'Session issuance failed')
  }

  // Auth unification check : if email has >1 active credential across sites,
  // mint a one-time cross-domain token + return redirect URL. Client routes to
  // hub.gapup.io/auth/unify AFTER terms re-acceptance (if any).
  let unificationRedirectUrl: string | null = null
  try {
    const creds = await detectLegacyCredentials(email)
    if (needsUnification(creds)) {
      const { redirectUrl } = await createUnificationToken(email, 'ftg')
      unificationRedirectUrl = redirectUrl
    }
  } catch (e) {
    // Fail-open : do not block login on unification token failure
    console.error('[login] unification check failed:', (e as Error).message)
  }

  const res = NextResponse.json({
    ok: true,
    token_hash: hashedToken,
    type: 'magiclink',
    user: { id: userId, email },
    require_terms_reacceptance: requireTermsReacceptance,
    terms_version: TERMS_VERSION,
    unification_redirect_url: unificationRedirectUrl,
  })
  res.headers.set('Cache-Control', 'no-store')
  attachCsrfCookie(res, issueCsrfToken())
  await logEvent({ userId, event: 'login_ok', ip, ua, meta: { reaccept_needed: requireTermsReacceptance, unification_pending: !!unificationRedirectUrl } })
  return res
}
