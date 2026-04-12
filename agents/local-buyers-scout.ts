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

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
}))

const COUNTRY = String(args.country ?? '').toUpperCase()
const PRODUCT = String(args.product ?? '').toLowerCase()
const MAX = Number(args.max ?? 20)
const APPLY = args.apply === 'true'
const TYPES = (args.types ? String(args.types).split(',') : Object.keys(BUYER_QUERIES))

if (!COUNTRY || !PRODUCT) {
  console.error('usage: tsx local-buyers-scout.ts --country=CI --product=cajou [--max=20] [--apply] [--types=industriel,grossiste]')
  process.exit(1)
}

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
  type: string, query: string, results: any[], country: string,
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
      product_slugs: [PRODUCT],
      source: 'serper:' + query.slice(0, 40),
      confidence_score: 0.35,  // unverified by default
      notes: r.snippet?.slice(0, 200),
    })
  }
  return out
}

;(async () => {
  console.log(`[local-buyers-scout] country=${COUNTRY} product=${PRODUCT} max=${MAX} apply=${APPLY} types=${TYPES.join(',')}`)
  const countryName = await countryNameFromIso(COUNTRY)
  const candidates: BuyerCandidate[] = []

  for (const type of TYPES) {
    for (const template of (BUYER_QUERIES[type] ?? [])) {
      const q = template.replace('{product}', PRODUCT).replace('{country}', countryName)
      const results = await searchSerper(q)
      const c = await extractBuyersFromResults(type, q, results, COUNTRY)
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
  }).slice(0, MAX)

  console.log(`found: ${unique.length} unique candidates`)
  for (const c of unique.slice(0, 20)) console.log(`  · ${c.buyer_type.padEnd(14)} ${c.name.slice(0, 60)}  (${c.website_url?.slice(0, 40) ?? '-'})`)

  if (!APPLY) { console.log('\n(dry-run — pass --apply to insert)'); return }

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
      await db.from('local_buyers').insert(c)
    }
  }
  const { count } = await db.from('local_buyers').select('id', { count: 'exact', head: true }).eq('country_iso', COUNTRY).contains('product_slugs', [PRODUCT])
  console.log(`\n✓ DB: ${count} buyers in ${COUNTRY} for ${PRODUCT}`)
})().catch(e => { console.error(e); process.exit(1) })
