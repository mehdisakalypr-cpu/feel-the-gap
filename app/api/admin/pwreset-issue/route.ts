import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomInt } from 'crypto'
import { requireAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/**
 * Admin-only: issue a password reset OTP for ANY email and return it in
 * the response (bypass email entirely). Useful when:
 *   - The user's email is broken / Resend quota exhausted
 *   - Support agent needs to unblock a user
 *
 * Audit: every call writes to password_reset_otps with ip_address=admin IP.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: profile } = await admin.from('profiles').select('id, email').eq('email', email).maybeSingle()
  if (!profile?.id) return NextResponse.json({ error: 'No user with that email' }, { status: 404 })

  const otp = String(randomInt(100000, 1000000))
  const codeHash = sha256(otp)

  const { error } = await admin.from('password_reset_otps').insert({
    email,
    code_hash: codeHash,
    ip_address: req.headers.get('x-forwarded-for') || 'admin-issued',
    user_agent: 'admin-issued',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    otp,
    email,
    expires_in_minutes: 10,
    instructions: `Use this code at /auth/forgot, step "Entrez le code reçu par email". Valid 10 minutes, 5 attempts max.`,
  })
}
