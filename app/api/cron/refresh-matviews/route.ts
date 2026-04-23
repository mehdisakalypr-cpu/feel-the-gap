import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron — rafraîchit les materialized views qui sous-tendent la carte mondiale,
 * les stats, et les queues d'agents (eishi-base + rock-lee-v2).
 *
 * Vues rafraîchies (REFRESH CONCURRENTLY, pas de blocage lecture) :
 *   - country_opportunity_stats_mv    → agrégats par pays (migration 20260418114000)
 *   - ftg_product_country_pair_agg    → paires (product×country) pour queues agents (migration 20260423070000)
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
  const results: Record<string, { ok: boolean; error?: string; ms: number }> = {}
  const refreshes: Array<[string, string]> = [
    ['country_opportunity_stats_mv', 'refresh_country_opportunity_stats_mv'],
    ['ftg_product_country_pair_agg', 'ftg_refresh_pair_agg'],
  ]

  for (const [name, fn] of refreshes) {
    const start = Date.now()
    const { error } = await sb.rpc(fn)
    results[name] = error
      ? { ok: false, error: error.message, ms: Date.now() - start }
      : { ok: true, ms: Date.now() - start }
  }

  const duration_ms = Date.now() - t0
  const allOk = Object.values(results).every((r) => r.ok)
  if (!allOk) console.error('[cron/refresh-matviews]', JSON.stringify(results))

  return NextResponse.json({ ok: allOk, results, duration_ms }, { status: allOk ? 200 : 500 })
}
