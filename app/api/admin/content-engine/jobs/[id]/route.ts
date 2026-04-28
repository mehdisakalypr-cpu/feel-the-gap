import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase-server'
import { pollJob, listArtifacts } from '@/lib/content-engine'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (gate) return gate

  const { id } = await params
  const db = adminDb()

  const { data: job, error } = await db
    .from('content_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Poll live status from GitHub if still active
  let liveStatus = job.status
  let liveUrl = job.github_run_url
  let artifacts: Awaited<ReturnType<typeof listArtifacts>> = []

  if (job.status === 'queued' || job.status === 'running') {
    try {
      const poll = await pollJob(id)
      liveStatus = poll.status
      liveUrl = poll.html_url

      if (liveStatus !== job.status) {
        const update: Record<string, unknown> = { status: liveStatus }
        if (liveStatus === 'success' || liveStatus === 'failure') {
          update.finished_at = new Date().toISOString()
        }
        await db.from('content_jobs').update(update).eq('id', id)
      }
    } catch (e) {
      console.error('[content-engine/jobs/[id]] poll error', e)
    }
  }

  if (liveStatus === 'success') {
    try {
      artifacts = await listArtifacts(id)
    } catch (e) {
      console.error('[content-engine/jobs/[id]] artifacts error', e)
    }
  }

  return NextResponse.json({
    job: { ...job, status: liveStatus, github_run_url: liveUrl },
    artifacts,
  })
}
