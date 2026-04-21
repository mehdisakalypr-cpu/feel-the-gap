import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  let q = admin().from('ftg_ad_scenes')
    .select('id, name, prompt, image_url, animated_mp4_url, source_type, motion_prompt, provider_image, provider_video, aspect_ratio, duration_s, tags, category, seasonal_variant, parent_id, created_at')
    .order('created_at', { ascending: false }).limit(300)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scenes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 100)
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await admin().from('ftg_ad_scenes').insert({
    name,
    prompt: body.prompt ?? null,
    image_url: body.image_url ?? null,
    animated_mp4_url: body.animated_mp4_url ?? null,
    source_type: body.source_type ?? 'generated',
    motion_prompt: body.motion_prompt ?? null,
    provider_image: body.provider_image ?? null,
    provider_video: body.provider_video ?? null,
    aspect_ratio: body.aspect_ratio ?? '9:16',
    duration_s: body.duration_s ?? null,
    tags: Array.isArray(body.tags) ? body.tags : null,
    category: body.category ?? null,
    seasonal_variant: body.seasonal_variant ?? null,
    parent_id: body.parent_id ?? null,
  }).select('id, name, image_url, animated_mp4_url').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scene: data })
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await admin().from('ftg_ad_scenes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
