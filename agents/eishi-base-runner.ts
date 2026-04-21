// @ts-nocheck
/**
 * eishi-base-runner — Eishi Layer 1 populator.
 *
 * Generates the shared BASE content for (product × country × lang) triples
 * missing from ftg_product_country_content, running Shikamaru + Itachi +
 * Hancock in parallel on a representative synthetic opp context.
 *
 * Why: same (product × country) pair repeats across 15-30 opportunities in
 * the DB. Generating per-opp means LLM runs 20× what's needed for data that's
 * intrinsic to the market. This runner dedup-generates at the product×country
 * grain and the UI merges with per-opp personalization overrides.
 *
 * Run manually:
 *   npx tsx agents/eishi-base-runner.ts --max-triples=10 --concurrency=3
 *
 * Cron: every 15 min via /root/monitor/ftg-eishi-base.sh
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateProductionMethods } from './content-shikamaru'
import { generateBusinessPlans } from './content-itachi'
import { generatePotentialClients } from './content-hancock'
import { toIso2 } from '../lib/iso3-to-iso2'

loadEnv()

type CliArgs = { maxTriples: number; concurrency: number; lang: string }
function parseArgs(): CliArgs {
  const out: CliArgs = { maxTriples: 10, concurrency: 3, lang: 'fr' }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-triples' && v) out.maxTriples = Number(v)
    if (k === 'concurrency' && v) out.concurrency = Number(v)
    if (k === 'lang' && v) out.lang = v
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Synthetic opp context built from the representative opp for a pair.
// We pick the largest-gap opp so the base leans on the most commercially
// relevant market angle; per-opp personalization (layer 2) adjusts later.
async function buildSyntheticOpp(sb: any, productId: string, countryIso: string) {
  const { data: opp } = await sb
    .from('opportunities')
    .select('product_id, country_iso, gap_value_usd, avg_import_price_usd_tonne, land_availability, labor_cost_index, opportunity_score, product_name')
    .eq('product_id', productId)
    .eq('country_iso', countryIso)
    .order('gap_value_usd', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!opp) return null

  const iso2 = toIso2(countryIso)
  const [{ data: p }, { data: c }] = await Promise.all([
    sb.from('products').select('name, name_fr').eq('id', productId).maybeSingle(),
    iso2
      ? sb.from('countries').select('name, name_fr').eq('iso2', iso2).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    opp: { ...opp, country_iso2: iso2 },
    productName: (p?.name_fr || p?.name || productId) as string,
    countryName: (c?.name_fr || c?.name || countryIso) as string,
  }
}

const AGENT_TIMEOUT_MS = 150_000
const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timeout ${AGENT_TIMEOUT_MS / 1000}s`)), AGENT_TIMEOUT_MS))])

async function runTriple(sb: any, triple: { product_id: string; country_iso: string; lang: string }, tag: string, globalQuotaHit: { hit: boolean }) {
  if (globalQuotaHit.hit) return
  const { product_id, country_iso, lang } = triple

  await sb.from('ftg_product_country_content').upsert({
    product_id, country_iso, lang,
    status: 'generating', attempt_count: 1,
  }, { onConflict: 'product_id,country_iso,lang' })

  try {
    const ctx = await buildSyntheticOpp(sb, product_id, country_iso)
    if (!ctx) throw new Error(`no representative opp for ${product_id}/${country_iso}`)
    console.log(`━━━ ${tag} · ${ctx.productName} × ${ctx.countryName} ━━━`)

    const start = Date.now()

    // Run 3 agents in parallel. Each has its own timeout + error isolation
    // so one failing agent doesn't kill the whole triple.
    const results = await Promise.allSettled([
      withTimeout(generateProductionMethods(ctx.opp, ctx.productName, ctx.countryName, lang), 'shikamaru'),
      withTimeout(generateBusinessPlans(ctx.opp, ctx.productName, ctx.countryName, lang), 'itachi'),
      withTimeout(generatePotentialClients(ctx.opp, ctx.productName, ctx.countryName, lang), 'hancock'),
    ])

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    const keys = ['production_methods', 'business_plans', 'potential_clients'] as const
    const update: Record<string, unknown> = {}
    let totalCost = 0
    const errs: string[] = []
    let hitQuota = false

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        update[keys[i]] = r.value.payload
        totalCost += r.value.cost_eur
      } else {
        const msg = (r.reason as Error)?.message ?? String(r.reason)
        errs.push(`${keys[i]}: ${msg.slice(0, 120)}`)
        if (/429|quota|resource.?exhausted|rate.?limit|all providers exhausted/i.test(msg)) hitQuota = true
      }
    })

    const allOk = errs.length === 0
    await sb.from('ftg_product_country_content').update({
      ...update,
      status: allOk ? 'ready' : (Object.keys(update).length > 0 ? 'ready' : 'failed'),  // partial-fill still counts
      generated_at: new Date().toISOString(),
      cost_eur: totalCost,
      last_error: errs.length ? errs.join(' | ').slice(0, 1000) : null,
      agent_versions: {
        shikamaru: results[0].status === 'fulfilled' ? new Date().toISOString() : null,
        itachi: results[1].status === 'fulfilled' ? new Date().toISOString() : null,
        hancock: results[2].status === 'fulfilled' ? new Date().toISOString() : null,
      },
    }).eq('product_id', product_id).eq('country_iso', country_iso).eq('lang', lang)

    console.log(allOk
      ? `✓ ${tag} (${elapsed}s, €${totalCost.toFixed(3)})`
      : `${Object.keys(update).length > 0 ? '⚠' : '✗'} ${tag} partial=${Object.keys(update).length}/3 (${elapsed}s) errs=${errs.length}`)

    if (hitQuota) globalQuotaHit.hit = true
  } catch (e: any) {
    const msg = e?.message || String(e)
    console.error(`✗ ${tag}: ${msg.slice(0, 200)}`)
    await sb.from('ftg_product_country_content').update({
      status: 'failed', last_error: msg.slice(0, 1000),
    }).eq('product_id', product_id).eq('country_iso', country_iso).eq('lang', lang)
  }
}

async function pool<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
}

async function main() {
  const { maxTriples, concurrency, lang } = parseArgs()
  const sb = db()
  console.log(`▶ eishi-base-runner: maxTriples=${maxTriples} concurrency=${concurrency} lang=${lang}`)

  const { data: triples, error } = await sb.rpc('ftg_missing_product_country_content', {
    limit_count: maxTriples, lang_filter: lang,
  })
  if (error) { console.error('rpc error:', error.message); process.exit(1) }
  if (!triples?.length) { console.log('— no missing triples, nothing to do'); return }

  console.log(`→ ${triples.length} triples to process (x${concurrency} in parallel)`)
  const globalQuotaHit = { hit: false }

  await pool(triples, concurrency, (triple, idx) => {
    const tag = `[${idx + 1}/${triples.length}] ${triple.product_id} × ${triple.country_iso} · ${triple.lang}`
    return runTriple(sb, triple, tag, globalQuotaHit)
  })

  const { count: readyRows } = await sb
    .from('ftg_product_country_content').select('*', { count: 'exact', head: true }).eq('status', 'ready')
  console.log(`\n→ base cache ready rows total = ${readyRows}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
