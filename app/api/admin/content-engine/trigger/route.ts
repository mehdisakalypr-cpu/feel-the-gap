import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase-server'
import { triggerWorkflow } from '@/lib/content-engine'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  let body: {
    mode?: string
    prompt?: string
    asset_url?: string
    persona?: string
    target_saas?: string
    variants?: number
    triggered_by?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const { runId, runUrl } = await triggerWorkflow({
      mode: body.mode,
      prompt: body.prompt,
      asset_url: body.asset_url,
      persona: body.persona,
      target_saas: body.target_saas,
      variants: body.variants,
    })

    const db = adminDb()
    await db.from('content_jobs').insert({
      id: runId,
      workflow: 'manual-create',
      mode: body.mode ?? 'regenerate',
      status: 'queued',
      inputs: body,
      triggered_by: body.triggered_by ?? null,
      github_run_url: runUrl,
      artifacts_path: `dist/manual/${runId}`,
    })

    return NextResponse.json({ runId, runUrl })
  } catch (err) {
    console.error('[content-engine/trigger]', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'Trigger failed' },
      { status: 500 },
    )
  }
}
