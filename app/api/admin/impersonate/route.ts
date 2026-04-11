import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/admin/impersonate   body: { email, target_url? }
// Admin-only. Signs out current admin and signs in as the target demo account,
// then returns the target URL for the frontend to redirect to. All in one
// response so cookies are properly set.
//
// Security:
//   - Caller must be admin (is_admin or is_delegate_admin)
//   - Only allowed to impersonate accounts whose email starts with "demo."
//     and ends with "@feelthegap.app" — hard whitelist, no escalation possible.

const DEMO_PASSWORD = process.env.DEMO_PASSWORD
if (!DEMO_PASSWORD) console.warn('[security] DEMO_PASSWORD env var not set — impersonation disabled')

function isDemoEmail(email: string): boolean {
  return /^demo\.[a-z]+@feelthegap\.app$/.test(email)
}

// Default landing per target role (best-effort based on email convention)
const TARGET_HOMES: Record<string, string> = {
  'demo.entrepreneur@feelthegap.app': '/map',
  'demo.influenceur@feelthegap.app':  '/influencer/catalog',
  'demo.financeur@feelthegap.app':    '/finance',
  'demo.investisseur@feelthegap.app': '/invest',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; target_url?: string }
    const targetEmail = body.email?.trim().toLowerCase() ?? ''
    if (!isDemoEmail(targetEmail)) {
      return NextResponse.json({ error: 'Target email is not a demo account' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    // 1. Verify caller is admin
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin, is_delegate_admin')
      .eq('id', caller.id)
      .single()

    const isAdmin = callerProfile?.is_admin === true || callerProfile?.is_delegate_admin === true
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    // 2. Verify DEMO_PASSWORD is configured
    if (!DEMO_PASSWORD) return NextResponse.json({ error: 'Impersonation disabled — DEMO_PASSWORD not configured' }, { status: 503 })

    // 3. Sign out current session
    await supabase.auth.signOut()

    // 4. Sign in as target demo account with shared password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: DEMO_PASSWORD,
    })
    if (signInError) {
      return NextResponse.json({ error: `Sign in failed: ${signInError.message}` }, { status: 500 })
    }

    // 4. Return redirect URL
    const redirectUrl = body.target_url ?? TARGET_HOMES[targetEmail] ?? '/map'
    return NextResponse.json({ ok: true, redirect: redirectUrl, email: targetEmail })
  } catch (err) {
    console.error('[impersonate] error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
