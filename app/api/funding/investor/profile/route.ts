import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// GET /api/funding/investor/profile
// Returns the caller's investor_profiles row (or null).
export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await sb
    .from('investor_profiles')
    .select('*')
    .eq('investor_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

// POST /api/funding/investor/profile
// Body: { sectors, subsectors, ticket_min_eur, ticket_max_eur, countries, stages }
// Upserts the caller's matching profile.
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    sectors?: string[]
    subsectors?: string[]
    ticket_min_eur?: number | null
    ticket_max_eur?: number | null
    countries?: string[]
    stages?: string[]
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const sanitizeArr = (arr?: unknown, max = 30) =>
    Array.isArray(arr)
      ? (arr as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, max)
      : []

  const payload = {
    investor_id: user.id,
    sectors: sanitizeArr(body.sectors),
    subsectors: sanitizeArr(body.subsectors, 60),
    ticket_min_eur: typeof body.ticket_min_eur === 'number' && body.ticket_min_eur >= 0 ? body.ticket_min_eur : null,
    ticket_max_eur: typeof body.ticket_max_eur === 'number' && body.ticket_max_eur >= 0 ? body.ticket_max_eur : null,
    countries: sanitizeArr(body.countries).map(c => c.toUpperCase()),
    stages: sanitizeArr(body.stages, 10),
  }

  const { data, error } = await sb
    .from('investor_profiles')
    .upsert(payload, { onConflict: 'investor_id' })
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
