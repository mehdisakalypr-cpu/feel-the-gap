import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron — rafraîchit les materialized views qui sous-tendent la carte mondiale et les stats.
 *
 * Pour l'instant : `country_opportunity_stats_mv` (agrégats par pays servis à /api/countries).
 * La fonction SQL `refresh_country_opportunity_stats_mv()` fait un REFRESH CONCURRENTLY
 * (pas de blocage lecture) — nécessite l'index unique défini dans la migration
 * 20260418114000_country_opportunity_stats_matview.sql.
 *
 * Fréquence : 2×/jour (02h UTC et 14h UTC) — suffit pour ~3k nouvelles opps/jour
 * (delta invisible à l'échelle du total 938k).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'missing SUPABASE env' }, { status: 500 })
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const t0 = Date.now()
  const { error } = await sb.rpc('refresh_country_opportunity_stats_mv')
  const duration_ms = Date.now() - t0

  if (error) {
    console.error('[cron/refresh-matviews]', error.message)
    return NextResponse.json({ ok: false, error: error.message, duration_ms }, { status: 500 })
  }
  return NextResponse.json({ ok: true, refreshed: ['country_opportunity_stats_mv'], duration_ms })
}
