// © 2025-2026 Feel The Gap — buyer orders list API
import { NextRequest, NextResponse } from 'next/server'
import { authBuyerForStore } from '../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string }> }

const PAGE_SIZE = 20

export async function GET(req: NextRequest, ctx: Params) {
  const { slug } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, store, user } = auth

  const url = new URL(req.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const status = (url.searchParams.get('status') ?? '').trim()

  let q = sb.from('store_orders')
    .select('id, created_at, status, total_cents, currency, paid_at, fulfilled_at', { count: 'exact' })
    .eq('store_id', store.id)
    .eq('buyer_user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (status) q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    page,
    page_size: PAGE_SIZE,
    total: count ?? 0,
    orders: data ?? [],
  })
}
