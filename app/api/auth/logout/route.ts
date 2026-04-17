/**
 * POST /api/auth/logout
 *
 * - CSRF protected (double-submit)
 * - Destroys current session via Supabase SSR client
 * - Emits Clear-Site-Data + no-store
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  assertCsrf,
  supabaseServer,
  applyLogoutHeaders,
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

  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  let userId: string | null = null
  try {
    const sb = await supabaseServer()
    const { data } = await sb.auth.getUser()
    userId = data?.user?.id ?? null
    await sb.auth.signOut()
  } catch {
    // Ignore — we still return a "clean" response so the client flushes local state.
  }

  await logEvent({ userId, event: 'logout', ip, ua })

  const res = NextResponse.json({ ok: true })
  applyLogoutHeaders(res)
  return res
}
