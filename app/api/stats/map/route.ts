import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SEED_TRADE_DATA } from '@/data/seed-trade-data'

export const revalidate = 60 // short cache — stats reflètent la croissance continue opps/marchés/produits

/**
 * GET /api/stats/map
 * Returns live aggregate counts displayed on the world map stats bar + home hero.
 * Fields: countries · products · opportunities · markets (import flows)
 */
export async function GET() {
  const [countriesRes, productsRes, oppsAggRes, flowsRes] = await Promise.all([
    supabase.from('countries').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    // Use matview pre-aggregated by country (fast + reflects dedup'd unique tuples).
    // Raw count(*) on opportunities = slow during dedup runs and includes dupes.
    supabase.from('country_opportunity_stats_mv').select('opportunity_count'),
    supabase.from('trade_flows').select('*', { count: 'exact', head: true }).eq('flow', 'import'),
  ])

  const oppsTotal = (oppsAggRes.data ?? []).reduce((sum: number, r: { opportunity_count: number }) => sum + (r.opportunity_count ?? 0), 0)

  let markets = flowsRes.count ?? 0
  if (markets === 0) {
    markets = SEED_TRADE_DATA.reduce((s, c) => s + (c.top_imports?.length ?? 0), 0)
  }

  return NextResponse.json(
    {
      countries: countriesRes.count ?? SEED_TRADE_DATA.length,
      products: productsRes.count ?? 0,
      opportunities: oppsTotal,
      markets,
    },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
  )
}
