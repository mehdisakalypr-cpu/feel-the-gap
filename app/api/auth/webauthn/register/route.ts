/**
 * POST /api/auth/webauthn/register  (action: 'start' | 'finish')
 *
 * - Requires an authenticated user (requireUser) — only a logged-in user can enroll a passkey
 * - start:   { action:'start' } → { options, challengeToken, rpId, siteSlug }
 * - finish:  { action:'finish', response, challengeToken, deviceName? } → { ok, credentialId }
 *           CSRF required on finish (user already has a session → cookie is guaranteed).
 *
 * COMPROMISE: CSRF is also applied to 'start' so we have uniform protection; the CSRF cookie exists
 * because the user is logged in. This differs from authenticate (no session yet).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  requireUser,
  startRegistration,
  finishRegistration,
  getClientIp,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 16 * 1024  // WebAuthn finish payloads can be a few KB

function jsonError(status: number, error: string) {
  const res = NextResponse.json({ ok: false, error }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function POST(req: NextRequest) {
  const csrf = assertCsrf(req)
  if (csrf !== true) return jsonError(csrf.status, csrf.error)

  const user = await requireUser()
  if (!user) return jsonError(401, 'unauthorized')

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')
  const host = req.headers.get('host')

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { action?: unknown; response?: unknown; challengeToken?: unknown; deviceName?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const action = typeof body?.action === 'string' ? body.action : null

  try {
    if (action === 'start') {
      const out = await startRegistration(user.id, user.email ?? '', host, { adminGrade: false })
      const res = NextResponse.json({ ok: true, ...out })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    if (action === 'finish') {
      const response = body?.response as Parameters<typeof finishRegistration>[1] | undefined
      const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken : null
      const deviceName = typeof body?.deviceName === 'string' ? body.deviceName.trim().slice(0, 60) : null
      if (!response || !challengeToken) return jsonError(400, 'invalid_input')

      const out = await finishRegistration(user.id, response, host, challengeToken, deviceName)
      await logEvent({ userId: user.id, event: 'passkey_registered', ip, ua, meta: { credentialId: out.credentialId } })
      const res = NextResponse.json({ ok: true, credentialId: out.credentialId })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    return jsonError(400, 'invalid_action')
  } catch (e) {
    const msg = (e as Error).message ?? 'error'
    await logEvent({ userId: user.id, event: 'passkey_auth_fail', ip, ua, meta: { reason: msg.slice(0, 140) } })
    return jsonError(400, 'passkey_registration_failed')
  }
}
