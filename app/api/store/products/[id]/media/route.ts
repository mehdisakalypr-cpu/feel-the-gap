// © 2025-2026 Feel The Gap — product media: POST add, PATCH cover, DELETE

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireOwnerApi } from '@/app/account/store/_lib/store-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

const MAX_PHOTOS = 10

async function ownsProduct(productId: string, storeId: string) {
  const sb = await createSupabaseServer()
  const { data } = await sb
    .from('store_products')
    .select('id')
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle()
  return !!data
}

interface AddBody {
  type: 'photo' | 'video'
  url: string
  caption?: string | null
  is_cover?: boolean
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id: productId } = await params
  if (!(await ownsProduct(productId, auth.storeId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let body: AddBody
  try { body = (await req.json()) as AddBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.url) return NextResponse.json({ error: 'url_required' }, { status: 400 })
  try { new URL(body.url) } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  const sb = await createSupabaseServer()
  if (body.type === 'photo') {
    const { count } = await sb
      .from('store_product_media')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('type', 'photo')
    if ((count ?? 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: 'photo_limit', message: `Max ${MAX_PHOTOS} photos atteint` }, { status: 400 })
    }
  }

  // Position = last
  const { data: posData } = await sb
    .from('store_product_media')
    .select('position')
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (posData?.position ?? -1) + 1

  // is_cover : if first photo and none yet, auto cover
  let isCover = !!body.is_cover
  if (body.type === 'photo') {
    const { count: coverCount } = await sb
      .from('store_product_media')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('is_cover', true)
    if ((coverCount ?? 0) === 0) isCover = true
  }

  if (isCover) {
    await sb.from('store_product_media').update({ is_cover: false }).eq('product_id', productId)
  }

  const { data, error } = await sb
    .from('store_product_media')
    .insert({
      product_id: productId,
      type: body.type,
      url: body.url,
      caption: body.caption ?? null,
      position: nextPosition,
      is_cover: isCover,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ item: data }, { status: 201 })
}

interface PatchBody {
  id: string
  is_cover?: boolean
  caption?: string | null
  position?: number
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id: productId } = await params
  if (!(await ownsProduct(productId, auth.storeId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  let body: PatchBody
  try { body = (await req.json()) as PatchBody } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const sb = await createSupabaseServer()
  if (body.is_cover === true) {
    await sb.from('store_product_media').update({ is_cover: false }).eq('product_id', productId)
  }
  const update: Record<string, unknown> = {}
  if (typeof body.is_cover === 'boolean') update.is_cover = body.is_cover
  if (body.caption !== undefined) update.caption = body.caption
  if (typeof body.position === 'number') update.position = body.position
  const { data, error } = await sb
    .from('store_product_media')
    .update(update)
    .eq('id', body.id)
    .eq('product_id', productId)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOwnerApi()
  if ('resp' in auth) return auth.resp
  const { id: productId } = await params
  if (!(await ownsProduct(productId, auth.storeId))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const mediaId = req.nextUrl.searchParams.get('id')
  if (!mediaId) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const sb = await createSupabaseServer()
  const { error } = await sb.from('store_product_media').delete().eq('id', mediaId).eq('product_id', productId)
  if (error) return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
