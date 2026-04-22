/**
 * exporters-scout — découvre les exportateurs d'une denrée depuis un pays.
 * Usage: npx tsx agents/exporters-scout.ts --country=CI --product=cajou --max=30 [--apply]
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()
import { parseShardArgs, belongsToShard } from './lib/shard'
const args = Object.fromEntries(process.argv.slice(2).filter(a => !/^--shards?=/.test(a)).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const COUNTRY_ARG = String(args.country ?? '').toUpperCase()
const PRODUCT_ARG = String(args.product ?? '').toLowerCase()
const { shard: SHARD, shards: SHARDS } = parseShardArgs()
const MAX_GLOBAL = Number(args.max ?? 30)
const MAX = Math.max(1, Math.ceil(MAX_GLOBAL / SHARDS))
const APPLY = args.apply === 'true' || (SHARDS > 1 && args.apply !== 'false')

// Blanket mode when no --country/--product: iterate canonical combos, sharded.
const DEFAULT_COUNTRIES = ['CI', 'SN', 'MA', 'KE', 'NG', 'GH', 'ET', 'CM', 'TN', 'DZ']
const DEFAULT_PRODUCTS = ['cajou', 'cacao', 'café', 'coton', 'karité', 'hibiscus', 'sésame', 'mangue', 'ananas', 'huile_palme']
const COMBOS: Array<{ country: string; product: string }> = (COUNTRY_ARG && PRODUCT_ARG)
  ? [{ country: COUNTRY_ARG, product: PRODUCT_ARG }]
  : DEFAULT_COUNTRIES.flatMap(c => DEFAULT_PRODUCTS.map(p => ({ country: c, product: p })))
      .filter((_, i) => i % SHARDS === SHARD)

console.log(`[exporters-scout] shard=${SHARD}/${SHARDS} combos=${COMBOS.length} max=${MAX} apply=${APPLY}`)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function searchSerper(q: string): Promise<any[]> {
  const keys = [process.env.SERPER_API_KEY, process.env.SERPER_API_KEY_2, process.env.SERPER_API_KEY_3].filter(Boolean)
  if (!keys.length) return []
  for (const k of keys) {
    try {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST', headers: { 'X-API-KEY': k!, 'content-type': 'application/json' },
        body: JSON.stringify({ q, num: 10 }), signal: AbortSignal.timeout(8000),
      })
      if (r.ok) return (await r.json() as any).organic ?? []
    } catch {}
  }
  return []
}

const QUERIES = [
  'exportateur {product} {country}',
  'exporter {product} {country}',
  'société export {product} {country}',
  'négociant international {product} {country}',
  'fournisseur export {product} {country}',
]

;(async () => {
  let totalSeen = 0
  let totalInserted = 0
  for (const { country, product } of COMBOS) {
    console.log(`\n── ${country} · ${product} ──`)
    const results: any[] = []
    for (const tmpl of QUERIES) {
      const q = tmpl.replace('{product}', product).replace('{country}', country)
      results.push(...(await searchSerper(q)).map(r => ({ ...r, query: q })))
      if (results.length >= MAX * 2) break
    }
    const seen = new Set<string>()
    const unique = results.map(r => {
      const name = (r.title as string)?.split(/[|·–—-]/)[0]?.trim() ?? ''
      const domain = (() => { try { return new URL(r.link).hostname } catch { return '' } })()
      if (!name || /news|medium|wiki|youtube|facebook|linkedin\.com\/pulse/.test(domain)) return null
      return { name, website_url: r.link, snippet: r.snippet, query: r.query }
    }).filter(Boolean).filter((r: any) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).filter((r: any) => belongsToShard(r.name, SHARD, SHARDS)).slice(0, MAX) as any[]

    totalSeen += unique.length
    console.log(`  found ${unique.length}`)
    for (const c of unique.slice(0, 10)) console.log(`    · ${c.name.slice(0, 60)}  ${c.website_url.slice(0, 40)}`)

    if (!APPLY) continue

    for (const c of unique) {
      const row = {
        name: c.name, country_iso: country, website_url: c.website_url,
        product_slugs: [product], destinations: [], confidence_score: 0.3,
        source: 'serper:' + (c.query as string).slice(0, 40), notes: c.snippet?.slice(0, 240),
      }
      const { data: existing } = await db.from('exporters_directory').select('id, product_slugs').eq('country_iso', country).ilike('name', c.name).maybeSingle()
      if (existing) {
        const slugs = Array.from(new Set([...(existing as any).product_slugs ?? [], product]))
        await db.from('exporters_directory').update({ product_slugs: slugs, website_url: c.website_url, notes: c.snippet?.slice(0, 240) }).eq('id', (existing as any).id)
      } else { await db.from('exporters_directory').insert(row); totalInserted++ }
    }
  }
  console.log(`\n=== exporters-scout DONE ===`)
  console.log(`combos=${COMBOS.length} unique=${totalSeen} inserted=${totalInserted} apply=${APPLY}`)
  if (!APPLY) console.log('(dry-run — pass --apply to insert)')
})().catch(e => { console.error('exporters-scout FATAL:', e); process.exit(1) })
