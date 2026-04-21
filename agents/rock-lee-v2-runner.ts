// @ts-nocheck
/**
 * rock-lee-v2-runner — batch generator for ftg_product_country_videos.
 *
 * Pulls missing (product_id, country_iso) pairs via RPC ftg_missing_product_country_pairs,
 * runs Rock Lee v2 on each, writes payload to cache table.
 *
 * Run manually:
 *   npx tsx agents/rock-lee-v2-runner.ts --max-pairs=20
 *
 * Via VPS cron: invoked every 10 min, capped at 20 pairs = ~18k units YouTube (fits 1 project quota).
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateProductCountryVideos } from './content-rock-lee-v2'
import { toIso2 } from '../lib/iso3-to-iso2'

loadEnv()

type CliArgs = { maxPairs: number; concurrency: number }
function parseArgs(): CliArgs {
  const out: CliArgs = { maxPairs: 20, concurrency: 5 }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-pairs' && v) out.maxPairs = Number(v)
    if (k === 'concurrency' && v) out.concurrency = Number(v)
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function resolveNames(sb: any, productId: string, countryIso: string) {
  const iso2 = toIso2(countryIso)  // undefined if unmapped — skips regionCode
  const [{ data: p }, { data: c }] = await Promise.all([
    sb.from('products').select('name, name_fr').eq('id', productId).maybeSingle(),
    iso2
      ? sb.from('countries').select('name, name_fr').eq('iso2', iso2).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    productName: p?.name_fr || p?.name || productId,
    countryName: c?.name_fr || c?.name || countryIso,
    iso2,
  }
}

async function processPair(sb: any, pair: { product_id: string; country_iso: string }, tag: string, globalQuotaHit: { hit: boolean }) {
  const { product_id, country_iso } = pair
  if (globalQuotaHit.hit) return  // short-circuit when another worker has stopped the batch

  await sb.from('ftg_product_country_videos').upsert({
    product_id, country_iso, status: 'generating', attempt_count: 1,
  }, { onConflict: 'product_id,country_iso' })

  try {
    const { productName, countryName, iso2 } = await resolveNames(sb, product_id, country_iso)
    console.log(`━━━ ${tag} · ${productName} × ${countryName} ━━━`)

    const start = Date.now()
    const { payload, cost_eur } = await generateProductCountryVideos(productName, countryName, iso2)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const videosCount = (payload as any)?.videos?.length ?? 0
    await sb.from('ftg_product_country_videos').update({
      payload,
      status: videosCount > 0 ? 'ready' : 'failed',
      generated_at: new Date().toISOString(),
      cost_eur,
      last_error: videosCount === 0 ? 'no videos found (quota exhausted?)' : null,
    }).eq('product_id', product_id).eq('country_iso', country_iso)

    console.log(`✓ ${tag} ${videosCount} videos (${elapsed}s)`)
  } catch (e: any) {
    const msg = e?.message || String(e)
    console.error(`✗ ${tag}: ${msg.slice(0, 200)}`)
    await sb.from('ftg_product_country_videos').update({
      status: 'failed', last_error: msg.slice(0, 1000),
    }).eq('product_id', product_id).eq('country_iso', country_iso)

    if (/all keys exhausted|quota/i.test(msg)) {
      console.warn('[runner] global quota exhausted, halting remaining workers')
      globalQuotaHit.hit = true
    }
  }
}

// Lightweight concurrency pool (avoids adding p-limit as a dep)
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
  const { maxPairs, concurrency } = parseArgs()
  const sb = db()
  console.log(`▶ rock-lee-v2-runner: maxPairs=${maxPairs} concurrency=${concurrency}`)

  const { data: pairs, error } = await sb.rpc('ftg_missing_product_country_pairs', { limit_count: maxPairs })
  if (error) { console.error('rpc error:', error.message); process.exit(1) }
  if (!pairs?.length) { console.log('— no missing pairs, nothing to do'); return }

  console.log(`→ ${pairs.length} pairs to process (x${concurrency} in parallel)`)
  const globalQuotaHit = { hit: false }

  await pool(pairs, concurrency, (pair, idx) => {
    const tag = `[${idx + 1}/${pairs.length}] ${pair.product_id} × ${pair.country_iso}`
    return processPair(sb, pair, tag, globalQuotaHit)
  })

  const { count: readyRows } = await sb
    .from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).eq('status', 'ready')
  console.log(`\n→ cache ready rows total = ${readyRows}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
