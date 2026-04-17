/**
 * Session utilities.
 * - revokeAllSessions: invalidate tokens after password reset / admin action.
 * - rotate: trigger Supabase session rotation by forcing a refresh.
 * - clearClientSiteData: response helper to flush storage on logout.
 */

import type { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-server'

/** Sign out ALL user sessions (all devices). Used after password reset / compromise. */
export async function revokeAllSessions(userId: string) {
  const sb = supabaseAdmin()
  // Supabase admin SDK exposes signOut with scope
  await sb.auth.admin.signOut(userId, 'global')
}

/** Attach security cookies + Clear-Site-Data on logout response. */
export function applyLogoutHeaders(res: NextResponse) {
  res.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

/** Security headers injected by middleware on every response. */
export function applySecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), publickey-credentials-get=(self)')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  // NOTE: CSP set per-route where needed; here we keep a permissive default.
  return res
}
