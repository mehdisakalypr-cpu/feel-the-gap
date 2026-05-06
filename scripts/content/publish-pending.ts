/**
 * Cron entry point — drains social_post_queue (status=pending) and
 * dispatches each row to the matching platform handler. Updates
 * status, attempts, last_error, platform_post_id.
 *
 * Idempotency: status transition pending → publishing → published
 *              guards against double publishing on cron overlap.
 */

import { createClient } from '@supabase/supabase-js'
import { publishToPlatform, Platform } from '../../lib/ad-factory/distribution/platforms'

const BATCH = parseInt(process.env.PUBLISH_BATCH ?? '20', 10)
const MAX_ATTEMPTS = parseInt(process.env.PUBLISH_MAX_ATTEMPTS ?? '3', 10)

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

interface QueueRow {
  id: string
  target_saas: string
  platform: string
  video_url: string | null
  image_url: string | null
  caption: string
  hashtags: string[] | null
  scheduled_for: string | null
  attempts: number
  job_id: string | null
}

async function claimBatch(limit: number): Promise<QueueRow[]> {
  const db = adminDb()
  const now = new Date().toISOString()
  const { data } = await db
    .from('social_post_queue')
    .select('*')
    .eq('status', 'pending')
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .lt('attempts', MAX_ATTEMPTS)
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .limit(limit)
  return (data ?? []) as QueueRow[]
}

async function setStatus(
  id: string,
  status: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const db = adminDb()
  await db
    .from('social_post_queue')
    .update({ status, ...extra })
    .eq('id', id)
}

async function processRow(row: QueueRow): Promise<void> {
  const db = adminDb()
  const { error: lockErr, data: locked } = await db
    .from('social_post_queue')
    .update({ status: 'publishing', attempts: row.attempts + 1 })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (lockErr || !locked) {
    console.log(`[publish] skip ${row.id} — already locked or progressed`)
    return
  }

  const videoUrl = row.video_url ?? row.image_url ?? ''
  if (!videoUrl) {
    await setStatus(row.id, 'failed', { last_error: 'no media url', published_at: null })
    return
  }

  const result = await publishToPlatform({
    platform: row.platform as Platform,
    videoUrl,
    caption: row.caption,
    hashtags: row.hashtags ?? undefined,
    scheduledFor: row.scheduled_for ?? undefined,
  })

  if (result.ok) {
    await setStatus(row.id, result.stub ? 'stubbed' : 'published', {
      platform_post_id: result.platformPostId ?? null,
      platform_url: result.url ?? null,
      published_at: new Date().toISOString(),
      last_error: null,
    })
    console.log(
      `[publish] ${row.platform} saas=${row.target_saas} id=${row.id} → ${result.platformPostId} ${result.stub ? '(stub)' : ''}`,
    )
  } else {
    const isFinal = row.attempts + 1 >= MAX_ATTEMPTS
    await setStatus(row.id, isFinal ? 'failed' : 'pending', {
      last_error: (result.error ?? 'unknown').slice(0, 500),
    })
    console.log(
      `[publish] ${row.platform} saas=${row.target_saas} id=${row.id} FAILED attempt=${row.attempts + 1}/${MAX_ATTEMPTS} ${result.error}`,
    )
  }
}

async function main() {
  const rows = await claimBatch(BATCH)
  console.log(`[publish] claimed=${rows.length} batch=${BATCH}`)
  for (const r of rows) {
    try {
      await processRow(r)
    } catch (err) {
      console.error(`[publish] row=${r.id} threw:`, err)
      await setStatus(r.id, 'failed', {
        last_error: ((err as Error).message ?? 'thrown').slice(0, 500),
      })
    }
  }
  console.log(`[publish] done`)
}

main().catch(err => {
  console.error('[publish] fatal:', err)
  process.exit(1)
})
