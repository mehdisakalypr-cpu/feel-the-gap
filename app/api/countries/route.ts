import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CountryMapData } from '@/types/database'

export const revalidate = 3600 // 1h cache

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

  // Join opportunity aggregates
  const { data: oppAggs } = await supabase
    .from('opportunities')
    .select('country_iso, opportunity_score')
    .order('opportunity_score', { ascending: false })

  const oppByCountry: Record<string, { count: number; top: number }> = {}
  for (const opp of (oppAggs ?? [])) {
    const iso = opp.country_iso
    if (!oppByCountry[iso]) oppByCountry[iso] = { count: 0, top: 0 }
    oppByCountry[iso].count++
    if (opp.opportunity_score > oppByCountry[iso].top) {
      oppByCountry[iso].top = opp.opportunity_score
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
