/**
 * exporters-scout — découvre les exportateurs d'une denrée depuis un pays.
 * Usage: npx tsx agents/exporters-scout.ts --country=CI --product=cajou --max=30 [--apply]
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const COUNTRY = String(args.country ?? '').toUpperCase()
const PRODUCT = String(args.product ?? '').toLowerCase()
const MAX = Number(args.max ?? 30)
const APPLY = args.apply === 'true'
if (!COUNTRY || !PRODUCT) { console.error('usage: tsx exporters-scout.ts --country=CI --product=cajou [--max=30] [--apply]'); process.exit(1) }

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
  console.log(`[exporters-scout] ${COUNTRY} · ${PRODUCT} · max=${MAX} · apply=${APPLY}`)
  const results: any[] = []
  for (const tmpl of QUERIES) {
    const q = tmpl.replace('{product}', PRODUCT).replace('{country}', COUNTRY)
    results.push(...(await searchSerper(q)).map(r => ({ ...r, query: q })))
    if (results.length >= MAX * 2) break
  }
  const seen = new Set<string>()
  const unique = results.map(r => {
    const name = (r.title as string)?.split(/[|·–—-]/)[0]?.trim() ?? ''
    const domain = (() => { try { return new URL(r.link).hostname } catch { return '' } })()
    if (!name || /news|medium|wiki|youtube|facebook|linkedin\.com\/pulse/.test(domain)) return null
    return { name, website_url: r.link, snippet: r.snippet, query: r.query }
  }).filter(Boolean).filter((r: any) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, MAX) as any[]

  console.log(`found ${unique.length}`)
  for (const c of unique.slice(0, 20)) console.log(`  · ${c.name.slice(0, 60)}  ${c.website_url.slice(0, 40)}`)

  if (!APPLY) { console.log('\n(dry-run)'); return }

  for (const c of unique) {
    const row = {
      name: c.name, country_iso: COUNTRY, website_url: c.website_url,
      product_slugs: [PRODUCT], destinations: [], confidence_score: 0.3,
      source: 'serper:' + (c.query as string).slice(0, 40), notes: c.snippet?.slice(0, 240),
    }
    const { data: existing } = await db.from('exporters_directory').select('id, product_slugs').eq('country_iso', COUNTRY).ilike('name', c.name).maybeSingle()
    if (existing) {
      const slugs = Array.from(new Set([...(existing as any).product_slugs ?? [], PRODUCT]))
      await db.from('exporters_directory').update({ product_slugs: slugs, website_url: c.website_url, notes: c.snippet?.slice(0, 240) }).eq('id', (existing as any).id)
    } else await db.from('exporters_directory').insert(row)
  }
  const { count } = await db.from('exporters_directory').select('id', { count: 'exact', head: true }).eq('country_iso', COUNTRY).contains('product_slugs', [PRODUCT])
  console.log(`\n✓ DB: ${count} exporters in ${COUNTRY} for ${PRODUCT}`)
})().catch(e => { console.error(e); process.exit(1) })
