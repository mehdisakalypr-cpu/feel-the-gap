import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, logApiCall } from '@/lib/api-platform/auth'
import { v1Json, v1Error } from '@/lib/api-platform/response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/products — catalogue 323 produits avec codes HS.
 * Requiert scope products:read (ou *).
 * Query: ?category=agri&hs2=09&limit=100
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authenticateApiRequest(req, 'products:read')
  if (!auth.ok) return v1Error(auth.error, auth.status, auth.retryAfter)

  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const hs2 = url.searchParams.get('hs2')
  const hs4 = url.searchParams.get('hs4')
  const search = url.searchParams.get('search')
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? 100)), 500)
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let q = sb.from('products')
    .select('id, hs2, hs4, name, name_fr, category, subcategory, unit', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (category) q = q.eq('category', category)
  if (hs2) q = q.eq('hs2', hs2)
  if (hs4) q = q.eq('hs4', hs4)
  if (search) q = q.or(`name.ilike.%${search}%,name_fr.ilike.%${search}%`)

  const { data, count, error } = await q
  const status = error ? 500 : 200

  const res = error
    ? v1Error(error.message, 500)
    : v1Json({ ok: true, count, limit, offset, items: data ?? [] }, auth.auth)

  logApiCall({
    tokenId: auth.auth.token.id,
    path: '/api/v1/products',
    method: 'GET',
    status,
    latencyMs: Date.now() - t0,
    ip: auth.auth.ip,
  })
  return res
}
