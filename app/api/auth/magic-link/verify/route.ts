/**
 * POST /api/auth/magic-link/verify
 *
 * Spec (per brief): client calls sb.auth.verifyOtp({type:'magiclink', token_hash}) directly.
 * This route is a server-side webhook AFTER that exchange:
 *   - confirm a session cookie is now set (supabaseServer().auth.getUser())
 *   - ensure site-access is granted (auto-grant 'user' if missing — first time on this site)
 *   - emit audit log
 *
 * COMPROMISE: we do not re-call Supabase verifyOtp server-side (the session is already posted
 * via cookies). Instead we gate strictly on an authenticated session existing.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  supabaseServer,
  supabaseAdmin,
  getAuthConfig,
  getClientIp,
  grantAccess,
  userHasAccess,
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

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  const sb = await supabaseServer()
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return jsonError(401, 'no_session')

  const user = data.user
  const cfg = getAuthConfig()

  // Auto-provision site access on first magic-link login.
  const hasAccess = await userHasAccess(user.id)
  if (!hasAccess) {
    try { await grantAccess(user.id, 'user') } catch { /* best-effort */ }
    await logEvent({ userId: user.id, event: 'site_access_granted', ip, ua, meta: { via: 'magic_link' } })
  }

  // Best-effort mark magic-link as consumed if we tracked one.
  try {
    const admin = supabaseAdmin()
    await admin.from('auth_magic_links')
      .update({ consumed_at: new Date().toISOString() })
      .eq('site_slug', cfg.siteSlug)
      .is('consumed_at', null)
      .eq('email_hash', await (async () => {
        const crypto = await import('node:crypto')
        return crypto.createHash('sha256').update((user.email ?? '').toLowerCase()).digest()
      })())
  } catch { /* table optional */ }

  await logEvent({ userId: user.id, event: 'magic_link_verified', ip, ua })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
