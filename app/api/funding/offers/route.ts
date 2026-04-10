import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/funding/offers
// body: { dossier_id, amount_eur, interest_rate_pct, duration_months, has_insurance, fees_eur, message }
// Creates a funding offer from the current financeur user.

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
    const body = await req.json() as {
      dossier_id: string
      amount_eur: number
      interest_rate_pct?: number
      duration_months?: number
      has_insurance?: boolean
      fees_eur?: number
      message?: string
    }
    if (!body.dossier_id || !body.amount_eur) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check financeur role (or admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, is_admin, is_delegate_admin')
      .eq('id', user.id)
      .single()
    const roles = (profile?.roles ?? []) as string[]
    const isAdmin = profile?.is_admin || profile?.is_delegate_admin
    if (!roles.includes('financeur') && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden — financeur role required' }, { status: 403 })
    }

    // Verify target dossier exists and is of type 'financement'
    const { data: dossier } = await supabase
      .from('funding_dossiers')
      .select('id, type, status')
      .eq('id', body.dossier_id)
      .single()
    if (!dossier || dossier.type !== 'financement') {
      return NextResponse.json({ error: 'Invalid target dossier' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('funding_offers')
      .insert({
        dossier_id: body.dossier_id,
        financeur_id: user.id,
        amount_eur: body.amount_eur,
        interest_rate_pct: body.interest_rate_pct ?? null,
        duration_months: body.duration_months ?? null,
        has_insurance: body.has_insurance ?? false,
        fees_eur: body.fees_eur ?? null,
        message: body.message ?? null,
        status: 'sent',
      })
      .select('id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, created_at: data.created_at }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
