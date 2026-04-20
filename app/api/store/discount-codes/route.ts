// © 2025-2026 Feel The Gap — discount codes CRUD

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  const { data, error } = await sb
    .from('store_discount_codes')
    .select('*')
    .eq('store_id', auth.storeId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ codes: data })
}

interface PostBody {
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_uses?: number | null
  starts_at?: string | null
  ends_at?: string | null
  applies_to?: 'cart' | 'products'
  product_ids?: string[]
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  let body: PostBody
  try { body = (await req.json()) as PostBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.code?.trim()) return NextResponse.json({ error: 'code_required' }, { status: 400 })
  if (!['fixed', 'percent'].includes(body.discount_type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  if (!isFinite(body.discount_value) || body.discount_value <= 0) {
    return NextResponse.json({ error: 'invalid_value' }, { status: 400 })
  }
  if (body.discount_type === 'percent' && body.discount_value > 100) {
    return NextResponse.json({ error: 'percent_over_100' }, { status: 400 })
  }
  const { data, error } = await sb
    .from('store_discount_codes')
    .insert({
      store_id: auth.storeId,
      code: body.code.trim().toUpperCase(),
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      max_uses: body.max_uses ?? null,
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: body.ends_at ?? null,
      applies_to: body.applies_to ?? 'cart',
      product_ids: body.product_ids ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ code: data }, { status: 201 })
}

interface PatchBody {
  id: string
  active?: boolean
  ends_at?: string | null
  max_uses?: number | null
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  let body: PatchBody
  try { body = (await req.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') update.active = body.active
  if (body.ends_at !== undefined) update.ends_at = body.ends_at
  if (body.max_uses !== undefined) update.max_uses = body.max_uses
  const { data, error } = await sb
    .from('store_discount_codes')
    .update(update)
    .eq('id', body.id)
    .eq('store_id', auth.storeId)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ code: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const { error } = await sb.from('store_discount_codes').delete().eq('id', id).eq('store_id', auth.storeId)
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
