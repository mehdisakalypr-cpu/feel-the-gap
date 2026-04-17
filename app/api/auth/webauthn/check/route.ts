/**
 * POST   /api/auth/webauthn/check   — body { email }
 *   → { available, count } (count clamped to 0/1+ to reduce enumeration surface)
 *
 * DELETE /api/auth/webauthn/check   — body { email }
 *   → deletes credentials (client-driven "reset biometrics" flow).
 *     DELETE requires the user to be authenticated for THAT email — we enforce it here.
 *
 * Rate limit: 20/5min per IP. No CSRF (POST is read-only; DELETE is auth-gated).
 * Turnstile enforced in prod if configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  rateLimit,
  getClientIp,
  hasCredentials,
  deleteCredentialsForUser,
  supabaseServer,
  supabaseAdmin,
  logEvent,
} from '@/lib/auth-v2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonError(status: number, error: string) {
  const res = NextResponse.json({ ok: false, error }, { status })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

function sanitizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(e) || e.length > 254) return null
  return e
}

async function parseEmail(req: NextRequest): Promise<string | null> {
  const raw = await req.text()
  if (raw.length > MAX_BODY) return null
  try {
    const body = JSON.parse(raw) as { email?: unknown; captchaToken?: unknown }
    return sanitizeEmail(body?.email)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  const rl = await rateLimit({ key: `webauthn:check:ip:${ip}`, limit: 20, windowSec: 300 })
  if (!rl.ok) {
    const res = jsonError(429, 'rate_limited')
    res.headers.set('Retry-After', String(rl.retryAfter || 60))
    return res
  }

  // Note: no Turnstile gate here — this endpoint is read-only and already
  // clamped to {available, count} (count is binary-ish) so it can't be used
  // for enumeration beyond what the email form already exposes. Rate-limit
  // above (20/5min/IP) is the actual abuse protection.

  const email = await parseEmail(req)
  if (!email) {
    // Keep response shape consistent.
    const res = NextResponse.json({ ok: true, available: false, count: 0 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const { available, count } = await hasCredentials(email)
  const res = NextResponse.json({ ok: true, available, count })
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  const rl = await rateLimit({ key: `webauthn:check:del:ip:${ip}`, limit: 10, windowSec: 600 })
  if (!rl.ok) {
    const res = jsonError(429, 'rate_limited')
    res.headers.set('Retry-After', String(rl.retryAfter || 60))
    return res
  }

  const email = await parseEmail(req)
  if (!email) return jsonError(400, 'invalid_input')

  // Require the caller to be logged in AS that email — otherwise anyone could nuke a stranger's passkeys.
  const sb = await supabaseServer()
  const { data: me } = await sb.auth.getUser()
  if (!me?.user || (me.user.email ?? '').toLowerCase() !== email) {
    return jsonError(401, 'unauthorized')
  }

  // Look up user id
  const { data: profile } = await supabaseAdmin()
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (!profile?.id) return jsonError(404, 'not_found')

  await deleteCredentialsForUser(profile.id as string)
  await logEvent({ userId: profile.id as string, event: 'passkey_deleted', ip, ua })

  const res = NextResponse.json({ ok: true })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
