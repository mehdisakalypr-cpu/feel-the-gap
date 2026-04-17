import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CountryMapData } from '@/types/database'

export const dynamic = 'force-dynamic' // always run server-side at request time — avoids build-time static gen which was returning empty aggregates
export const revalidate = 0

export async function GET() {
  const { data, error } = await supabase
    .from('countries')
    .select(`
      id, name_fr, flag, region, lat, lng,
      trade_balance_usd, total_imports_usd, total_exports_usd,
      top_import_category, data_year
    `)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Join opportunity aggregates via SQL view. supabase-js was silently returning
  // [] here (unclear why — possibly a view schema cache staleness after recent
  // migrations). Direct PostgREST fetch is rock-solid, so we use it here.
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  type OppAggRow = { country_iso: string; opportunity_count: number; top_opportunity_score: number | string | null }
  let oppAggs: OppAggRow[] = []
  try {
    const res = await fetch(`${sbUrl}/rest/v1/country_opportunity_stats?select=country_iso,opportunity_count,top_opportunity_score&limit=300`, {
      headers: { apikey: sbAnon, Authorization: `Bearer ${sbAnon}` },
      cache: 'no-store',
    })
    if (res.ok) oppAggs = await res.json() as OppAggRow[]
    else console.error('[api/countries] PostgREST view fetch failed:', res.status, await res.text().catch(() => ''))
  } catch (e) {
    console.error('[api/countries] view fetch threw:', (e as Error).message)
  }

  const oppByCountry: Record<string, { count: number; top: number }> = {}
  for (const row of oppAggs) {
    oppByCountry[row.country_iso] = {
      count: row.opportunity_count,
      top: Number(row.top_opportunity_score) || 0,
    }
  }

  const result: CountryMapData[] = (data ?? []).map(c => ({
    iso:                  c.id,
    name_fr:              c.name_fr,
    flag:                 c.flag,
    region:               c.region,
    lat:                  c.lat,
    lng:                  c.lng,
    trade_balance_usd:    c.trade_balance_usd,
    total_imports_usd:    c.total_imports_usd,
    total_exports_usd:    c.total_exports_usd,
    top_import_category:  c.top_import_category,
    data_year:            c.data_year,
    opportunity_count:    oppByCountry[c.id]?.count ?? 0,
    top_opportunity_score: oppByCountry[c.id]?.top ?? null,
  }))

  return NextResponse.json(result)
}
