import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// POST /api/funding/offers
// Polymorphic offer creation — kind='funding' for financeurs (debt), kind='investor' for investisseurs (equity).
//
// Funding body:  { kind:'funding', dossier_id, amount_eur, interest_rate_pct?, duration_months?, has_insurance?, fees_eur?, message?, contact_requested? }
// Investor body: { kind:'investor', dossier_id, pct_capital, platform_valuation_eur, user_valuation_eur?, amount_eur, message?, contact_requested? }
//
// Enforces the caller has the right role and the dossier type matches.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      kind?: 'funding' | 'investor'
      dossier_id: string
      amount_eur: number
      // funding
      interest_rate_pct?: number
      duration_months?: number
      has_insurance?: boolean
      fees_eur?: number
      // investor
      pct_capital?: number
      platform_valuation_eur?: number
      user_valuation_eur?: number
      // shared
      message?: string
      contact_requested?: boolean
    }
    const kind = body.kind ?? 'funding'
    if (!body.dossier_id || !body.amount_eur) {
      return NextResponse.json({ error: 'dossier_id and amount_eur required' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await sb
      .from('profiles')
      .select('roles, is_admin, is_delegate_admin')
      .eq('id', user.id)
      .single()
    const roles = (profile?.roles ?? []) as string[]
    const isAdmin = profile?.is_admin || profile?.is_delegate_admin
    const requiredRole = kind === 'funding' ? 'financeur' : 'investisseur'
    if (!roles.includes(requiredRole) && !isAdmin) {
      return NextResponse.json({ error: `Forbidden — ${requiredRole} role required` }, { status: 403 })
    }

    const { data: dossier } = await sb
      .from('funding_dossiers')
      .select('id, type, status, is_in_catalog')
      .eq('id', body.dossier_id)
      .single()
    const expectedType = kind === 'funding' ? 'financement' : 'investissement'
    if (!dossier || dossier.type !== expectedType) {
      return NextResponse.json({ error: 'Invalid target dossier' }, { status: 400 })
    }
    if (!dossier.is_in_catalog && !isAdmin) {
      return NextResponse.json({ error: 'Dossier not in catalog yet' }, { status: 400 })
    }

    if (kind === 'funding') {
      const { data, error } = await sb
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
          contact_requested: body.contact_requested ?? false,
          status: 'sent',
        })
        .select('id, created_at')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ id: data.id, kind, created_at: data.created_at }, { status: 201 })
    }

    // investor
    if (typeof body.pct_capital !== 'number' || body.pct_capital <= 0 || body.pct_capital > 33) {
      return NextResponse.json({ error: 'pct_capital must be in (0, 33]' }, { status: 400 })
    }
    if (typeof body.platform_valuation_eur !== 'number' || body.platform_valuation_eur <= 0) {
      return NextResponse.json({ error: 'platform_valuation_eur required' }, { status: 400 })
    }
    const userValo = typeof body.user_valuation_eur === 'number' ? body.user_valuation_eur : null
    const valuationWarning = userValo != null && userValo > body.platform_valuation_eur * 1.5

    const { data, error } = await sb
      .from('investor_offers')
      .insert({
        dossier_id: body.dossier_id,
        investor_id: user.id,
        pct_capital: body.pct_capital,
        platform_valuation_eur: body.platform_valuation_eur,
        user_valuation_eur: userValo,
        valuation_warning_flagged: valuationWarning,
        amount_eur: body.amount_eur,
        message: body.message ?? null,
        contact_requested: body.contact_requested ?? false,
        status: 'sent',
      })
      .select('id, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, kind, created_at: data.created_at }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
