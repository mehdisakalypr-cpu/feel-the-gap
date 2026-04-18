import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiRequest, logApiCall } from '@/lib/api-platform/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/opportunities — endpoint public authentifié (tier starter+).
 * Query: ?country=FRA&sector=coffee&limit=50 (max 500)
 *
 * Scope requis : opportunities:read
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const auth = await authenticateApiRequest(req, 'opportunities:read')
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      {
        status: auth.status,
        headers: auth.retryAfter ? { 'Retry-After': String(auth.retryAfter) } : undefined,
      },
    )
  }

  const url = new URL(req.url)
  const country = url.searchParams.get('country')?.toUpperCase()
  const sector = url.searchParams.get('sector')
  const product = url.searchParams.get('product')
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? 50)), 500)
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  let q = sb.from('opportunities')
    .select('id, country_iso, sector, product_slug, score, margin_eur, created_at', { count: 'exact' })
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (country) q = q.eq('country_iso', country)
  if (sector) q = q.eq('sector', sector)
  if (product) q = q.eq('product_slug', product)

  const { data, count, error } = await q
  const status = error ? 500 : 200
  const res = error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({
        ok: true,
        count,
        limit,
        offset,
        items: data ?? [],
      })

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
