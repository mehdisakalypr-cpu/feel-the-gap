import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { isAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // allow up to 5 min synchronous cycle

// POST /api/admin/eishi-run-now?kind=videos|base
// Spawns the corresponding runner script with capped max-pairs and
// resolves once the script exits. Admin-only. Never runs in the request
// thread on Vercel — uses a detached bash to honor the runner's own
// setEnv + flock pattern (same as cron).
export async function POST(req: NextRequest) {
  const authorized = await isAdmin()
  if (!authorized) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind') as 'videos' | 'base' | null
  if (kind !== 'videos' && kind !== 'base') {
    return NextResponse.json({ error: 'kind must be videos|base' }, { status: 400 })
  }

  // Vercel serverless can't spawn long-running child processes, so this
  // route only works when hit on the VPS (Node runtime). On Vercel we
  // return a helpful error; user runs directly from /admin on VPS-hosted
  // instance or via the cron that's always live.
  const onVercel = !!process.env.VERCEL_ENV
  if (onVercel) {
    return NextResponse.json({
      ok: false,
      error: 'Run-now is VPS-only. The Vercel runtime cannot spawn long child processes. The cron handles scheduling every 10-15 min.',
    }, { status: 501 })
  }

  const script = kind === 'videos'
    ? '/root/monitor/ftg-rock-lee-v2.sh'
    : '/root/monitor/ftg-eishi-base.sh'

  return await new Promise<Response>((resolve) => {
    const proc = spawn('bash', [script], { detached: true, stdio: 'ignore' })
    proc.on('error', (err) => {
      resolve(NextResponse.json({ ok: false, error: err.message }, { status: 500 }))
    })
    proc.unref()
    // Resolve immediately once spawn succeeds (runner writes to log).
    // The flock in the .sh script prevents concurrent runs.
    setTimeout(() => {
      resolve(NextResponse.json({ ok: true, kind, pid: proc.pid, note: 'launched in background, check /admin/eishi-coverage in ~60s' }))
    }, 200)
  })
}
