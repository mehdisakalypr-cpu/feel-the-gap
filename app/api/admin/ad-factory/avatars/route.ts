import { NextRequest, NextResponse } from 'next/server'
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

export async function GET() {
  const { data, error } = await admin()
    .from('ftg_ad_avatars')
    .select('id, name, prompt, image_url, thumb_url, provider, gender, ethnicity, age_range, style, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, avatars: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 80)
  const prompt = String(body.prompt ?? '').trim()
  const image_url = String(body.image_url ?? '').trim()
  if (!name || !prompt || !/^https?:\/\//.test(image_url)) {
    return NextResponse.json({ error: 'name + prompt + valid image_url required' }, { status: 400 })
  }

  const { data, error } = await admin().from('ftg_ad_avatars').insert({
    name,
    prompt,
    image_url,
    provider: body.provider ?? null,
    gender: body.gender ?? null,
    ethnicity: body.ethnicity ?? null,
    age_range: body.age_range ?? null,
    style: body.style ?? null,
    tags: Array.isArray(body.tags) ? body.tags : null,
  }).select('id, name, image_url').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, avatar: data })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await admin().from('ftg_ad_avatars').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
