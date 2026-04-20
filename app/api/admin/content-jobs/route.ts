import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function requireAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin ? user : null
}

type Body = {
  mode: 'full' | 'per_country' | 'per_opportunity' | 'per_pair'
  country_iso?: string
  opp_id?: string
  job_type: 'full' | 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos'
  lang?: string
  priority?: number
}

export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body: Body = await req.json()
  const lang = body.lang || 'fr'
  const priority = body.priority ?? 100
  const db = admin()

  const pairs: Array<{ opp_id: string; country_iso: string }> = []

  if (body.mode === 'per_pair') {
    if (!body.opp_id || !body.country_iso) {
      return NextResponse.json({ error: 'opp_id et country_iso requis' }, { status: 400 })
    }
    pairs.push({ opp_id: body.opp_id, country_iso: body.country_iso })
  } else if (body.mode === 'per_opportunity') {
    if (!body.opp_id) return NextResponse.json({ error: 'opp_id requis' }, { status: 400 })
    const { data: opp } = await db.from('opportunities').select('id, country_iso').eq('id', body.opp_id).maybeSingle()
    if (!opp) return NextResponse.json({ error: 'opp not found' }, { status: 404 })
    pairs.push({ opp_id: opp.id, country_iso: opp.country_iso })
  } else if (body.mode === 'per_country') {
    if (!body.country_iso) return NextResponse.json({ error: 'country_iso requis' }, { status: 400 })
    const { data: opps } = await db
      .from('opportunities')
      .select('id')
      .eq('country_iso', body.country_iso)
      .order('gap_value_usd', { ascending: false })
      .limit(50) // cap raisonnable per country
    for (const o of (opps || [])) pairs.push({ opp_id: o.id, country_iso: body.country_iso })
  } else if (body.mode === 'full') {
    // Cap à 500 paires top (gap value) pour éviter blast initial
    const { data: opps } = await db
      .from('opportunities')
      .select('id, country_iso')
      .order('gap_value_usd', { ascending: false })
      .limit(500)
    for (const o of (opps || [])) pairs.push({ opp_id: o.id, country_iso: o.country_iso })
  }

  if (pairs.length === 0) {
    return NextResponse.json({ enqueued: 0, message: 'no pairs matched' })
  }

  const rows = pairs.map((p) => ({
    job_type: body.job_type,
    opp_id: p.opp_id,
    country_iso: p.country_iso,
    lang,
    priority,
    source: body.mode === 'per_pair' ? 'per_pair' : body.mode,
    triggered_by: user.id,
    status: 'pending',
  }))

  // Batch insert 100 at a time
  let enqueued = 0
  for (let i = 0; i < rows.length; i += 100) {
    const { error, count } = await db.from('ftg_content_jobs').insert(rows.slice(i, i + 100), { count: 'exact' })
    if (error) return NextResponse.json({ error: error.message, enqueued }, { status: 500 })
    enqueued += count || 0
  }

  return NextResponse.json({ enqueued, total_pairs: pairs.length })
}
