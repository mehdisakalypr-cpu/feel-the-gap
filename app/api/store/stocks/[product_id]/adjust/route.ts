// © 2025-2026 Feel The Gap — stock adjustment

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ product_id: string }> }

interface Body {
  qty_delta: number
  type?: 'restock' | 'adjustment' | 'return'
  notes?: string | null
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { product_id } = await params

  let body: Body
  try { body = (await req.json()) as Body } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const delta = Number(body.qty_delta)
  if (!isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'invalid_delta' }, { status: 400 })
  }
  const movementType = body.type ?? 'adjustment'
  if (!['restock', 'adjustment', 'return'].includes(movementType)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  const sb = await createSupabaseServer()
  const { data: product } = await sb
    .from('store_products')
    .select('id, stock_qty, stock_unlimited')
    .eq('id', product_id)
    .eq('store_id', auth.storeId)
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (product.stock_unlimited) {
    return NextResponse.json({ error: 'unlimited_stock' }, { status: 400 })
  }

  const before = Number(product.stock_qty)
  const after = before + delta
  if (after < 0) {
    return NextResponse.json({ error: 'negative_stock', message: `Stock final n\u00e9gatif (${after}). Annul\u00e9.` }, { status: 400 })
  }

  const { error: updErr } = await sb
    .from('store_products')
    .update({ stock_qty: after, updated_at: new Date().toISOString() })
    .eq('id', product_id)
    .eq('store_id', auth.storeId)
  if (updErr) return NextResponse.json({ error: 'update_failed', message: updErr.message }, { status: 500 })

  const { data: movement, error: movErr } = await sb
    .from('store_stock_movements')
    .insert({
      product_id,
      movement_type: movementType,
      qty_delta: delta,
      qty_before: before,
      qty_after: after,
      notes: body.notes ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single()
  if (movErr) return NextResponse.json({ error: 'log_failed', message: movErr.message }, { status: 500 })

  return NextResponse.json({ movement, stock_qty: after })
}
