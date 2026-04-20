// @ts-nocheck
/**
 * content-orchestrator (Shisui) — dispatches ftg_content_jobs to the 4 content
 * agents (Shikamaru/Itachi/Hancock/Rock Lee). Writes aggregated content to
 * ftg_opportunity_content (one row per opp×country×lang).
 *
 * Run manually:
 *   npx tsx agents/content-orchestrator.ts --max-jobs=5
 *
 * Via VPS cron (every 5 min) or Vercel cron.
 *
 * Philosophy:
 *   - NEVER call at request time. Public pages SELECT-only.
 *   - Pre-compute via admin trigger OR stale auto-refresh.
 *   - Graceful back-off on LLM quota; retry up to max_attempts.
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateProductionMethods } from './content-shikamaru'
import { generateBusinessPlans } from './content-itachi'
import { generatePotentialClients } from './content-hancock'
import { generateYoutubeVideos } from './content-rock-lee'

loadEnv()

type CliArgs = { maxJobs: number; verbose: boolean }
function parseArgs(): CliArgs {
  const out: CliArgs = { maxJobs: 10, verbose: false }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-jobs' && v) out.maxJobs = Number(v)
    if (k === 'verbose') out.verbose = true
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Job = {
  id: string
  job_type: 'full' | 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos'
  opp_id: string
  country_iso: string
  lang: string
  attempts: number
  max_attempts: number
}

type AgentResult = {
  ok: boolean
  cost_eur: number
  err?: string
  quotaHit?: boolean
}

/** Fetch opp + product + country needed by agents. */
async function loadContext(sb: any, opp_id: string, country_iso: string) {
  const { data: opp } = await sb.from('opportunities').select('*').eq('id', opp_id).maybeSingle()
  if (!opp) throw new Error(`opp ${opp_id} not found`)
  const { data: country } = await sb.from('countries').select('iso3, name_fr, name_en').eq('iso3', country_iso).maybeSingle()
  const productName = opp.product_name || opp.product_slug || 'unknown'
  const countryName = country?.name_fr || country?.name_en || country_iso
  return { opp, productName, countryName }
}

/** Upsert content slice for a single (opp, country, lang, key). */
async function writeSlice(
  sb: any,
  key: 'production_methods' | 'business_plans' | 'potential_clients' | 'youtube_videos',
  opp_id: string, country_iso: string, lang: string,
  payload: unknown,
  cost_eur: number,
) {
  const { data: existing } = await sb
    .from('ftg_opportunity_content')
    .select('id, cost_eur, agent_versions')
    .eq('opp_id', opp_id).eq('country_iso', country_iso).eq('lang', lang)
    .maybeSingle()

  const versions = { ...(existing?.agent_versions || {}), [key]: new Date().toISOString() }

  if (existing) {
    await sb.from('ftg_opportunity_content').update({
      [key]: payload,
      agent_versions: versions,
      cost_eur: (existing.cost_eur || 0) + cost_eur,
    }).eq('id', existing.id)
  } else {
    await sb.from('ftg_opportunity_content').insert({
      opp_id, country_iso, lang,
      [key]: payload,
      agent_versions: versions,
      cost_eur,
      status: 'generating',
    })
  }
}

/** After all 4 slices are written, mark content as ready. */
async function markReadyIfComplete(sb: any, opp_id: string, country_iso: string, lang: string) {
  const { data: row } = await sb
    .from('ftg_opportunity_content')
    .select('production_methods, business_plans, potential_clients, youtube_videos')
    .eq('opp_id', opp_id).eq('country_iso', country_iso).eq('lang', lang)
    .maybeSingle()
  if (!row) return
  const allFilled =
    row.production_methods && row.business_plans && row.potential_clients && row.youtube_videos
  await sb.from('ftg_opportunity_content').update({
    status: allFilled ? 'ready' : 'generating',
    generated_at: allFilled ? new Date().toISOString() : null,
  }).eq('opp_id', opp_id).eq('country_iso', country_iso).eq('lang', lang)
}

/** Dispatch single job. */
async function runJob(sb: any, job: Job): Promise<AgentResult> {
  const ctx = await loadContext(sb, job.opp_id, job.country_iso)
  const subtypes: Array<'production_methods'|'business_plans'|'potential_clients'|'youtube_videos'> =
    job.job_type === 'full'
      ? ['production_methods','business_plans','potential_clients','youtube_videos']
      : [job.job_type as any]

  let totalCost = 0
  let quotaHit = false
  const errs: string[] = []

  for (const st of subtypes) {
    try {
      let r: { payload: unknown; cost_eur: number }
      if (st === 'production_methods') r = await generateProductionMethods(ctx.opp, ctx.productName, ctx.countryName, job.lang)
      else if (st === 'business_plans') r = await generateBusinessPlans(ctx.opp, ctx.productName, ctx.countryName, job.lang)
      else if (st === 'potential_clients') r = await generatePotentialClients(ctx.opp, ctx.productName, ctx.countryName, job.lang)
      else r = await generateYoutubeVideos(ctx.opp, ctx.productName, ctx.countryName, job.lang)

      await writeSlice(sb, st, job.opp_id, job.country_iso, job.lang, r.payload, r.cost_eur)
      totalCost += r.cost_eur
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) quotaHit = true
      errs.push(`${st}: ${msg}`)
    }
  }

  if (job.job_type === 'full' || errs.length === 0) {
    await markReadyIfComplete(sb, job.opp_id, job.country_iso, job.lang)
  }

  return {
    ok: errs.length === 0,
    cost_eur: totalCost,
    err: errs.length ? errs.join(' | ') : undefined,
    quotaHit,
  }
}

async function main() {
  const { maxJobs, verbose } = parseArgs()
  const sb = db()
  console.log(`▶ content-orchestrator (Shisui): maxJobs=${maxJobs}`)

  for (let i = 0; i < maxJobs; i++) {
    const { data: claimed, error } = await sb.rpc('claim_next_content_job')
    if (error) { console.error('claim error:', error.message); break }
    const job = claimed as Job | null
    if (!job || !job.id) { console.log('— queue empty'); break }

    console.log(`\n━━━ [${i+1}/${maxJobs}] ${job.job_type} · ${job.country_iso} · opp ${String(job.opp_id).slice(0,8)} (attempt ${job.attempts}) ━━━`)

    const start = Date.now()
    const res = await runJob(sb, job)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    // Retry logic: if failed and attempts < max, requeue (pending); else mark failed
    const shouldRetry = !res.ok && job.attempts < job.max_attempts
    await sb.from('ftg_content_jobs').update({
      status: shouldRetry ? 'pending' : (res.ok ? 'done' : 'failed'),
      finished_at: shouldRetry ? null : new Date().toISOString(),
      last_error: res.err || null,
      cost_eur: res.cost_eur,
    }).eq('id', job.id)

    console.log(res.ok
      ? `✓ done (${elapsed}s, €${res.cost_eur.toFixed(3)})`
      : `✗ ${shouldRetry ? 'retry' : 'failed'}: ${res.err}`
    )

    const sleepMs = res.quotaHit ? 60_000 : 2_000
    await new Promise((r) => setTimeout(r, sleepMs))
  }

  const { count: remaining } = await sb
    .from('ftg_content_jobs').select('*', { count:'exact', head:true }).eq('status','pending')
  console.log(`\n→ remaining pending jobs = ${remaining}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
