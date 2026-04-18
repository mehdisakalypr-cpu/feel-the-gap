import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { CountryMapData } from '@/types/database'

export const dynamic = 'force-dynamic'
// Court cache CDN 60s : les agrégats bougent au rythme du matview refresh (cron nocturne).
// Avant: revalidate=0 + logique retry 3-tour sur vue lente → endpoint prenait 17-20s → /map affichait SEED_COUNTRIES seulement.
// Fix Senku 2026-04-18: matview `country_opportunity_stats_mv` pré-agrégée (<100ms).
export const revalidate = 60

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

  // Lecture directe de la matview — service_role pour bypasser RLS (matview sinon visible vide en anon si FORCE RLS).
  // Query stable <100ms (plan: Index Scan sur matview uniq) vs 7-8s sur la vue agrégée live.
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  type OppAggRow = { country_iso: string; opportunity_count: number; top_opportunity_score: number | string | null }
  let oppAggs: OppAggRow[] = []

  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/country_opportunity_stats_mv?select=country_iso,opportunity_count,top_opportunity_score&limit=300`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    if (res.ok) {
      oppAggs = (await res.json()) as OppAggRow[]
    } else {
      console.warn('[api/countries] matview fetch status:', res.status)
    }
  } catch (e) {
    console.error('[api/countries] matview fetch failed:', (e as Error).message)
  }

  // Fallback si matview pas encore provisionnée (migration pas appliquée) — lit la vue live (lente mais correcte).
  if (oppAggs.length === 0) {
    console.warn('[api/countries] matview empty → fallback vue live (slow)')
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/country_opportunity_stats?select=country_iso,opportunity_count,top_opportunity_score&limit=300`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
      )
      if (res.ok) oppAggs = (await res.json()) as OppAggRow[]
    } catch (e) {
      console.error('[api/countries] view fallback failed:', (e as Error).message)
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

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  })
}
