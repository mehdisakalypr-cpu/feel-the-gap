// © 2025-2026 Feel The Gap — products: GET (list owner) + POST (create)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()

  const sp = req.nextUrl.searchParams
  let q = sb
    .from('store_products')
    .select('*')
    .eq('store_id', auth.storeId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(500, Number(sp.get('limit') ?? '200')))

  if (sp.get('category')) q = q.eq('category_id', sp.get('category')!)
  if (sp.get('segment') && ['b2b', 'b2c', 'both'].includes(sp.get('segment')!)) q = q.eq('segment', sp.get('segment')!)
  if (sp.get('visibility') && ['draft', 'active', 'archived'].includes(sp.get('visibility')!)) q = q.eq('visibility', sp.get('visibility')!)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ products: data })
}

interface CreateBody {
  name: string
  description?: string | null
  sku?: string | null
  ean?: string | null
  segment?: 'b2c' | 'b2b' | 'both'
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
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()

  let body: CreateBody
  try { body = (await req.json()) as CreateBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 })

  const segment = body.segment ?? 'b2c'
  if (segment !== 'b2b' && (body.price_b2c_ttc_cents == null || body.price_b2c_ttc_cents <= 0)) {
    return NextResponse.json({ error: 'price_b2c_required' }, { status: 400 })
  }
  if (segment !== 'b2c' && (body.price_b2b_ht_cents == null || body.price_b2b_ht_cents <= 0)) {
    return NextResponse.json({ error: 'price_b2b_required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('store_products')
    .insert({
      store_id: auth.storeId,
      name: body.name.trim(),
      description: body.description ?? null,
      sku: body.sku ?? null,
      ean: body.ean ?? null,
      category_id: body.category_id ?? null,
      segment,
      packaging_type: body.packaging_type ?? 'unit',
      packaging_unit: body.packaging_unit ?? 'piece',
      packaging_qty: body.packaging_qty ?? 1,
      price_b2c_ttc_cents: body.price_b2c_ttc_cents ?? null,
      price_b2b_ht_cents: body.price_b2b_ht_cents ?? null,
      vat_rate_pct: body.vat_rate_pct ?? 20,
      stock_qty: body.stock_unlimited ? 0 : (body.stock_qty ?? 0),
      stock_low_alert: body.stock_low_alert ?? null,
      stock_unlimited: !!body.stock_unlimited,
      norms: Array.isArray(body.norms) ? body.norms : [],
      labels: Array.isArray(body.labels) ? body.labels : [],
      legal_docs: Array.isArray(body.legal_docs) ? body.legal_docs : [],
      visibility: body.visibility ?? 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })

  // Initial stock movement
  if (!body.stock_unlimited && (body.stock_qty ?? 0) > 0) {
    await sb.from('store_stock_movements').insert({
      product_id: data.id,
      movement_type: 'initial',
      qty_delta: body.stock_qty,
      qty_before: 0,
      qty_after: body.stock_qty,
      created_by: auth.user.id,
      notes: 'Stock initial',
    })
  }

  return NextResponse.json({ id: data.id, product: data }, { status: 201 })
}
