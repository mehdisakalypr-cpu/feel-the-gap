/**
 * GET /api/auth/me
 *
 * Returns a safe projection of the current user + session posture:
 *   { user:{id,email,role,site_slug}, mfa_enabled, passkeys_count }
 *
 * - Requires an authenticated session (requireUser)
 * - Does NOT emit any write; audit log is skipped here (high-frequency endpoint)
 */

import { NextResponse } from 'next/server'
import {
  requireUser,
  getUserRole,
  getAuthConfig,
  hasCredentials,
  hasActiveTotp,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonError(status: number, error: string) {
  const res = NextResponse.json({ ok: false, error }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function GET() {
  const user = await requireUser()
  if (!user) return jsonError(401, 'unauthorized')

  const cfg = getAuthConfig()

  const [role, creds, mfa] = await Promise.all([
    getUserRole(user.id),
    user.email ? hasCredentials(user.email) : Promise.resolve({ available: false, count: 0 }),
    hasActiveTotp(user.id),
  ])

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      role: role ?? null,
      site_slug: cfg.siteSlug,
    },
    mfa_enabled: mfa,
    passkeys_count: creds.count,
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
