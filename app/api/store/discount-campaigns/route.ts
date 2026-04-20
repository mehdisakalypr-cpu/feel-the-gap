// © 2025-2026 Feel The Gap — discount campaigns CRUD (% on product set, time-bounded)

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
    .from('store_discount_campaigns')
    .select('*')
    .eq('store_id', auth.storeId)
    .order('starts_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ campaigns: data })
}

interface PostBody {
  name: string
  discount_pct: number
  product_ids: string[]
  starts_at: string
  ends_at: string
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  let body: PostBody
  try { body = (await req.json()) as PostBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'name_required' }, { status: 400 })
  if (!isFinite(body.discount_pct) || body.discount_pct <= 0 || body.discount_pct > 100) {
    return NextResponse.json({ error: 'invalid_pct' }, { status: 400 })
  }
  if (!Array.isArray(body.product_ids) || !body.product_ids.length) {
    return NextResponse.json({ error: 'product_ids_required' }, { status: 400 })
  }
  if (!body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: 'dates_required' }, { status: 400 })
  }
  if (new Date(body.starts_at).getTime() >= new Date(body.ends_at).getTime()) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 })
  }

  const status = new Date(body.starts_at).getTime() <= Date.now() ? 'active' : 'scheduled'

  const { data, error } = await sb
    .from('store_discount_campaigns')
    .insert({
      store_id: auth.storeId,
      name: body.name.trim(),
      discount_pct: body.discount_pct,
      product_ids: body.product_ids,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      status,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}

interface PatchBody {
  id: string
  status?: 'scheduled' | 'active' | 'expired' | 'cancelled'
  ends_at?: string
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
  if (body.status) update.status = body.status
  if (body.ends_at) update.ends_at = body.ends_at
  const { data, error } = await sb
    .from('store_discount_campaigns')
    .update(update)
    .eq('id', body.id)
    .eq('store_id', auth.storeId)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ campaign: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const sb = await createSupabaseServer()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const { error } = await sb.from('store_discount_campaigns').delete().eq('id', id).eq('store_id', auth.storeId)
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
