/**
 * POST /api/auth/webauthn/authenticate  (action: 'start' | 'finish')
 *
 * No CSRF — the HMAC-signed challenge token issued on 'start' fulfills the same role
 * (attacker cannot forge a challenge token without the server HMAC key).
 *
 * start:  { action:'start', email? }
 *   - if email → allowCredentials bound to user
 *   - else → discoverable (Conditional UI / autofill)
 *
 * finish: { action:'finish', response, challengeToken }
 *   - finishAuthentication → userId
 *   - userHasAccess(userId) check → 403 if no access to this site
 *   - Supabase admin.generateLink({ type:'magiclink' }) → returns token_hash
 *   - Client then calls sb.auth.verifyOtp({ type:'magiclink', token_hash, email })
 *
 * COMPROMISE: we must return the associated email with the token_hash so the client can call
 * verifyOtp (which requires email). We accept this minor PII leakage because the caller just
 * proved possession of a passkey tied to that account.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  startAuthentication,
  finishAuthentication,
  userHasAccess,
  supabaseAdmin,
  getAuthConfig,
  getClientIp,
  rateLimit,
  verifyTurnstile,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 16 * 1024

function jsonError(status: number, error: string) {
  const res = NextResponse.json({ ok: false, error }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')
  const host = req.headers.get('host')

  // Light rate limit (passkey flows are cheap but abuseable for enumeration).
  const rl = await rateLimit({ key: `webauthn:auth:ip:${ip}`, limit: 30, windowSec: 300 })
  if (!rl.ok) {
    const res = jsonError(429, 'Trop de tentatives.')
    res.headers.set('Retry-After', String(rl.retryAfter || 60))
    return res
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { action?: unknown; email?: unknown; response?: unknown; challengeToken?: unknown; captchaToken?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const action = typeof body?.action === 'string' ? body.action : null

  try {
    if (action === 'start') {
      // Turnstile optional on start (we can't interrupt the autofill UX). Enforce only if token provided.
      if (typeof body?.captchaToken === 'string' && body.captchaToken.length > 0) {
        const t = await verifyTurnstile(body.captchaToken, ip)
        if (!t.ok) return jsonError(400, 'Vérification anti-bot échouée')
      }
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined
      const out = await startAuthentication(host, email)
      const res = NextResponse.json({ ok: true, ...out })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    if (action === 'finish') {
      const response = body?.response as Parameters<typeof finishAuthentication>[0] | undefined
      const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken : null
      if (!response || !challengeToken) return jsonError(400, 'invalid_input')

      const verified = await finishAuthentication(response, host, challengeToken)
      const userId = verified.userId

      // Site-access isolation — passkey could exist for another site, still require authz here.
      const hasAccess = await userHasAccess(userId)
      if (!hasAccess) {
        await logEvent({ userId, event: 'passkey_auth_fail', ip, ua, meta: { reason: 'no_site_access' } })
        return jsonError(403, 'Accès non autorisé')
      }

      // Load email to pair with token_hash (Supabase verifyOtp requires it).
      const admin = supabaseAdmin()
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle()
      const email = profile?.email as string | undefined
      if (!email) {
        await logEvent({ userId, event: 'passkey_auth_fail', ip, ua, meta: { reason: 'no_email' } })
        return jsonError(500, 'account_misconfigured')
      }

      // Issue a one-time Supabase magic-link that the client exchanges for a session.
      const cfg = getAuthConfig()
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${cfg.primaryDomain.startsWith('localhost') ? 'http' : 'https'}://${cfg.primaryDomain}${cfg.postLoginPath}` },
      })
      if (linkErr || !link?.properties?.hashed_token) {
        await logEvent({ userId, event: 'passkey_auth_fail', ip, ua, meta: { reason: 'generate_link' } })
        return jsonError(500, 'session_issue_failed')
      }

      await logEvent({ userId, event: 'passkey_auth_ok', ip, ua })

      const res = NextResponse.json({
        ok: true,
        token_hash: link.properties.hashed_token,
        email,
        type: 'magiclink' as const,
      })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    return jsonError(400, 'invalid_action')
  } catch (e) {
    const msg = (e as Error).message ?? 'error'
    await logEvent({ event: 'passkey_auth_fail', ip, ua, meta: { reason: msg.slice(0, 140) } })
    return jsonError(400, 'passkey_authentication_failed')
  }
}
