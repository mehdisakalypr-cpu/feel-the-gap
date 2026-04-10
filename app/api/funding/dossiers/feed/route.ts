import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// GET /api/funding/dossiers/feed?type=financement|investissement
//   &country=CIV    (optional filter)
//   &min=100000     (amount min filter)
//   &max=500000     (amount max filter)
//
// Returns dossiers anonymized ("Dossier #1, Dossier #2…") for display to
// financeurs (type=financement) or investisseurs (type=investissement).
// Only dossiers with status in ('submitted','under_review','matched') are returned.
// Access gated by caller's role via RLS: policies in 20260409220000_funding_platform.sql.

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    if (type !== 'financement' && type !== 'investissement') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    const country = searchParams.get('country')?.toUpperCase()
    const min = searchParams.get('min') ? Number(searchParams.get('min')) : null
    const max = searchParams.get('max') ? Number(searchParams.get('max')) : null

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load caller roles to gate access
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, is_admin, is_delegate_admin')
      .eq('id', user.id)
      .single()
    const roles = (profile?.roles ?? []) as string[]
    const isAdmin = profile?.is_admin || profile?.is_delegate_admin
    const requiredRole = type === 'financement' ? 'financeur' : 'investisseur'
    if (!roles.includes(requiredRole) && !isAdmin) {
      return NextResponse.json({ error: `Forbidden — role ${requiredRole} required` }, { status: 403 })
    }

    let query = supabase
      .from('funding_dossiers')
      .select('id, public_number, type, country_iso, product_slug, amount_eur, status, quality_score, submitted_at, created_at')
      .eq('type', type)
      .in('status', ['submitted', 'under_review', 'matched'])
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (country) query = query.eq('country_iso', country)
    if (min) query = query.gte('amount_eur', min)
    if (max) query = query.lte('amount_eur', max)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Anonymize: assign a synthetic public_number if missing, don't expose user_id or title
    const dossiers = (data ?? []).map((d, idx) => ({
      id: d.id,
      public_number: d.public_number ?? idx + 1,
      type: d.type,
      country_iso: d.country_iso,
      product_slug: d.product_slug,
      amount_eur: d.amount_eur,
      status: d.status,
      quality_score: d.quality_score,
      submitted_at: d.submitted_at ?? d.created_at,
      display_name: `Dossier #${d.public_number ?? idx + 1}`,
    }))

    // Group by country for map/filters
    const byCountry: Record<string, number> = {}
    for (const d of dossiers) {
      if (d.country_iso) byCountry[d.country_iso] = (byCountry[d.country_iso] ?? 0) + 1
    }

    return NextResponse.json({ dossiers, countries: byCountry })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
