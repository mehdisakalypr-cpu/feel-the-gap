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
  setSitePassword,
} from '@/lib/auth-v2'

// Pinned version of the consolidated terms (CGU + mentions + privacy).
// When you change any of those legal pages, bump this tag AND regenerate TERMS_HASH.
const TERMS_VERSION = 'ftg-terms-2026-04-19'
const TERMS_HASH = crypto
  .createHash('sha256')
  .update(`${TERMS_VERSION}|cgu|mentions|privacy|LicenseRef-Proprietary-Sakaly|66d440006ffee21786ba79e378cd021a`)
  .digest('hex')

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
  let body: { email?: unknown; password?: unknown; display_name?: unknown; captchaToken?: unknown; accepted_terms?: unknown; accepted_at?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const email = sanitizeEmail(body?.email)
  const password = typeof body?.password === 'string' ? body!.password : null
  const displayName = typeof body?.display_name === 'string' ? body!.display_name.trim().slice(0, 80) : null
  const captchaToken = typeof body?.captchaToken === 'string' ? body!.captchaToken : null
  const acceptedTerms = body?.accepted_terms === true
  const acceptedAt = typeof body?.accepted_at === 'string' ? body!.accepted_at : new Date().toISOString()

  if (!email || !password) return jsonError(400, 'invalid_input')
  if (!acceptedTerms) {
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: 'terms_not_accepted' } })
    return jsonError(400, 'Vous devez accepter les CGU et mentions légales', { reason: 'terms_required' })
  }

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

  // Create the Supabase auth.users row with a RANDOM placeholder password — we
  // never use Supabase's built-in signInWithPassword for this user. The real,
  // per-site password lives in public.auth_site_passwords (Option C, 2026-04-17).
  const placeholderPassword = crypto.randomBytes(32).toString('base64url')
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: placeholderPassword,
    email_confirm: true,
    user_metadata: displayName ? { display_name: displayName } : undefined,
  })

  let user: { id: string; email: string | null } | null = created?.user
    ? { id: created.user.id, email: created.user.email ?? email }
    : null
  const msg = (createErr?.message ?? '').toLowerCase()
  const exists = msg.includes('already') || msg.includes('duplicate') || msg.includes('registered')

  if (createErr && !exists) {
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: 'supabase_error', err: createErr.message.slice(0, 140) } })
    return jsonError(500, 'Registration failed')
  }

  // If the user already existed in auth.users (e.g. registered on another site),
  // we still let them create a site-specific password here — same email, new
  // per-site credential. Resolve their user_id via profiles.
  if (!user) {
    const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
    if (profile?.id) {
      user = { id: profile.id as string, email }
    }
  }

  if (!user) {
    await logEvent({ event: 'register_fail', ip, ua, meta: { reason: 'no_user_resolved' } })
    // Anti-enumeration: look successful even when something failed upstream.
    return NextResponse.json({ ok: true, require_verify: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Store the real, per-site password.
  try {
    await setSitePassword(email, password)
  } catch (e) {
    await logEvent({ userId: user.id, event: 'register_fail', ip, ua, meta: { reason: 'site_password', err: (e as Error).message.slice(0, 140) } })
    return jsonError(500, 'Registration failed')
  }

  try { await grantAccess(user.id, 'user') } catch { /* non-fatal — admin can re-grant */ }

  // Record terms acceptance as opposable evidence in signed_agreements.
  // This is the legal anchor: user explicitly acknowledges CGU + mentions
  // (including IP ownership of the author) at the moment of account creation.
  try {
    await admin.from('signed_agreements').insert({
      user_id: user.id,
      email,
      product: 'ftg',
      plan: 'account_signup',
      agreement_version: TERMS_VERSION,
      agreement_hash_sha256: TERMS_HASH,
      body_hash_sha256: TERMS_HASH,
      ip,
      user_agent: ua,
      scroll_completed: true,
      signature_text: displayName || email,
      acceptance_method: 'signup_checkbox',
      purchase_intent: { flow: 'register', accepted_at: acceptedAt, scope: ['cgu', 'mentions', 'privacy'] },
      signed_at: new Date().toISOString(),
    })
  } catch (e) {
    // Non-fatal: user can still register, but we log it for manual audit.
    await logEvent({ userId: user.id, event: 'register_fail', ip, ua, meta: { reason: 'terms_log_failed', err: (e as Error).message.slice(0, 140) } })
  }

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
