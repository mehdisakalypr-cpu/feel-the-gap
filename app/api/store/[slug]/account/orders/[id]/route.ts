// © 2025-2026 Feel The Gap — buyer single order detail API
import { NextResponse } from 'next/server'
import { authBuyerForStore } from '../../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string; id: string }> }

export async function GET(_req: Request, ctx: Params) {
  const { slug, id } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { sb, store, user } = auth

  const { data: order } = await sb
    .from('store_orders')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .eq('buyer_user_id', user.id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [itemsRes, invoicesRes, refundsRes] = await Promise.all([
    sb.from('store_order_items').select('*').eq('order_id', id),
    sb.from('store_invoices').select('id, invoice_number, version, issued_at, pdf_url').eq('order_id', id).order('version', { ascending: false }),
    sb.from('store_refunds').select('id, amount_cents, reason, type, status, created_at').eq('order_id', id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    order,
    items: itemsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
    refunds: refundsRes.data ?? [],
  })
}
