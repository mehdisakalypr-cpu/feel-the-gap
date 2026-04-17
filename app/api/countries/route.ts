import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CountryMapData } from '@/types/database'

export const revalidate = 300 // 5min cache (opportunity counts should refresh fast after backfills)

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

  // Join opportunity aggregates via SQL view (évite la limite 1000 rows du client)
  const { data: oppAggs, error: oppErr } = await supabase
    .from('country_opportunity_stats')
    .select('country_iso, opportunity_count, top_opportunity_score')
    .limit(300)  // ~195 countries max

  if (oppErr) {
    // Don't silently serve 0-count data — surface it.
    console.error('[api/countries] country_opportunity_stats query failed:', oppErr.message)
  }

  const oppByCountry: Record<string, { count: number; top: number }> = {}
  for (const row of (oppAggs ?? [])) {
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
