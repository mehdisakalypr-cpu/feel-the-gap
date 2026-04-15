import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Server-side login proxy with IP rate-limiting.
 * - Limits: 5 attempts / 5 minutes per IP (login:<ip>)
 * - Also: 10 attempts / 15 minutes per email (login:email:<email>) to slow
 *   distributed-IP credential-stuffing on a single account.
 *
 * On success returns { access_token, refresh_token, user } so the client can
 * hydrate the Supabase session with sb.auth.setSession(...).
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; captchaToken?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const captchaToken = body.captchaToken

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const ip = getClientIp(req)

  // Per-IP limit (abuse control)
  const ipRl = await rateLimit({ key: `login:ip:${ip}`, limit: 5, windowSec: 300 })
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait and try again.', retryAfter: ipRl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(ipRl.retryAfter), 'X-RateLimit-Limit': String(ipRl.limit), 'X-RateLimit-Remaining': '0' } }
    )
  }

  // Per-email limit (credential stuffing defence across IPs)
  const emailRl = await rateLimit({ key: `login:email:${email}`, limit: 10, windowSec: 900 })
  if (!emailRl.ok) {
    return NextResponse.json(
      { error: 'Account temporarily locked. Try again in a few minutes.', retryAfter: emailRl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(emailRl.retryAfter) } }
    )
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  })

  if (error || !data.session) {
    // Uniform response to avoid user-enumeration
    return NextResponse.json(
      { error: error?.message || 'Invalid credentials' },
      { status: 401, headers: { 'X-RateLimit-Limit': String(ipRl.limit), 'X-RateLimit-Remaining': String(Math.max(0, ipRl.remaining - 1)) } }
    )
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: data.user?.id, email: data.user?.email },
  })
}
