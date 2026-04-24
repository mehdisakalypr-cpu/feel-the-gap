import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [selectionsRes, productsRes, dossiersRes] = await Promise.all([
    sb
      .from('user_opp_selections')
      .select('id, opportunity_id, country_iso, product_slug, created_at, opportunities(id, opportunity_score, products(id, name, name_fr), countries(id, name, name_fr, flag))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    sb
      .from('user_product_sheets')
      .select('id, slug, name, country_iso, completion_pct, status, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    sb
      .from('funding_dossiers')
      .select('id, type, title, country_iso, product_slug, amount_eur, completion_pct, status, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const selections = selectionsRes.data ?? []
  const products = productsRes.data ?? []
  const dossiersAll = dossiersRes.data ?? []
  const funding = dossiersAll.filter(d => d.type === 'financement')
  const investment = dossiersAll.filter(d => d.type === 'investissement')

  return NextResponse.json({
    selections,
    products,
    funding,
    investment,
    counts: {
      selections: selections.length,
      products: products.length,
      funding: funding.length,
      investment: investment.length,
    },
  })
}
