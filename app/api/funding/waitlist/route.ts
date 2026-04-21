import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/funding/waitlist
// Body: { email, role_kind: 'financeur'|'investisseur', profile: { sectors?:string[], ticket_min_eur?:number, ticket_max_eur?:number, countries?:string[], stages?:string[] } }
// Public endpoint. Uses admin client to bypass RLS INSERT, but only accepts whitelisted fields.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      email?: string
      role_kind?: 'financeur' | 'investisseur'
      profile?: Record<string, unknown>
    } | null
    if (!body?.email || !body.role_kind) {
      return NextResponse.json({ error: 'email and role_kind required' }, { status: 400 })
    }
    if (!['financeur', 'investisseur'].includes(body.role_kind)) {
      return NextResponse.json({ error: 'invalid role_kind' }, { status: 400 })
    }
    const email = body.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    // Whitelist profile keys
    const p = body.profile ?? {}
    const safeProfile = {
      sectors: Array.isArray(p.sectors) ? (p.sectors as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 30) : [],
      countries: Array.isArray(p.countries) ? (p.countries as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 30) : [],
      stages: Array.isArray(p.stages) ? (p.stages as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10) : [],
      ticket_min_eur: typeof p.ticket_min_eur === 'number' && p.ticket_min_eur >= 0 ? p.ticket_min_eur : null,
      ticket_max_eur: typeof p.ticket_max_eur === 'number' && p.ticket_max_eur >= 0 ? p.ticket_max_eur : null,
    }

    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('investor_waitlist')
      .upsert({ email, role_kind: body.role_kind, profile: safeProfile }, { onConflict: 'email,role_kind' })
      .select('id, signed_up_at')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Recompute marketplace state (increment waitlist_count) — best-effort.
    try { await admin.rpc('recompute_marketplace_state') } catch { /* ignore */ }

    return NextResponse.json({ ok: true, id: data?.id, signed_up_at: data?.signed_up_at })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/funding/waitlist  — admin only: list waitlist entries
export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin, is_delegate_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin && !profile?.is_delegate_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('investor_waitlist')
    .select('id, email, role_kind, profile, signed_up_at, notified_at, converted_user_id')
    .order('signed_up_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
