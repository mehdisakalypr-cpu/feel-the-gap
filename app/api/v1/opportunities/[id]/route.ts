import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, logApiCall } from '@/lib/api-platform/auth'
import { v1Json, v1Error, v1Options } from '@/lib/api-platform/response'

export { v1Options as OPTIONS }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/opportunities/[id] — opportunité détaillée avec pays + produit joints.
 * Scope : opportunities:read
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t0 = Date.now()
  const auth = await authenticateApiRequest(req, 'opportunities:read')
  if (!auth.ok) return v1Error(auth.error, auth.status, auth.retryAfter)

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return v1Error('invalid id', 400)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: opp, error } = await sb
    .from('opportunities')
    .select('id, country_iso, product_id, type, gap_tonnes_year, gap_value_usd, opportunity_score, avg_import_price_usd_tonne, local_production_cost_usd_tonne, potential_margin_pct, land_availability, labor_cost_index, infrastructure_score, summary, analysis_json, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  let status = 200
  let res: Response

  if (error) {
    status = 500
    res = v1Error(error.message, 500)
  } else if (!opp) {
    status = 404
    res = v1Error('not found', 404)
  } else {
    // Join pays + produit (best-effort, pas d'erreur si NULL)
    const [{ data: country }, { data: product }] = await Promise.all([
      sb.from('countries').select('id, iso2, name, name_fr, flag, region').eq('id', opp.country_iso).maybeSingle(),
      sb.from('products').select('id, hs2, hs4, name, name_fr, category, unit').eq('id', opp.product_id).maybeSingle(),
    ])
    res = v1Json({ ok: true, opportunity: opp, country, product }, auth.auth)
  }

  logApiCall({
    tokenId: auth.auth.token.id,
    path: `/api/v1/opportunities/${id}`,
    method: 'GET',
    status,
    latencyMs: Date.now() - t0,
    ip: auth.auth.ip,
  })
  return res
}
