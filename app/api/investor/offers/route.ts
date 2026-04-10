import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// POST /api/investor/offers
// body: { dossier_id, pct_capital, platform_valuation_eur, user_valuation_eur?, amount_eur, is_counter_proposal, message }
// Creates an investment offer from the current investisseur user.

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
      pct_capital: number
      platform_valuation_eur: number
      user_valuation_eur?: number | null
      amount_eur: number
      is_counter_proposal?: boolean
      message?: string
    }
    if (!body.dossier_id || body.pct_capital == null || !body.amount_eur) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (body.pct_capital < 0 || body.pct_capital > 33) {
      return NextResponse.json({ error: 'pct_capital must be between 0 and 33' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check investisseur role (or admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, is_admin, is_delegate_admin')
      .eq('id', user.id)
      .single()
    const roles = (profile?.roles ?? []) as string[]
    const isAdmin = profile?.is_admin || profile?.is_delegate_admin
    if (!roles.includes('investisseur') && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden — investisseur role required' }, { status: 403 })
    }

    // Verify target dossier exists and is of type 'investissement'
    const { data: dossier } = await supabase
      .from('funding_dossiers')
      .select('id, type, status')
      .eq('id', body.dossier_id)
      .single()
    if (!dossier || dossier.type !== 'investissement') {
      return NextResponse.json({ error: 'Invalid target dossier' }, { status: 400 })
    }

    const warningFlagged = body.is_counter_proposal === true
      && body.user_valuation_eur != null
      && body.user_valuation_eur !== body.platform_valuation_eur

    const { data, error } = await supabase
      .from('investor_offers')
      .insert({
        dossier_id: body.dossier_id,
        investor_id: user.id,
        pct_capital: body.pct_capital,
        platform_valuation_eur: body.platform_valuation_eur,
        user_valuation_eur: body.user_valuation_eur ?? null,
        valuation_warning_flagged: warningFlagged,
        amount_eur: body.amount_eur,
        message: body.message ?? null,
        status: 'sent',
      })
      .select('id, created_at, valuation_warning_flagged')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      id: data.id,
      created_at: data.created_at,
      warning: data.valuation_warning_flagged,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
