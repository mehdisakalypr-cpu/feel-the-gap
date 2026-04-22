/**
 * local-buyers-scout — découvre les acheteurs locaux (industriels, grossistes,
 * centrales d'achats, transformateurs, horeca) pour une denrée × pays.
 *
 * Objectif : alimenter le parcours "route vers le succès" FTG avec des
 * débouchés réels en local + zones d'export proches. L'entrepreneur doit
 * pouvoir dire "OK je produis 50T de noix de cajou en CI → voici 12 acheteurs
 * locaux vérifiés qui achètent cette denrée".
 *
 * Sources :
 *   - Google Custom Search (keywords métier + pays)
 *   - LinkedIn companies (via SerpAPI ou Serper)
 *   - Panjiva / ImportGenius (si clés)
 *   - Scraping sites pro locaux (annuaires CCI, fédérations)
 *   - LLM research (cascade : Gemini web-search, Perplexity)
 *
 * Usage :
 *   npx tsx agents/local-buyers-scout.ts --country=CI --product=cajou
 *   npx tsx agents/local-buyers-scout.ts --country=SN --product=arachide --max=30
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()

const BUYER_QUERIES: Record<string, string[]> = {
  industriel: ['usine {product} {country}', 'transformation {product} {country}', 'industriel {product} {country}'],
  grossiste: ['grossiste {product} {country}', 'wholesaler {product} {country}', 'acheteur gros {product} {country}'],
  centrale_achats: ['centrale d\'achats {product} {country}', 'procurement {product} {country}'],
  transformateur: ['transformateur {product} {country}', 'processor {product} {country}'],
  distributeur: ['distributeur {product} {country}', 'importateur local {product} {country}'],
  horeca: ['hôtels restaurants {product} {country}', 'horeca {product} {country}'],
  export_trader: ['trader {product} export {country}', 'négociant {product} {country}'],
}

type BuyerCandidate = {
  name: string
  buyer_type: string
  country_iso: string
  city?: string
  website_url?: string
  email?: string
  phone?: string
  product_slugs: string[]
  source: string
  confidence_score: number
  notes?: string
}

import { parseShardArgs, belongsToShard } from './lib/shard'
const args = Object.fromEntries(process.argv.slice(2).filter(a => !/^--shards?=/.test(a)).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
}))

const COUNTRY_ARG = String(args.country ?? '').toUpperCase()
const PRODUCT_ARG = String(args.product ?? '').toLowerCase()
const { shard: SHARD, shards: SHARDS } = parseShardArgs()
const MAX_GLOBAL = Number(args.max ?? 20)
const MAX = Math.max(1, Math.ceil(MAX_GLOBAL / SHARDS))
const APPLY = args.apply === 'true' || (SHARDS > 1 && args.apply !== 'false')
const ALL_TYPES = (args.types ? String(args.types).split(',') : Object.keys(BUYER_QUERIES))
const TYPES = (SHARDS > 1 ? ALL_TYPES.filter((_, i) => i % SHARDS === SHARD) : ALL_TYPES)

// Blanket mode when no --country/--product: iterate canonical combos, sharded.
const DEFAULT_COUNTRIES = ['CI', 'SN', 'MA', 'KE', 'NG', 'GH', 'ET', 'CM', 'TN', 'DZ']
const DEFAULT_PRODUCTS = ['cajou', 'cacao', 'café', 'coton', 'karité', 'hibiscus', 'sésame', 'mangue', 'ananas', 'huile_palme']
const COMBOS: Array<{ country: string; product: string }> = (COUNTRY_ARG && PRODUCT_ARG)
  ? [{ country: COUNTRY_ARG, product: PRODUCT_ARG }]
  : DEFAULT_COUNTRIES.flatMap(c => DEFAULT_PRODUCTS.map(p => ({ country: c, product: p })))
      .filter((_, i) => i % SHARDS === SHARD)

console.log(`[local-buyers-scout] shard=${SHARD}/${SHARDS} combos=${COMBOS.length} types=${TYPES.length}/${ALL_TYPES.length} max=${MAX} apply=${APPLY}`)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function countryNameFromIso(iso: string): Promise<string> {
  // Lightweight mapping; in production we'd look at country_studies
  const map: Record<string, string> = {
    CI: 'Côte d\'Ivoire', SN: 'Sénégal', NG: 'Nigeria', KE: 'Kenya', GH: 'Ghana',
    BF: 'Burkina Faso', ML: 'Mali', CM: 'Cameroun', CD: 'RDC', ET: 'Éthiopie',
    TZ: 'Tanzanie', UG: 'Ouganda', MA: 'Maroc', DZ: 'Algérie', EG: 'Égypte',
    IN: 'Inde', VN: 'Vietnam', BR: 'Brésil', MX: 'Mexique', ID: 'Indonésie',
  }
  return map[iso] ?? iso
}

async function searchSerper(query: string): Promise<any[]> {
  const keys = [process.env.SERPER_API_KEY, process.env.SERPER_API_KEY_2, process.env.SERPER_API_KEY_3].filter(Boolean)
  if (!keys.length) return []
  for (const k of keys) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': k!, 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, num: 10 }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) { const j: any = await res.json(); return j.organic ?? [] }
    } catch {}
  }
  return []
}

async function extractBuyersFromResults(
  type: string, query: string, results: any[], country: string, product: string,
): Promise<BuyerCandidate[]> {
  const out: BuyerCandidate[] = []
  for (const r of results.slice(0, 6)) {
    const name = (r.title as string)?.split(/[|·-]/)[0]?.trim()
    if (!name || name.length < 4) continue
    const domain = (() => {
      try { return new URL(r.link).hostname } catch { return undefined }
    })()
    // Crude quality gate: skip news / directories if possible
    if (/news|wiki|blog|medium|youtube|facebook|twitter|linkedin/.test(domain ?? '')) continue
    out.push({
      name,
      buyer_type: type,
      country_iso: country,
      website_url: r.link,
      product_slugs: [product],
      source: 'serper:' + query.slice(0, 40),
      confidence_score: 0.35,  // unverified by default
      notes: r.snippet?.slice(0, 200),
    })
  }
  return out
}

;(async () => {
  let totalSeen = 0
  let totalInserted = 0
  for (const { country, product } of COMBOS) {
    console.log(`\n── country=${country} product=${product} ──`)
    const countryName = await countryNameFromIso(country)
    const candidates: BuyerCandidate[] = []

    for (const type of TYPES) {
      for (const template of (BUYER_QUERIES[type] ?? [])) {
        const q = template.replace('{product}', product).replace('{country}', countryName)
        const results = await searchSerper(q)
        const c = await extractBuyersFromResults(type, q, results, country, product)
        candidates.push(...c)
        if (candidates.length >= MAX) break
      }
      if (candidates.length >= MAX) break
    }

    // Dedup by name + country
    const seen = new Set<string>()
    const unique = candidates.filter(c => {
      const k = `${c.country_iso}|${c.name.toLowerCase()}`
      if (seen.has(k)) return false; seen.add(k); return true
    }).filter((r: any) => belongsToShard(r.name, SHARD, SHARDS)).slice(0, MAX)

    totalSeen += unique.length
    console.log(`  found: ${unique.length} unique candidates`)
    for (const c of unique.slice(0, 10)) console.log(`    · ${c.buyer_type.padEnd(14)} ${c.name.slice(0, 60)}  (${c.website_url?.slice(0, 40) ?? '-'})`)

    if (!APPLY) continue

    // Upsert by (country, name)
    for (const c of unique) {
      const { data: existing } = await db.from('local_buyers')
        .select('id, product_slugs, source')
        .eq('country_iso', c.country_iso)
        .ilike('name', c.name)
        .maybeSingle()
      if (existing) {
        const slugs = Array.from(new Set([...(existing as any).product_slugs ?? [], ...c.product_slugs]))
        await db.from('local_buyers').update({ product_slugs: slugs, website_url: c.website_url, notes: c.notes }).eq('id', (existing as any).id)
      } else {
        await db.from('local_buyers').insert(c); totalInserted++
      }
    }
  }
  console.log(`\n=== local-buyers-scout DONE ===`)
  console.log(`combos=${COMBOS.length} unique=${totalSeen} inserted=${totalInserted} apply=${APPLY}`)
  if (!APPLY) console.log('(dry-run — pass --apply to insert)')
})().catch(e => { console.error('local-buyers-scout FATAL:', e); process.exit(1) })
