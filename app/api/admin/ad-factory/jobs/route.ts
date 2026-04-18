import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runJob } from '@/lib/ad-factory/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET() {
  const { data, error } = await admin()
    .from('ftg_ad_render_jobs')
    .select('id, variant_id, status, progress_pct, final_mp4_url, duration_s, cost_eur, error, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, jobs: data ?? [] })
}

/**
 * POST /api/admin/ad-factory/jobs — crée 1 ou N jobs depuis variant_ids[] + déclenche la queue.
 * Body: { variant_ids: string[], trigger?: 'sync'|'background' }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const variantIds: string[] = Array.isArray(body.variant_ids) ? body.variant_ids : []
  if (variantIds.length === 0) return NextResponse.json({ error: 'variant_ids[] required' }, { status: 400 })

  const sb = admin()
  const rows = variantIds.map(vid => ({ variant_id: vid, status: 'queued' }))
  const { data: jobs, error } = await sb.from('ftg_ad_render_jobs').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Run en sync pour le 1er job (preview instantanée), les autres restent queued
  // Le cron worker (ou trigger manuel) les picke ensuite.
  if (body.trigger !== 'background' && jobs && jobs[0]) {
    // fire-and-forget — runJob met à jour le DB en continu
    void runJob(jobs[0].id).catch(err => console.error('[job]', err))
  }

  return NextResponse.json({ ok: true, job_ids: (jobs ?? []).map(j => j.id) })
}
