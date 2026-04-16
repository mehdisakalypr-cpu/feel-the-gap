import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { checkPassword } from '@/lib/hibp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const email = (body.email || '').trim().toLowerCase()
  const code = (body.code || '').trim()
  const password = body.password || ''

  if (!email || !code || !password) {
    return NextResponse.json({ error: 'Email, code et mot de passe requis' }, { status: 400 })
  }
  if (password.length < 12) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 12 caractères.' }, { status: 400 })
  }

  // HIBP check — reject compromised passwords
  const hibp = await checkPassword(password)
  if (hibp.pwned) {
    return NextResponse.json({
      error: `Ce mot de passe a été compromis dans ${hibp.count.toLocaleString('fr-FR')} fuites. Choisis-en un autre.`,
    }, { status: 400 })
  }

  const ip = getClientIp(req)
  const ipRl = await rateLimit({ key: `pwreset-verify:ip:${ip}`, limit: 10, windowSec: 900 })
  if (!ipRl.ok) return NextResponse.json({ error: 'Trop de tentatives.', retryAfter: ipRl.retryAfter }, { status: 429 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const codeHash = sha256(code)

  // Fetch most recent unused non-expired OTP for this email
  const { data: otpRow } = await admin
    .from('password_reset_otps')
    .select('id, code_hash, attempts, expires_at, used_at')
    .eq('email', email)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!otpRow) {
    return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 400 })
  }

  // Check attempts
  if (otpRow.attempts >= 5) {
    await admin.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otpRow.id)
    return NextResponse.json({ error: 'Trop d\'essais sur ce code. Demande un nouveau code.' }, { status: 400 })
  }

  if (otpRow.code_hash !== codeHash) {
    await admin.from('password_reset_otps').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id)
    return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 })
  }

  // Valid OTP — look up user and update password
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 })
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Mark OTP as used
  await admin.from('password_reset_otps').update({ used_at: new Date().toISOString() }).eq('id', otpRow.id)

  return NextResponse.json({ ok: true })
}
