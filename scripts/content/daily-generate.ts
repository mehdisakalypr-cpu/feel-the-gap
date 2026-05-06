/**
 * Cron entry point — daily content generation per SaaS.
 *
 * Reads N pending content_jobs for TARGET_SAAS, runs the
 * image generation cascade (image-gen.ts), persists the
 * artefacts and marks the job done. Video / audio / merge
 * stages plug in here once the full pipeline lands.
 */

import { createClient } from '@supabase/supabase-js'
import { generateImage } from '../../lib/ad-factory/providers/image-gen'

const TARGET_SAAS = process.env.TARGET_SAAS ?? 'ftg'
const BATCH = parseInt(process.env.DAILY_BATCH ?? '3', 10)

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface ContentJobRow {
  id: string
  workflow: string
  mode: string | null
  status: string
  inputs: Record<string, unknown> | null
  triggered_by: string | null
}

async function claimPending(saas: string, limit: number): Promise<ContentJobRow[]> {
  const db = adminDb()
  const { data } = await db
    .from('content_jobs')
    .select('*')
    .eq('status', 'queued')
    .eq('inputs->>target_saas', saas)
    .order('created_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as ContentJobRow[]
}

async function markJob(id: string, status: string, extra: Record<string, unknown> = {}) {
  const db = adminDb()
  await db
    .from('content_jobs')
    .update({ status, ...extra })
    .eq('id', id)
}

async function runJob(job: ContentJobRow): Promise<{ ok: boolean; artifacts: number; error?: string }> {
  const inputs = (job.inputs ?? {}) as Record<string, unknown>
  const prompt = String(inputs.prompt ?? '')
  const persona = String(inputs.persona ?? 'entrepreneur')
  const variants = Math.max(1, Math.min(5, Number(inputs.variants ?? 3)))

  await markJob(job.id, 'running')

  const result = await generateImage({
    prompt: `${persona} persona for ${TARGET_SAAS}: ${prompt}`,
    style: 'photorealistic',
    aspectRatio: '9:16',
    variants,
  })

  if (!result.ok) {
    await markJob(job.id, 'failure', {
      finished_at: new Date().toISOString(),
      artifacts_path: null,
    })
    return { ok: false, artifacts: 0, error: result.error }
  }

  const db = adminDb()
  for (const v of result.variants) {
    await db.from('social_post_queue').insert({
      target_saas: TARGET_SAAS,
      platform: 'meta-ig',
      image_url: v.url,
      caption: prompt,
      hashtags: [TARGET_SAAS, persona],
      slot: 'morning',
      status: 'pending',
      job_id: job.id,
    })
  }

  await markJob(job.id, 'success', {
    finished_at: new Date().toISOString(),
    artifacts_path: `daily/${TARGET_SAAS}/${job.id}`,
  })
  return { ok: true, artifacts: result.variants.length }
}

async function main() {
  const jobs = await claimPending(TARGET_SAAS, BATCH)
  console.log(`[daily-generate] saas=${TARGET_SAAS} claimed=${jobs.length}`)
  let artifacts = 0
  for (const j of jobs) {
    const r = await runJob(j)
    artifacts += r.artifacts
    console.log(
      `[daily-generate] job=${j.id} ok=${r.ok} artifacts=${r.artifacts}${r.error ? ' err=' + r.error : ''}`,
    )
  }
  console.log(`[daily-generate] done saas=${TARGET_SAAS} jobs=${jobs.length} artifacts=${artifacts}`)
}

main().catch(err => {
  console.error('[daily-generate] fatal:', err)
  process.exit(1)
})
