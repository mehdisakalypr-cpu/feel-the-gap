// © 2025-2026 Feel The Gap — buyer RGPD article 20 export (JSON download)
import { NextResponse } from 'next/server'
import { authBuyerForStore, supabaseAdmin } from '../_lib/store-api'

export const runtime = 'nodejs'

interface Params { params: Promise<{ slug: string }> }

export async function GET(_req: Request, ctx: Params) {
  const { slug } = await ctx.params
  const auth = await authBuyerForStore(slug)
  if (!auth.ok) return auth.response
  const { store, user } = auth

  // Use admin client to bypass RLS for invoice/items joins (we already verified ownership).
  const admin = supabaseAdmin()

  const [profile, addresses, orders, items, invoices, refunds] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).maybeSingle().then(r => r.data),
    admin.from('store_buyer_addresses').select('*').eq('user_id', user.id),
    admin.from('store_orders').select('*').eq('store_id', store.id).eq('buyer_user_id', user.id),
    admin.from('store_order_items')
      .select('*, store_orders!inner(buyer_user_id, store_id)')
      .eq('store_orders.buyer_user_id', user.id)
      .eq('store_orders.store_id', store.id),
    admin.from('store_invoices')
      .select('id, invoice_number, version, issued_at, order_id')
      .eq('store_id', store.id),
    admin.from('store_refunds')
      .select('id, order_id, amount_cents, reason, type, status, created_at, processed_at'),
  ])

  // Filter invoices and refunds to those belonging to this buyer's orders.
  const orderIds = new Set((orders.data ?? []).map(o => o.id as string))
  const filteredInvoices = (invoices.data ?? []).filter(i => orderIds.has(String(i.order_id)))
  const filteredRefunds = (refunds.data ?? []).filter(r => orderIds.has(String(r.order_id)))

  const exportObj = {
    generated_at: new Date().toISOString(),
    store: { id: store.id, slug: store.slug, name: store.name },
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile,
    addresses: addresses.data ?? [],
    orders: orders.data ?? [],
    order_items: items.data ?? [],
    invoices: filteredInvoices,
    refunds: filteredRefunds,
  }

  // Best-effort audit log (table may not exist in tests).
  try {
    await admin.from('account_audit_log').insert({
      user_id: user.id,
      event: 'store_data_export',
      details: { store_id: store.id, slug: store.slug },
    })
  } catch { /* noop */ }

  const json = JSON.stringify(exportObj, null, 2)
  return new Response(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="data-export-${store.slug}-${user.id}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
