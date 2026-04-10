import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// GET /api/funding/dossiers/[id]/view
//
// Returns the dossier details for a financeur or investisseur. Anonymized
// fields (company name, founder names) are replaced with "Dossier #N" unless
// the caller has Premium (finance_premium / invest_premium tier) or is admin.
//
// RLS: funding_dossiers_financeur_read / _investor_read policies already gate by role.

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

// Keys considered sensitive — replaced with "***" unless caller has full access.
const SENSITIVE_KEYS = new Set([
  'company_name', 'siren', 'kbis', 'address', 'phone', 'email',
  'founders', 'founder_name', 'full_name', 'contact',
  'shareholders', 'cap_table',
])

function redactAnswers(answers: Record<string, unknown>, allowFull: boolean): Record<string, unknown> {
  if (allowFull) return answers
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(answers)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '••• (Premium requis)' : v
  }
  return out
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check caller profile — need roles + tier + admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, tier, is_admin, is_delegate_admin')
      .eq('id', user.id)
      .single()
    const roles = (profile?.roles ?? []) as string[]
    const isAdmin = profile?.is_admin || profile?.is_delegate_admin
    const tier = profile?.tier as string | undefined

    // Load the dossier
    const { data: dossier, error } = await supabase
      .from('funding_dossiers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!dossier) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Access gate — caller must have the right role OR be the owner OR admin
    const requiredRole = dossier.type === 'financement' ? 'financeur' : 'investisseur'
    const isOwner = dossier.user_id === user.id
    const hasRole = roles.includes(requiredRole)
    if (!isOwner && !hasRole && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Full access: owner, admin, or premium tier for the corresponding role
    const hasPremium = tier === 'premium' || tier === 'enterprise'
    const allowFull = isOwner || isAdmin || hasPremium

    return NextResponse.json({
      dossier: {
        id: dossier.id,
        type: dossier.type,
        country_iso: dossier.country_iso,
        product_slug: dossier.product_slug,
        amount_eur: dossier.amount_eur,
        status: dossier.status,
        quality_score: dossier.quality_score,
        public_number: dossier.public_number,
        submitted_at: dossier.submitted_at,
        completion_pct: dossier.completion_pct,
        // Anonymize title & structure if not allowed full
        title: allowFull ? dossier.title : `Dossier #${dossier.public_number ?? '??'} — ${dossier.type === 'financement' ? 'Financement' : 'Investissement'}`,
        structure: dossier.structure,
        answers: redactAnswers(dossier.answers ?? {}, allowFull),
        access_level: allowFull ? 'full' : 'anonymized',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
