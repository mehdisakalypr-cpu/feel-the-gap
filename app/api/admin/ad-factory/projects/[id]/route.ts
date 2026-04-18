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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = admin()
  const [p, v, j] = await Promise.all([
    sb.from('ftg_ad_projects').select('*').eq('id', id).maybeSingle(),
    sb.from('ftg_ad_variants').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    sb.from('ftg_ad_render_jobs').select('*').order('created_at', { ascending: false }).limit(50),
  ])
  if (!p.data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const variantIds = new Set((v.data ?? []).map(x => x.id))
  const relevantJobs = (j.data ?? []).filter(job => variantIds.has(job.variant_id))

  return NextResponse.json({
    ok: true,
    project: p.data,
    variants: v.data ?? [],
    jobs: relevantJobs,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name) patch.name = String(body.name).slice(0, 120)
  if (body.description !== undefined) patch.description = body.description
  if (body.drive_folder_url !== undefined) patch.drive_folder_url = body.drive_folder_url
  if (body.brief) patch.brief = body.brief
  if (body.status) patch.status = body.status
  if (body.image_refs) patch.image_refs = body.image_refs

  const { error } = await admin().from('ftg_ad_projects').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
