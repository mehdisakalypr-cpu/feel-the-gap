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

type CliArgs = { maxJobs: number; concurrency: number; verbose: boolean }
function parseArgs(): CliArgs {
  const out: CliArgs = { maxJobs: 10, concurrency: 4, verbose: false }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-jobs' && v) out.maxJobs = Number(v)
    if (k === 'concurrency' && v) out.concurrency = Number(v)
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

/** ISO3 → ISO2 mapping for the common ones (countries table keys are iso2). */
const ISO3_TO_ISO2: Record<string, string> = {
  USA:'US', CHN:'CN', JPN:'JP', NLD:'NL', EGY:'EG', ECU:'EC', NPL:'NP', DEU:'DE',
  GBR:'GB', MOZ:'MZ', THA:'TH', ERI:'ER', ITA:'IT', NAM:'NA', ZMB:'ZM', DOM:'DO',
  JOR:'JO', FRA:'FR', ESP:'ES', PRT:'PT', BEL:'BE', SWE:'SE', NOR:'NO', FIN:'FI',
  DNK:'DK', POL:'PL', CHE:'CH', AUT:'AT', GRC:'GR', TUR:'TR', RUS:'RU', UKR:'UA',
  IND:'IN', IDN:'ID', PAK:'PK', BGD:'BD', PHL:'PH', VNM:'VN', MYS:'MY', SGP:'SG',
  KOR:'KR', KAZ:'KZ', UZB:'UZ', AUS:'AU', NZL:'NZ', CAN:'CA', MEX:'MX', BRA:'BR',
  ARG:'AR', COL:'CO', CHL:'CL', PER:'PE', VEN:'VE', BOL:'BO', PRY:'PY', URY:'UY',
  ZAF:'ZA', NGA:'NG', KEN:'KE', ETH:'ET', MAR:'MA', DZA:'DZ', TUN:'TN', LBY:'LY',
  GHA:'GH', CIV:'CI', SEN:'SN', MLI:'ML', BFA:'BF', NER:'NE', TCD:'TD', SDN:'SD',
  TZA:'TZ', UGA:'UG', RWA:'RW', MDG:'MG', MUS:'MU', GNB:'GW', PAN:'PA', MNG:'MN',
  TLS:'TL',
}

/** Fetch opp + product + country needed by agents. */
async function loadContext(sb: any, opp_id: string, country_iso: string) {
  const { data: opp } = await sb.from('opportunities').select('*').eq('id', opp_id).maybeSingle()
  if (!opp) throw new Error(`opp ${opp_id} not found`)

  // Products table: fetch by product_id
  let productName = 'unknown'
  if (opp.product_id) {
    const { data: p } = await sb.from('products').select('name_fr, name').eq('id', opp.product_id).maybeSingle()
    productName = p?.name_fr || p?.name || 'unknown'
  }

  // Countries table uses iso2; opportunities uses iso3 — map for lookup
  const iso2 = ISO3_TO_ISO2[country_iso] || country_iso
  let countryName = country_iso
  if (iso2) {
    const { data: country } = await sb.from('countries').select('iso2, name_fr, name').eq('iso2', iso2).maybeSingle()
    countryName = country?.name_fr || country?.name || country_iso
    // attach iso2 for YouTube regionCode
    ;(opp as any).country_iso2 = iso2
  }

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

  // Per-agent timeout to prevent infinite hangs when LLM providers stall
  // Bumped from 120s → 240s after CHN/USA fr jobs hit the limit on
  // business_plans (itachi) / potential_clients (hancock) — large datasets.
  const AGENT_TIMEOUT_MS = 240_000 // 4 min
  const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${AGENT_TIMEOUT_MS/1000}s`)), AGENT_TIMEOUT_MS)),
    ])

  for (const st of subtypes) {
    try {
      let r: { payload: unknown; cost_eur: number }
      if (st === 'production_methods') r = await withTimeout(generateProductionMethods(ctx.opp, ctx.productName, ctx.countryName, job.lang), 'shikamaru')
      else if (st === 'business_plans') r = await withTimeout(generateBusinessPlans(ctx.opp, ctx.productName, ctx.countryName, job.lang), 'itachi')
      else if (st === 'potential_clients') r = await withTimeout(generatePotentialClients(ctx.opp, ctx.productName, ctx.countryName, job.lang), 'hancock')
      else r = await withTimeout(generateYoutubeVideos(ctx.opp, ctx.productName, ctx.countryName, job.lang), 'rock-lee')

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
  const { maxJobs, concurrency } = parseArgs()
  const sb = db()
  console.log(`▶ content-orchestrator (Shisui): maxJobs=${maxJobs} concurrency=${concurrency}`)

  // Shared counters across workers
  const state = { processed: 0, globalQuotaHit: false, done: 0, retried: 0, failed: 0 }

  // Each worker loops claim→process→update until maxJobs reached or queue empty.
  // claim_next_content_job() uses FOR UPDATE SKIP LOCKED so concurrent workers
  // safely grab disjoint jobs from the queue.
  async function worker(wid: number) {
    while (state.processed < maxJobs && !state.globalQuotaHit) {
      const { data: claimed, error } = await sb.rpc('claim_next_content_job')
      if (error) { console.error(`[w${wid}] claim error:`, error.message); return }
      const job = claimed as Job | null
      if (!job || !job.id) return  // queue empty → exit worker

      const slot = ++state.processed
      console.log(`━━━ [w${wid} · ${slot}/${maxJobs}] ${job.job_type} · ${job.country_iso} · opp ${String(job.opp_id).slice(0,8)} (attempt ${job.attempts}) ━━━`)

      const start = Date.now()
      const res = await runJob(sb, job)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)

      const shouldRetry = !res.ok && job.attempts < job.max_attempts
      await sb.from('ftg_content_jobs').update({
        status: shouldRetry ? 'pending' : (res.ok ? 'done' : 'failed'),
        finished_at: shouldRetry ? null : new Date().toISOString(),
        last_error: res.err || null,
        cost_eur: res.cost_eur,
      }).eq('id', job.id)

      if (res.ok) state.done++
      else if (shouldRetry) state.retried++
      else state.failed++

      console.log(res.ok
        ? `✓ [w${wid}·${slot}] done (${elapsed}s, €${res.cost_eur.toFixed(3)})`
        : `✗ [w${wid}·${slot}] ${shouldRetry ? 'retry' : 'failed'}: ${String(res.err).slice(0,140)}`
      )

      if (res.quotaHit) {
        // Brief cooldown on this worker to let providers rotate; other workers keep going
        await new Promise((r) => setTimeout(r, 30_000))
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))

  const { count: remaining } = await sb
    .from('ftg_content_jobs').select('*', { count:'exact', head:true }).eq('status','pending')
  console.log(`\n→ processed=${state.processed} (done=${state.done} retry=${state.retried} failed=${state.failed}) · pending left = ${remaining}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
