import { NextResponse } from 'next/server'
import { createSupabaseServer, getAuthUser } from '@/lib/supabase-server'

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'product'
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const sb = await createSupabaseServer()
  const { data, error } = await sb.from('seller_products')
    .select('id, slug, title, description, hs_code, origin_country, unit_price_eur, unit, available_qty, images, status, visibility, views_count, quotes_requested_count, created_at, updated_at')
    .eq('seller_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data })
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })

  const title = String(body.title ?? '').trim()
  const origin_country = String(body.origin_country ?? '').trim().toUpperCase()
  const unit_price_eur = Number(body.unit_price_eur ?? 0)
  if (!title || title.length < 3) return NextResponse.json({ ok: false, error: 'title required (>=3 chars)' }, { status: 400 })
  if (!origin_country || origin_country.length !== 3) return NextResponse.json({ ok: false, error: 'origin_country must be ISO3' }, { status: 400 })
  if (unit_price_eur <= 0) return NextResponse.json({ ok: false, error: 'unit_price_eur > 0 required' }, { status: 400 })

  const sb = await createSupabaseServer()
  const slugBase = slugify(title)
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 8)}`

  const { data, error } = await sb.from('seller_products').insert({
    seller_id: user.id,
    slug,
    title,
    description: body.description ?? null,
    hs_code: body.hs_code ?? null,
    origin_country,
    origin_port: body.origin_port ?? null,
    unit_price_eur,
    min_order_qty: body.min_order_qty ?? null,
    unit: body.unit ?? 'kg',
    available_qty: body.available_qty ?? null,
    incoterm_preferred: body.incoterm_preferred ?? 'FOB',
    images: Array.isArray(body.images) ? body.images : [],
    certifications: Array.isArray(body.certifications) ? body.certifications : [],
    status: body.status === 'active' ? 'active' : 'draft',
    visibility: body.visibility === 'public' ? 'public' : 'private',
  }).select('id, slug').single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug })
}
