import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildDossierStructure, type DossierType } from '@/agents/dossier-builder'

export const runtime = 'nodejs'
export const maxDuration = 120 // LLM call can take time

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

// POST /api/funding/dossier
// body: { type, amount_eur, country_iso?, product_slug?, sector?, stage?, user_budget_id?, business_plan_id? }
// → creates a dossier, generates structure via LLM, returns { id }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      type,
      amount_eur,
      country_iso,
      product_slug,
      sector,
      stage,
      user_budget_id,
      business_plan_id,
    } = body as {
      type: DossierType
      amount_eur: number
      country_iso?: string
      product_slug?: string
      sector?: string
      stage?: string
      user_budget_id?: string
      business_plan_id?: string
    }

    if (type !== 'financement' && type !== 'investissement') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    if (!amount_eur || amount_eur <= 0) {
      return NextResponse.json({ error: 'Invalid amount_eur' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Generate dossier structure via LLM (Gemini → Groq → OpenAI fallback)
    const structure = await buildDossierStructure({
      type,
      amount_eur,
      country_iso,
      product_slug,
      sector,
      stage,
    })

    const title = type === 'financement'
      ? `Financement ${amount_eur.toLocaleString('fr-FR')} € — ${country_iso ?? 'projet'}${product_slug ? '/' + product_slug : ''}`
      : `Investissement ${amount_eur.toLocaleString('fr-FR')} € — ${country_iso ?? 'projet'}${product_slug ? '/' + product_slug : ''}`

    const { data, error } = await supabase
      .from('funding_dossiers')
      .insert({
        user_id: user.id,
        user_budget_id: user_budget_id ?? null,
        business_plan_id: business_plan_id ?? null,
        type,
        title,
        country_iso: country_iso ?? null,
        product_slug: product_slug ?? null,
        amount_eur,
        status: 'draft',
        structure,
        answers: {},
        completion_pct: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[api/funding/dossier] insert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, structure }, { status: 201 })
  } catch (err) {
    console.error('[api/funding/dossier] POST error', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/funding/dossier  → list current user's dossiers
export async function GET() {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('funding_dossiers')
      .select('id, type, title, amount_eur, status, completion_pct, country_iso, product_slug, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ dossiers: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
