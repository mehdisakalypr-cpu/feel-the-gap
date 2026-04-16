import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { createHash } from 'crypto'
import { enrollUser } from '@/lib/email/sequences'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/map'

  if (code) {
    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      },
    )
    const { data, error } = await sb.auth.exchangeCodeForSession(code)

    // ── Email drip enrollment (onboarding) ────────────────────────────
    if (!error && data.user?.id) {
      enrollUser(data.user.id, 'onboarding').catch((e) =>
        console.error('[auth/callback] enroll onboarding failed', e?.message || e),
      )
    }

    // ── Referral capture ──────────────────────────────────────────────
    if (!error && data.user) {
      try {
        const refCookie = cookieStore.get('ftg_ref')?.value
        if (refCookie) {
          const parsed = JSON.parse(refCookie) as { code?: string; ts?: number }
          if (parsed.code) {
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
            await admin.rpc('record_referral_signup', {
              p_code: parsed.code,
              p_referee: data.user.id,
              p_ip: ip,
              p_fp: fp,
            })
          }
        }
      } catch (e) {
        console.warn('[auth/callback] referral capture failed', e)
      }
      // Always clear the cookie after signup flow
      cookieStore.set('ftg_ref', '', { path: '/', maxAge: 0 })
      return NextResponse.redirect(`${origin}${next}`)
    }
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
