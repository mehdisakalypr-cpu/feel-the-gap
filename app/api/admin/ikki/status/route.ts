import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, statSync, readdirSync } from 'fs'

export const dynamic = 'force-dynamic'

const run = promisify(execFile)

async function requireAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const SNAPSHOTS_DIR = '/root/ikki/local-snapshots'
  const STATE_DIR = '/root/ikki/state'
  const LOG_FILE = '/root/monitor/logs/ikki-snapshot.log'

  let recentSnapshots: Array<{ name: string; size_mb: number; mtime: string }> = []
  if (existsSync(SNAPSHOTS_DIR)) {
    recentSnapshots = readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.startsWith('ikki-archive-'))
      .map((f) => {
        const st = statSync(`${SNAPSHOTS_DIR}/${f}`)
        return { name: f, size_mb: Math.round(st.size / 1024 / 1024), mtime: st.mtime.toISOString() }
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime))
      .slice(0, 10)
  }

  let lastLogTail = ''
  if (existsSync(LOG_FILE)) {
    try {
      const { stdout } = await run('tail', ['-30', LOG_FILE])
      lastLogTail = stdout
    } catch {
      lastLogTail = '(log read failed)'
    }
  }

  const config = {
    age_recipients_configured: existsSync(`${STATE_DIR}/age-recipients.txt`),
    hetzner_sb_configured: existsSync(`${STATE_DIR}/hetzner-sb.env`),
    db_urls_configured: existsSync(`${STATE_DIR}/db-urls.env`),
    sovereignty_dir_present: existsSync('/root/sovereignty'),
    cc_fleet_state_present: existsSync('/root/cc-fleet'),
    rclone_b2_remote: false,
  }

  try {
    const { stdout } = await run('rclone', ['listremotes'])
    config.rclone_b2_remote = stdout.includes('b2:')
  } catch {
    /* ignore */
  }

  let cronActive = false
  try {
    const { stdout } = await run('crontab', ['-l'])
    cronActive = stdout.includes('ikki-snapshot.sh')
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    health: {
      cron_active: cronActive,
      snapshots_count: recentSnapshots.length,
      latest_snapshot: recentSnapshots[0]?.name ?? null,
      latest_size_mb: recentSnapshots[0]?.size_mb ?? 0,
      latest_age_minutes: recentSnapshots[0] ? Math.round((Date.now() - new Date(recentSnapshots[0].mtime).getTime()) / 60000) : null,
    },
    config,
    recent_snapshots: recentSnapshots,
    last_log_tail: lastLogTail.split('\n').slice(-15),
  })
}
