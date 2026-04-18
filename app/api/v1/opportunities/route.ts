import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, logApiCall } from '@/lib/api-platform/auth'
import { v1Json, v1Error, v1Options } from '@/lib/api-platform/response'
import { toCsv, csvResponse } from '@/lib/api-platform/csv'

export { v1Options as OPTIONS }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/opportunities — liste paginée.
 * Query : ?country=FRA&product=cacao&type=trade&limit=50&offset=0&format=json|csv
 * Scope : opportunities:read
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authenticateApiRequest(req, 'opportunities:read')
  if (!auth.ok) return v1Error(auth.error, auth.status, auth.retryAfter)

  const url = new URL(req.url)
  const country = url.searchParams.get('country')?.toUpperCase()
  const product = url.searchParams.get('product')
  const type = url.searchParams.get('type')
  const minScore = url.searchParams.get('min_score')
  const format = url.searchParams.get('format')?.toLowerCase() ?? 'json'
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? 50)), format === 'csv' ? 5000 : 500)
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let q = sb.from('opportunities')
    .select('id, country_iso, product_id, type, gap_tonnes_year, gap_value_usd, opportunity_score, avg_import_price_usd_tonne, local_production_cost_usd_tonne, potential_margin_pct, land_availability, labor_cost_index, infrastructure_score, summary, created_at', { count: 'exact' })
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (country) q = q.eq('country_iso', country)
  if (product) q = q.eq('product_id', product)
  if (type) q = q.eq('type', type)
  if (minScore) q = q.gte('opportunity_score', Number(minScore))

  const { data, count, error } = await q
  const status = error ? 500 : 200
  let res: Response

  if (error) {
    res = v1Error(error.message, 500)
  } else if (format === 'csv') {
    const csv = toCsv((data ?? []) as Array<Record<string, unknown>>)
    res = csvResponse(csv, `opportunities-${Date.now()}.csv`, {
      'X-RateLimit-Tier': auth.auth.token.tier,
      'X-Total-Count': String(count ?? 0),
    })
  } else {
    res = v1Json({ ok: true, count, limit, offset, items: data ?? [] }, auth.auth)
  }

  logApiCall({
    tokenId: auth.auth.token.id,
    path: '/api/v1/opportunities',
    method: 'GET',
    status,
    latencyMs: Date.now() - t0,
    ip: auth.auth.ip,
  })
  return res
}
