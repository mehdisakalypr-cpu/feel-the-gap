/**
 * POST /api/auth/mfa/verify
 *
 * Two contexts:
 *   A) CONFIRM enrollment: user has an active session (requireUser) and submits their first TOTP
 *      code. We mark the secret verified.
 *   B) LOGIN-TIME 2FA: no session yet; caller submits { mfa_token, code }. We validate the
 *      HMAC-signed mfa_token (issued by /api/auth/login when hasActiveTotp=true), verify the
 *      TOTP, then return a Supabase magic-link token_hash so the client can open a session.
 *
 * Supports { is_recovery:true } with a recovery code instead of a TOTP code (login context only).
 * CSRF required.
 */

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  getAuthConfig,
  supabaseAdmin,
  supabaseServer,
  verifyTotp,
  verifyRecoveryCode,
  getClientIp,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024

function jsonError(status: number, error: string) {
  const res = NextResponse.json({ ok: false, error }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function verifyMfaToken(token: string): string | null {
  const [payloadB64, sig] = (token ?? '').split('.')
  if (!payloadB64 || !sig) return null
  const { secrets } = getAuthConfig()
  const expected = crypto.createHmac('sha256', secrets.challenge).update(payloadB64).digest('base64url')
  if (!safeEq(sig, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as { sub?: string; exp?: number; typ?: string }
    if (payload.typ !== 'mfa') return null
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.sub ?? null
  } catch { return null }
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(req: NextRequest) {
  const csrf = assertCsrf(req)
  if (csrf !== true) return jsonError(csrf.status, csrf.error)

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { code?: unknown; is_recovery?: unknown; mfa_token?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const code = typeof body?.code === 'string' ? body!.code.trim() : null
  const isRecovery = body?.is_recovery === true
  const mfaToken = typeof body?.mfa_token === 'string' ? body!.mfa_token : null

  if (!code) return jsonError(400, 'invalid_input')

  // Resolve user id: either logged-in session (context A) or mfa_token (context B).
  let userId: string | null = null
  let context: 'enroll' | 'login' = 'enroll'

  if (mfaToken) {
    userId = verifyMfaToken(mfaToken)
    if (!userId) return jsonError(401, 'mfa_token_invalid')
    context = 'login'
  } else {
    const sb = await supabaseServer()
    const { data } = await sb.auth.getUser()
    if (!data?.user) return jsonError(401, 'unauthorized')
    userId = data.user.id
    context = 'enroll'
  }

  // Verify code
  let ok = false
  if (isRecovery) {
    const r = await verifyRecoveryCode(userId, code)
    ok = r.ok
  } else {
    const r = await verifyTotp(userId, code, { confirmEnrollment: context === 'enroll' })
    ok = r.ok
  }

  if (!ok) {
    await logEvent({ userId, event: 'mfa_verify_fail', ip, ua, meta: { context, recovery: isRecovery } })
    return jsonError(400, 'Code invalide')
  }

  await logEvent({ userId, event: 'mfa_verify_ok', ip, ua, meta: { context, recovery: isRecovery } })

  if (context === 'enroll') {
    const res = NextResponse.json({ ok: true, confirmed: true })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  // context === 'login': produce a Supabase magic-link so the client can open a session.
  try {
    const admin = supabaseAdmin()
    const { data: profile } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle()
    const email = profile?.email as string | undefined
    if (!email) return jsonError(500, 'account_misconfigured')

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkErr || !link?.properties?.hashed_token) return jsonError(500, 'session_issue_failed')

    const res = NextResponse.json({
      ok: true,
      token_hash: link.properties.hashed_token,
      email,
      type: 'magiclink' as const,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch {
    return jsonError(500, 'session_issue_failed')
  }
}
