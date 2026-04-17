import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'

export const maxDuration = 10
export const runtime = 'nodejs'

/**
 * Full world-wide data refresh.
 *
 * Trigger paths:
 *  - Admin UI (/admin/data) — POST, authenticated by cookie (isAdmin())
 *  - VPS script /root/scripts/ftg-refresh.sh — POST with x-cron-secret
 *
 * Runs runFreeCollector({ allCountries: true }) → runGapAnalyzer() in the
 * background so the HTTP response returns immediately. The work completes
 * within ~3-5 minutes on Vercel's function runtime (since the spawned
 * import runs until the function container recycles).
 *
 * We record the trigger in agent_runs so the admin UI can poll status.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const matchesSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET
  const authorized = matchesSecret || (await isAdmin())
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { runFreeCollector, runGapAnalyzer } = await import('@/agents/free-collector')
  const year = Number(req.nextUrl.searchParams.get('year') ?? '2023')

  runFreeCollector({ year, allCountries: true })
    .then(() => runGapAnalyzer())
    .catch((err) => console.error('[refresh-all] collector failed', err))

  return NextResponse.json({
    ok: true,
    started_at: new Date().toISOString(),
    message: 'Full world-wide refresh started in background',
    year,
    trigger: matchesSecret ? 'cron-secret' : 'admin-session',
  })
}

/** GET reports last run status for the admin UI spinner. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { supabaseAdmin } = await import('@/lib/supabase')
  const admin = supabaseAdmin()
  const { data } = await admin
    .from('agent_runs')
    .select('id, agent, status, started_at, finished_at, countries_processed, records_inserted, errors')
    .eq('agent', 'free_collector')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return NextResponse.json({ last_run: data ?? null })
}
