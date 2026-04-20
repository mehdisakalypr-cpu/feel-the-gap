// © 2025-2026 Feel The Gap — re-issue invoice (version + 1, snapshot billing entity)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id: orderId } = await params

  const sb = await createSupabaseServer()
  const { data: order } = await sb
    .from('store_orders')
    .select('id, store_id, total_cents, currency, subtotal_cents, vat_cents, shipping_cents, discount_cents, buyer_email, buyer_name, buyer_address, status, created_at, paid_at')
    .eq('id', orderId)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: store } = await sb
    .from('stores')
    .select('billing_entity, name, slug')
    .eq('id', auth.storeId)
    .maybeSingle()

  const { data: items } = await sb
    .from('store_order_items')
    .select('product_snapshot, qty, unit_price_cents, line_total_cents, vat_rate_pct')
    .eq('order_id', orderId)

  const { data: latest } = await sb
    .from('store_invoices')
    .select('invoice_number, version')
    .eq('order_id', orderId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const invoiceNumber = latest?.invoice_number ?? `INV-${new Date().getFullYear()}-${String(orderId).slice(0, 8).toUpperCase()}`
  const nextVersion = (latest?.version ?? 0) + 1

  const issuerSnapshot = {
    legal_name: typeof store?.billing_entity === 'object' && store?.billing_entity ? (store.billing_entity as Record<string, unknown>).legal_name ?? store?.name : store?.name,
    raw: store?.billing_entity ?? {},
    store_slug: store?.slug ?? null,
  }
  const data = {
    order: {
      id: order.id,
      total_cents: order.total_cents,
      currency: order.currency,
      subtotal_cents: order.subtotal_cents,
      vat_cents: order.vat_cents,
      shipping_cents: order.shipping_cents,
      discount_cents: order.discount_cents,
      created_at: order.created_at,
      paid_at: order.paid_at,
      status: order.status,
    },
    buyer: {
      email: order.buyer_email,
      name: order.buyer_name,
      address: order.buyer_address ?? null,
    },
    items: items ?? [],
  }

  // Mark prior versions as superseded
  if (latest?.version) {
    await sb.from('store_invoices').update({ superseded_by: null }).eq('order_id', orderId).eq('version', latest.version)
  }

  const { data: inserted, error } = await sb
    .from('store_invoices')
    .insert({
      order_id: orderId,
      store_id: auth.storeId,
      invoice_number: invoiceNumber,
      version: nextVersion,
      issuer_snapshot: issuerSnapshot,
      data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 500 })

  // Best effort link previous version → new id
  if (latest?.version) {
    await sb.from('store_invoices').update({ superseded_by: inserted.id }).eq('order_id', orderId).eq('version', latest.version)
  }

  return NextResponse.json({ invoice: inserted })
}
