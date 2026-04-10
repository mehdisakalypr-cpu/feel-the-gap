import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/admin/demo-tier   body: { email, tier }
// Admin-only. Toggles the `tier` of a demo account between 'free' and a target
// paying tier ('strategy', 'premium', ...). Whitelist restricted to demo emails.

function isDemoEmail(email: string): boolean {
  return /^demo\.[a-z]+@feelthegap\.app$/.test(email)
}

const VALID_TIERS = new Set(['free', 'explorer', 'data', 'strategy', 'premium'])

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; tier?: string }
    const email = body.email?.trim().toLowerCase() ?? ''
    const tier = body.tier ?? ''

    if (!isDemoEmail(email)) {
      return NextResponse.json({ error: 'Target must be a demo account' }, { status: 400 })
    }
    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin, is_delegate_admin')
      .eq('id', caller.id)
      .single()
    const isAdmin = callerProfile?.is_admin === true || callerProfile?.is_delegate_admin === true
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    // Find the demo account's id and update tier
    const { data: target } = await supabase
      .from('profiles')
      .select('id, tier')
      .eq('email', email)
      .single()
    if (!target) return NextResponse.json({ error: 'Demo account not found' }, { status: 404 })

    const { error } = await supabase
      .from('profiles')
      .update({ tier })
      .eq('id', target.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, email, tier, previous_tier: target.tier })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/admin/demo-tier — returns all demo accounts with their current tier.
export async function GET() {
  try {
    const supabase = await getSupabase()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('is_admin, is_delegate_admin')
      .eq('id', caller.id)
      .single()
    const isAdmin = callerProfile?.is_admin === true || callerProfile?.is_delegate_admin === true
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

    const { data, error } = await supabase
      .from('profiles')
      .select('email, tier, roles')
      .like('email', 'demo.%@feelthegap.app')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ accounts: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
