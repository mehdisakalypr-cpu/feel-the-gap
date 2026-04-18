import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, logApiCall } from '@/lib/api-platform/auth'
import { v1Json, v1Error, v1Options } from '@/lib/api-platform/response'
import { toCsv, csvResponse } from '@/lib/api-platform/csv'

export { v1Options as OPTIONS }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/countries — liste des 211 pays avec data trade macro.
 * Requiert scope countries:read (ou *).
 * Query: ?region=Africa&limit=50&offset=0&iso=FRA (filtre unique)
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authenticateApiRequest(req, 'countries:read')
  if (!auth.ok) return v1Error(auth.error, auth.status, auth.retryAfter)

  const url = new URL(req.url)
  const iso = url.searchParams.get('iso')?.toUpperCase()
  const region = url.searchParams.get('region')
  const format = url.searchParams.get('format')?.toLowerCase() ?? 'json'
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? 50)), format === 'csv' ? 5000 : 500)
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let q = sb.from('countries')
    .select('id, iso2, name, name_fr, flag, region, sub_region, lat, lng, population, gdp_usd, gdp_per_capita, total_imports_usd, total_exports_usd, trade_balance_usd, top_import_category, data_year', { count: 'exact' })
    .order('gdp_usd', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (iso) q = q.eq('id', iso)
  if (region) q = q.eq('region', region)

  const { data, count, error } = await q
  const status = error ? 500 : 200

  let res: Response
  if (error) {
    res = v1Error(error.message, 500)
  } else if (format === 'csv') {
    const csv = toCsv((data ?? []) as Array<Record<string, unknown>>)
    res = csvResponse(csv, `countries-${Date.now()}.csv`, {
      'X-RateLimit-Tier': auth.auth.token.tier,
      'X-Total-Count': String(count ?? 0),
    })
  } else {
    res = v1Json({ ok: true, count, limit, offset, items: data ?? [] }, auth.auth)
  }

  logApiCall({
    tokenId: auth.auth.token.id,
    path: '/api/v1/countries',
    method: 'GET',
    status,
    latencyMs: Date.now() - t0,
    ip: auth.auth.ip,
  })
  return res
}
