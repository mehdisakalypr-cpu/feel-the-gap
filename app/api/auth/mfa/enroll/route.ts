/**
 * POST /api/auth/mfa/enroll
 *
 * - CSRF + authenticated user required
 * - Generates a fresh TOTP secret (160-bit) + 10 recovery codes
 * - Returns { secret, otpauth (for QR), recovery } — recovery codes shown ONCE
 * - Enrollment is NOT confirmed until the user verifies a first code at /mfa/verify
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  requireUser,
  enrollTotp,
  getClientIp,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  try {
    const { secret, otpauth, recovery } = await enrollTotp(user.id, user.email ?? user.id)
    await logEvent({ userId: user.id, event: 'mfa_enrolled', ip, ua, meta: { confirmed: false } })

    const res = NextResponse.json({ ok: true, secret, otpauth, recovery })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (e) {
    await logEvent({ userId: user.id, event: 'mfa_verify_fail', ip, ua, meta: { reason: 'enroll_error', err: (e as Error).message.slice(0, 140) } })
    return jsonError(500, 'mfa_enroll_failed')
  }
}
