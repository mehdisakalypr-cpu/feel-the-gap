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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.project_id || !body.lang) {
    return NextResponse.json({ error: 'project_id + lang required' }, { status: 400 })
  }

  const { data, error } = await admin().from('ftg_ad_variants').insert({
    project_id: body.project_id,
    lang: body.lang,
    vo_script: body.vo_script ?? {},
    hero_name: body.hero_name ?? null,
    product: body.product ?? null,
    country_iso: body.country_iso ?? null,
    avatar_ids: Array.isArray(body.avatar_ids) ? body.avatar_ids : [],
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, variant: data })
}

/** POST /api/admin/ad-factory/variants/fork — génère N variants depuis la matrice user */
