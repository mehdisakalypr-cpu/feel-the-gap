/**
 * scout-queue-runner — dépile les jobs scout_queue pending par ordre de
 * priorité et lance prospect-orchestrator pour chaque triplet
 * (country, sector, product). Chaque job : transition pending → running →
 * done/failed avec horodatage + capture d'erreur.
 *
 * Run manuellement :
 *   npx tsx agents/scout-queue-runner.ts --max-jobs=5 --apply
 * Run via cron (toutes les heures) : cron natif VPS ou Vercel cron.
 *
 * --dry lance sans --apply passé à l'orchestrator (scouts en mode preview).
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'

loadEnv()

type CliArgs = { maxJobs: number; apply: boolean; maxPerJob: number }
function parseArgs(): CliArgs {
  const out: CliArgs = { maxJobs: 3, apply: false, maxPerJob: 30 }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-jobs' && v) out.maxJobs = Number(v)
    if (k === 'max-per-job' && v) out.maxPerJob = Number(v)
    if (k === 'apply') out.apply = true
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function runOrchestrator(job: {
  country_iso: string; sector: string; product_slug: string | null; max_results: number
}, apply: boolean, maxPerJob: number): Promise<{ ok: boolean; err?: string; resultsCount: number }> {
  return new Promise((resolve) => {
    const flags = [
      'agents/prospect-orchestrator.ts',
      `--country=${job.country_iso}`,
      `--sector=${job.sector}`,
      ...(job.product_slug ? [`--product=${job.product_slug}`] : []),
      `--max=${Math.min(job.max_results || 30, maxPerJob)}`,
      ...(apply ? ['--apply'] : []),
    ]
    const p = spawn('npx', ['--yes', 'tsx', ...flags], { stdio: ['inherit', 'pipe', 'pipe'] })
    let buf = ''
    let quotaHit = false
    p.stdout?.on('data', (chunk) => {
      const s = chunk.toString()
      process.stdout.write(s)
      buf += s
      if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(s)) quotaHit = true
    })
    p.stderr?.on('data', (chunk) => {
      const s = chunk.toString()
      process.stderr.write(s)
      buf += s
      if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(s)) quotaHit = true
    })
    p.on('close', (code) => {
      // Parse "✓ DB: N <label>" lines from each scout to count inserted rows
      let total = 0
      for (const m of buf.matchAll(/✓ DB:\s*(\d+)/g)) total += Number(m[1]) || 0
      const baseOk = code === 0
      // A job is only "done" if at least 1 row was inserted AND no quota error surfaced
      const ok = baseOk && total > 0 && !quotaHit
      const err = !baseOk
        ? `exit=${code}`
        : quotaHit
          ? 'quota_exhausted'
          : total === 0
            ? 'zero_results'
            : undefined
      resolve({ ok, err, resultsCount: total })
    })
    p.on('error', (e) => resolve({ ok: false, err: e.message, resultsCount: 0 }))
  })
}

async function main() {
  const { maxJobs, apply, maxPerJob } = parseArgs()
  const sb = db()

  console.log(`▶ scout-queue-runner: maxJobs=${maxJobs} apply=${apply} maxPerJob=${maxPerJob}`)

  for (let i = 0; i < maxJobs; i++) {
    // Claim 1 job — on fait un select + update ciblé par id (pas de SKIP LOCKED via REST,
    // donc on accepte le risque minime de double-claim et on protège par status='pending'
    // dans la condition d'update)
    const { data: jobs } = await sb
      .from('scout_queue')
      .select('id, country_iso, sector, product_slug, max_results, priority')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)

    const job = jobs?.[0]
    if (!job) { console.log('— no more pending jobs'); break }

    const { error: claimErr, count } = await sb
      .from('scout_queue')
      .update({ status: 'running', started_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', job.id)
      .eq('status', 'pending')
    if (claimErr || !count) { console.log(`— claim lost on ${job.id}, skipping`); continue }

    console.log(`\n━━━ [${i + 1}/${maxJobs}] ${job.country_iso}/${job.sector}/${job.product_slug ?? '-'} (p${job.priority}) ━━━`)
    const res = await runOrchestrator(job as any, apply, maxPerJob)

    await sb.from('scout_queue').update({
      status: res.ok ? 'done' : 'failed',
      finished_at: new Date().toISOString(),
      last_error: res.err ?? null,
      results_count: res.resultsCount,
    }).eq('id', job.id)

    console.log(res.ok ? `✓ done (rows=${res.resultsCount})` : `✗ failed: ${res.err} (rows=${res.resultsCount})`)

    // Back-off anti-quota Gemini : 3s entre jobs, 60s si quota touché
    const sleepMs = res.err === 'quota_exhausted' ? 60_000 : 3_000
    await new Promise((r) => setTimeout(r, sleepMs))
  }

  const { count: remaining } = await sb
    .from('scout_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  console.log(`\n→ remaining pending = ${remaining}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
