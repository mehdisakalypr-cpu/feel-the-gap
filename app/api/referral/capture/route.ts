import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createHash } from 'crypto'
import { getAuthUser } from '@/lib/supabase-server'

/**
 * POST /api/referral/capture
 * Called client-side right after signUp succeeds (session-or-not).
 * Reads the ftg_ref cookie, records the referral, clears the cookie.
 */
export async function POST(_req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  const raw = cookieStore.get('ftg_ref')?.value
  if (!raw) return NextResponse.json({ ok: true, skipped: 'no_cookie' })

  let code: string | null = null
  try {
    const parsed = JSON.parse(raw) as { code?: string }
    code = parsed.code ?? null
  } catch {
    cookieStore.set('ftg_ref', '', { path: '/', maxAge: 0 })
    return NextResponse.json({ ok: true, skipped: 'bad_cookie' })
  }
  if (!code) return NextResponse.json({ ok: true, skipped: 'no_code' })

  const hdrs = await headers()
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0].trim() || hdrs.get('x-real-ip') || '0.0.0.0'
  const ua = hdrs.get('user-agent') ?? ''
  const lang = hdrs.get('accept-language') ?? ''
  const fp = createHash('sha256').update(`${ip}|${ua}|${lang}`).digest('hex').slice(0, 16)

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data, error } = await admin.rpc('record_referral_signup', {
    p_code: code,
    p_referee: user.id,
    p_ip: ip,
    p_fp: fp,
  })

  cookieStore.set('ftg_ref', '', { path: '/', maxAge: 0 })

  if (error) {
    console.error('[referral/capture] rpc error', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, referral_id: data })
}
