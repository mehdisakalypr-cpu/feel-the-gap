import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/marketplace/market-pulse
 *
 * Market Pulse — indicative trade volumes from real opportunities matview.
 * NO fake seed: all rows come from Comtrade/FAO-sourced aggregates in
 * ftg_product_country_pair_agg (refreshed daily).
 *
 * Query params:
 *   ?limit=20            (1-50, default 20)
 *   ?country=FRA         (ISO3, optional)
 *   ?category=agriculture (optional)
 *
 * Cached 1h at CDN (Cache-Control) to keep landing fast.
 */

export const runtime = 'edge'
export const revalidate = 3600

type PulseRow = {
  product_id: string
  product_label: string
  country_iso: string
  country_name: string
  flag: string
  category: string
  indicative_gap_usd: number
  opportunity_count: number
  max_opportunity_score: number
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const country = url.searchParams.get('country') || null
  const category = url.searchParams.get('category') || null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ ok: false, error: 'supabase_env_missing' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

  const { data, error } = await db.rpc('ftg_market_pulse_top', {
    limit_count: limit,
    country_filter: country,
    category_filter: category,
  })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      items: (data ?? []) as PulseRow[],
      source: 'Comtrade + FAO via opportunities matview',
      refreshed_daily: true,
      updated: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    },
  )
}
