import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { generateToken, TIER_DEFAULTS, type ApiTier } from '@/lib/api-platform/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getUser() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* readonly in route handler */ },
      },
    },
  )
  const { data } = await sb.auth.getUser()
  return data.user
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = admin()
  const { data, error } = await sb
    .from('api_tokens')
    .select('id, name, token_prefix, tier, rate_limit_per_min, rate_limit_per_day, permissions, last_used_at, usage_total, revoked_at, expires_at, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, tokens: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 80) || 'My API Token'
  const tier = (['starter', 'pro', 'enterprise', 'sovereign'].includes(body.tier) ? body.tier : 'starter') as ApiTier
  const permissions = Array.isArray(body.permissions) && body.permissions.length > 0
    ? body.permissions.map((p: unknown) => String(p)).slice(0, 20)
    : ['opportunities:read']

  const defaults = TIER_DEFAULTS[tier]
  const { token, prefix, hash } = generateToken()

  const sb = admin()
  const { data, error } = await sb.from('api_tokens').insert({
    owner_id: user.id,
    name,
    token_prefix: prefix,
    token_hash: hash,
    tier,
    rate_limit_per_min: defaults.perMin,
    rate_limit_per_day: defaults.perDay,
    permissions,
  }).select('id, name, token_prefix, tier, created_at').maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  }
  // Token clair renvoyé UNE SEULE FOIS au moment de la création
  return NextResponse.json({ ok: true, token, record: data })
}
