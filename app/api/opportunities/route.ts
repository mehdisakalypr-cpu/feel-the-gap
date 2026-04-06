import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const revalidate = 1800

export async function GET(req: NextRequest) {
  const iso = req.nextUrl.searchParams.get('country')
  const category = req.nextUrl.searchParams.get('category')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10'), 50)

  let q = supabase
    .from('opportunities')
    .select(`
      id, country_iso, product_id, type,
      gap_value_usd, opportunity_score, summary,
      products(name_fr, category, subcategory)
    `)
    .order('opportunity_score', { ascending: false })
    .limit(limit)

  if (iso) q = q.eq('country_iso', iso)
  if (category) q = q.eq('products.category', category)

  const { data, error } = await q

  if (error) {
    console.error('[/api/opportunities]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
