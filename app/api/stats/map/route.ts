import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { SEED_TRADE_DATA } from '@/data/seed-trade-data'

export const revalidate = 3600 // 1h cache

/**
 * GET /api/stats/map
 * Returns aggregate counts displayed on the world map stats bar.
 */
export async function GET() {
  // Countries (rough count from DB, falls back to seed on error)
  const { count: countriesCount } = await supabase
    .from('countries')
    .select('*', { count: 'exact', head: true })

  // Opportunities total
  const { count: oppsCount } = await supabase
    .from('opportunities')
    .select('*', { count: 'exact', head: true })

  // Markets analyzed — prefer live trade_flows count, fall back to seed data
  // product-country pairs.
  const { count: flowsCount } = await supabase
    .from('trade_flows')
    .select('*', { count: 'exact', head: true })
    .eq('flow', 'import')

  let markets = flowsCount ?? 0
  if (markets === 0) {
    // Seed fallback: sum of top_imports across all seed countries
    markets = SEED_TRADE_DATA.reduce((s, c) => s + (c.top_imports?.length ?? 0), 0)
  }

  return NextResponse.json({
    countries: countriesCount ?? SEED_TRADE_DATA.length,
    opportunities: oppsCount ?? 0,
    markets,
  })
}
