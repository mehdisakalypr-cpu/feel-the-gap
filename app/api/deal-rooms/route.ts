// © 2025-2026 Feel The Gap — Deal Rooms CRUD (seller-owned)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function uniqueSlug(base: string): Promise<string> {
  const a = admin()
  let candidate = base
  let n = 0
  while (true) {
    const { data } = await a.from('deal_rooms').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    n += 1
    candidate = `${base}-${n}`
    if (n > 50) return `${base}-${Date.now().toString(36)}`
  }
}

export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await admin()
    .from('deal_rooms')
    .select('id, slug, title, product_label, country_iso, status, published_at, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}

interface CreateBody {
  title: string
  summary?: string
  product_slug?: string
  product_label?: string
  country_iso?: string
  archetype?: string
  hero_image_url?: string
  gallery?: Array<{ url: string; alt?: string }>
  price_range?: { min?: number; max?: number; currency?: string; unit?: string }
  moq?: string
  lead_time_days?: number
  incoterms?: string[]
  certifications?: string[]
  cta_whatsapp?: string
  cta_email?: string
  cta_phone?: string
  match_id?: string
  opportunity_id?: string
  publish?: boolean
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: CreateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!body.title || body.title.trim().length < 4) {
    return NextResponse.json({ error: 'title_too_short' }, { status: 400 })
  }

  const slug = await uniqueSlug(slugify(body.title))
  const now = new Date().toISOString()

  const { data, error } = await admin().from('deal_rooms').insert({
    slug,
    seller_id: user.id,
    title: body.title.trim(),
    summary: body.summary?.trim() || null,
    product_slug: body.product_slug?.trim() || null,
    product_label: body.product_label?.trim() || null,
    country_iso: body.country_iso?.toUpperCase().slice(0, 3) || null,
    archetype: body.archetype?.trim() || null,
    hero_image_url: body.hero_image_url?.trim() || null,
    gallery: Array.isArray(body.gallery) ? body.gallery.slice(0, 20) : [],
    price_range: body.price_range || null,
    moq: body.moq?.trim() || null,
    lead_time_days: typeof body.lead_time_days === 'number' ? body.lead_time_days : null,
    incoterms: Array.isArray(body.incoterms) ? body.incoterms.slice(0, 8) : null,
    certifications: Array.isArray(body.certifications) ? body.certifications.slice(0, 10) : null,
    cta_whatsapp: body.cta_whatsapp?.trim() || null,
    cta_email: body.cta_email?.trim() || null,
    cta_phone: body.cta_phone?.trim() || null,
    match_id: body.match_id || null,
    opportunity_id: body.opportunity_id || null,
    status: body.publish ? 'published' : 'draft',
    published_at: body.publish ? now : null,
  }).select('id, slug, status').single()

  if (error || !data) {
    return NextResponse.json({ error: 'insert_failed', detail: error?.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    slug: data.slug,
    status: data.status,
    public_url: `/deal/${data.slug}`,
  })
}
