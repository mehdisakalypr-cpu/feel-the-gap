/**
 * GET /api/auth/csrf
 *
 * Issues a fresh CSRF token in the `csrf` cookie (double-submit pattern).
 * Clients (login, register, forgot…) call this at mount so they can echo the
 * token via x-csrf-token on subsequent unsafe requests.
 *
 * No authentication required — the token is HMAC-signed and short-lived.
 */

import { NextResponse } from 'next/server'
import { attachCsrfCookie, issueCsrfToken } from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const token = issueCsrfToken()
  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  attachCsrfCookie(res, token)
  return res
}
