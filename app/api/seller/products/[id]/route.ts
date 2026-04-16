import { NextResponse } from 'next/server'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const sb = await createSupabaseServer()
  const { data, error } = await sb.from('seller_products').select('*').eq('id', id).eq('seller_id', user.id).single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 })
  return NextResponse.json({ ok: true, item: data })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })

  const updates: Record<string, any> = {}
  for (const k of ['title','description','hs_code','origin_country','origin_port','unit_price_eur','min_order_qty','unit','available_qty','incoterm_preferred','images','certifications','status','visibility']) {
    if (k in body) updates[k] = body[k]
  }

  const sb = await createSupabaseServer()
  const { data, error } = await sb.from('seller_products').update(updates).eq('id', id).eq('seller_id', user.id).select('id').single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const sb = await createSupabaseServer()
  const { error } = await sb.from('seller_products').update({ status: 'archived' }).eq('id', id).eq('seller_id', user.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
