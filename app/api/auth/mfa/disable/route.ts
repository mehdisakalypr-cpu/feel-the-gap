/**
 * POST /api/auth/mfa/disable
 *
 * - CSRF + requireUser + requireRecentAuth(300s) — sensitive action
 * - Body { code, is_recovery? } — must verify a fresh TOTP or recovery code
 * - Then disableTotp(user.id)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  requireUser,
  requireRecentAuth,
  verifyTotp,
  verifyRecoveryCode,
  disableTotp,
  getClientIp,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: false, error, ...extra }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function POST(req: NextRequest) {
  const csrf = assertCsrf(req)
  if (csrf !== true) return jsonError(csrf.status, csrf.error)

  const user = await requireUser()
  if (!user) return jsonError(401, 'unauthorized')

  const recent = await requireRecentAuth(300)
  if (!recent.ok) return jsonError(401, 'reauth_required', { requires_reauth: true })

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  const raw = await req.text()
  if (raw.length > MAX_BODY) return jsonError(413, 'payload_too_large')
  let body: { code?: unknown; is_recovery?: unknown }
  try { body = JSON.parse(raw) } catch { return jsonError(400, 'invalid_json') }

  const code = typeof body?.code === 'string' ? body!.code.trim() : null
  const isRecovery = body?.is_recovery === true
  if (!code) return jsonError(400, 'invalid_input')

  const check = isRecovery
    ? await verifyRecoveryCode(user.id, code)
    : await verifyTotp(user.id, code)

  if (!check.ok) {
    await logEvent({ userId: user.id, event: 'mfa_verify_fail', ip, ua, meta: { context: 'disable', recovery: isRecovery } })
    return jsonError(400, 'Code invalide')
  }

  try {
    await disableTotp(user.id)
    await logEvent({ userId: user.id, event: 'mfa_disabled', ip, ua })
    const res = NextResponse.json({ ok: true })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch {
    return jsonError(500, 'mfa_disable_failed')
  }
}
