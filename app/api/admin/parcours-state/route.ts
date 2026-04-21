import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = ['financeur', 'investisseur', 'influenceur'] as const
type Role = typeof ROLES[number]

async function requireAdmin() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await sb.from('profiles').select('is_admin, is_delegate_admin').eq('id', user.id).single()
  if (!profile?.is_admin && !profile?.is_delegate_admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// GET /api/admin/parcours-state
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { data, error } = await admin().from('parcours_state').select('*').order('role_kind')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// POST /api/admin/parcours-state  body: { role: 'financeur'|'investisseur'|'influenceur', enabled: bool, reason?: string }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null) as { role?: string; enabled?: boolean; reason?: string } | null
  if (!body?.role || !(ROLES as readonly string[]).includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    enabled: body.enabled,
    updated_by: auth.user.id,
    reason: (body.reason ?? '').slice(0, 500) || null,
    updated_at: now,
  }
  if (body.enabled) payload.enabled_at = now
  else payload.disabled_at = now

  const { data, error } = await admin()
    .from('parcours_state').update(payload).eq('role_kind', body.role as Role).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}
