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

  // Join opportunity aggregates via SQL view. Direct PostgREST fetch is rock-
  // solid (supabase-js silently returned [] before). Retry on empty or fail —
  // the call was found to be INTERMITTENT (1 in ~3 cold starts returns empty
  // on the edge runtime), leaving users with opportunity_count=0 markers.
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  type OppAggRow = { country_iso: string; opportunity_count: number; top_opportunity_score: number | string | null }
  let oppAggs: OppAggRow[] = []

  async function fetchAggs(key: string): Promise<OppAggRow[]> {
    const res = await fetch(
      `${sbUrl}/rest/v1/country_opportunity_stats?select=country_iso,opportunity_count,top_opportunity_score&limit=300`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) throw new Error(`PostgREST ${res.status}`)
    return (await res.json()) as OppAggRow[]
  }

  // Attempt 1: anon key
  try { oppAggs = await fetchAggs(sbAnon) } catch (e) {
    console.warn('[api/countries] anon fetch failed:', (e as Error).message)
  }
  // Attempt 2 (retry if empty/fail) with same key after a brief pause
  if (oppAggs.length === 0) {
    await new Promise(r => setTimeout(r, 100))
    try { oppAggs = await fetchAggs(sbAnon) } catch (e) {
      console.warn('[api/countries] anon retry failed:', (e as Error).message)
    }
  }
  // Attempt 3 (fallback to service_role — bypasses any RLS/rate nuance)
  if (oppAggs.length === 0 && serviceKey) {
    try { oppAggs = await fetchAggs(serviceKey) } catch (e) {
      console.error('[api/countries] service_role fallback failed:', (e as Error).message)
    }
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
