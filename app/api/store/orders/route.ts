// © 2025-2026 Feel The Gap — orders list (owner)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  let q = sb
    .from('store_orders')
    .select('id, buyer_email, buyer_name, total_cents, currency, status, created_at, paid_at', { count: 'exact' })
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const status = sp.get('status')
  if (status && ['pending', 'paid', 'fulfilled', 'refunded', 'cancelled'].includes(status)) q = q.eq('status', status)
  const qStr = sp.get('q')
  if (qStr) q = q.ilike('buyer_email', `%${qStr}%`)
  const from = sp.get('from')
  if (from) q = q.gte('created_at', from)
  const to = sp.get('to')
  if (to) q = q.lte('created_at', to)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ orders: data, total: count ?? data?.length ?? 0, page, page_size: PAGE_SIZE })
}
