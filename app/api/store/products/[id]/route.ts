// © 2025-2026 Feel The Gap — single product GET/PATCH/DELETE + variants/options sync

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data, error } = await sb
    .from('store_products')
    .select('*')
    .eq('id', id)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ product: data })
}

interface OptionPayload {
  id?: string
  name: string
  position: number
  values: string[]
}

interface VariantPayload {
  id?: string
  sku?: string | null
  ean?: string | null
  option_values: Record<string, string>
  price_b2c_ttc_cents?: number | null
  price_b2b_ht_cents?: number | null
  stock_qty?: number
  weight_g?: number | null
  position?: number
  active?: boolean
}

interface PatchBody {
  name?: string
  description?: string | null
  sku?: string | null
  ean?: string | null
  segment?: 'b2b' | 'b2c' | 'both'
  packaging_type?: 'unit' | 'weight' | 'volume'
  packaging_unit?: string
  packaging_qty?: number
  price_b2c_ttc_cents?: number | null
  price_b2b_ht_cents?: number | null
  vat_rate_pct?: number
  stock_qty?: number
  stock_low_alert?: number | null
  stock_unlimited?: boolean
  norms?: string[]
  labels?: string[]
  legal_docs?: unknown
  visibility?: 'draft' | 'active' | 'archived'
  category_id?: string | null
  options?: OptionPayload[]
  variants?: VariantPayload[]
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id } = await params
  const sb = await createSupabaseServer()

  let body: PatchBody
  try { body = (await req.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Verify ownership first
  const { data: existing } = await sb
    .from('store_products')
    .select('id, store_id, stock_qty')
    .eq('id', id)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Build update payload — only fields explicitly provided
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const fields: Array<keyof PatchBody> = [
    'name', 'description', 'sku', 'ean', 'segment',
    'packaging_type', 'packaging_unit', 'packaging_qty',
    'price_b2c_ttc_cents', 'price_b2b_ht_cents', 'vat_rate_pct',
    'stock_qty', 'stock_low_alert', 'stock_unlimited',
    'norms', 'labels', 'legal_docs', 'visibility', 'category_id',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  if (Object.keys(update).length > 1) {
    const { error: upErr } = await sb
      .from('store_products')
      .update(update)
      .eq('id', id)
      .eq('store_id', auth.storeId)
    if (upErr) return NextResponse.json({ error: 'update_failed', message: upErr.message }, { status: 400 })
  }

  // Sync options
  if (Array.isArray(body.options)) {
    const incomingIds = body.options.filter(o => o.id).map(o => o.id as string)
    // delete options not in payload
    await sb.from('store_product_options').delete().eq('product_id', id).not('id', 'in', `(${incomingIds.length ? incomingIds.map(x => `"${x}"`).join(',') : 'NULL'})`)
    for (const o of body.options) {
      if (!o.name?.trim()) continue
      if (o.id) {
        await sb.from('store_product_options').update({ name: o.name.trim(), position: o.position ?? 0, values: o.values ?? [] }).eq('id', o.id).eq('product_id', id)
      } else {
        await sb.from('store_product_options').insert({ product_id: id, name: o.name.trim(), position: o.position ?? 0, values: o.values ?? [] })
      }
    }
  }

  // Sync variants
  if (Array.isArray(body.variants)) {
    const incomingIds = body.variants.filter(v => v.id).map(v => v.id as string)
    await sb.from('store_product_variants').delete().eq('product_id', id).not('id', 'in', `(${incomingIds.length ? incomingIds.map(x => `"${x}"`).join(',') : 'NULL'})`)
    for (const v of body.variants) {
      const payload = {
        product_id: id,
        sku: v.sku ?? null,
        ean: v.ean ?? null,
        option_values: v.option_values ?? {},
        price_b2c_ttc_cents: v.price_b2c_ttc_cents ?? null,
        price_b2b_ht_cents: v.price_b2b_ht_cents ?? null,
        stock_qty: v.stock_qty ?? 0,
        weight_g: v.weight_g ?? null,
        position: v.position ?? 0,
        active: v.active ?? true,
      }
      if (v.id) {
        await sb.from('store_product_variants').update(payload).eq('id', v.id).eq('product_id', id)
      } else {
        await sb.from('store_product_variants').insert(payload)
      }
    }
  }

  // Stock movement if stock_qty was explicitly changed (excluding stock_unlimited toggle)
  if (typeof body.stock_qty === 'number' && body.stock_qty !== Number(existing.stock_qty)) {
    const delta = body.stock_qty - Number(existing.stock_qty)
    await sb.from('store_stock_movements').insert({
      product_id: id,
      movement_type: 'adjustment',
      qty_delta: delta,
      qty_before: Number(existing.stock_qty),
      qty_after: body.stock_qty,
      created_by: auth.user.id,
      notes: 'Ajustement manuel via fiche produit',
    })
  }

  const { data: out } = await sb.from('store_products').select('*').eq('id', id).maybeSingle()
  return NextResponse.json({ product: out })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id } = await params
  const sb = await createSupabaseServer()
  const { error } = await sb.from('store_products').delete().eq('id', id).eq('store_id', auth.storeId)
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
