/**
 * entrepreneurs-scout — découvre SME / entrepreneurs sérieux actifs dans un
 * secteur × pays, idéaux pour matching avec les opportunités FTG.
 *
 * Usage: npx tsx agents/entrepreneurs-scout.ts --country=CI --sector=agriculture --product=cajou [--max=30] [--apply]
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const COUNTRY = String(args.country ?? '').toUpperCase()
const SECTOR = String(args.sector ?? '').toLowerCase()
const PRODUCT = String(args.product ?? '').toLowerCase()
const MAX = Number(args.max ?? 30)
const APPLY = args.apply === 'true'
if (!COUNTRY || !SECTOR) { console.error('usage: tsx entrepreneurs-scout.ts --country=CI --sector=agriculture [--product=cajou] [--max=30] [--apply]'); process.exit(1) }

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
  'PME {sector} {country}',
  'entreprise {sector} {country} linkedin',
  'entrepreneur {sector} {product} {country}',
  'startup {sector} {country}',
  'SME {sector} {country}',
  'coopérative {sector} {country}',
  'transformation {product} {country} usine',
]

;(async () => {
  console.log(`[entrepreneurs-scout] ${COUNTRY} · sector=${SECTOR} · product=${PRODUCT || '*'} · max=${MAX} · apply=${APPLY}`)
  const results: any[] = []
  for (const tmpl of QUERIES) {
    const q = tmpl.replace('{sector}', SECTOR).replace('{product}', PRODUCT || SECTOR).replace('{country}', COUNTRY)
    results.push(...(await searchSerper(q)).map(r => ({ ...r, query: q })))
    if (results.length >= MAX * 2) break
  }
  const seen = new Set<string>()
  const unique = results.map(r => {
    const name = (r.title as string)?.split(/[|·–—-]/)[0]?.trim() ?? ''
    const domain = (() => { try { return new URL(r.link).hostname } catch { return '' } })()
    if (!name || /news|wikipedia|youtube|medium|crunchbase|pitchbook/.test(domain)) return null
    return { name, website_url: r.link, snippet: r.snippet, query: r.query, isLinkedIn: /linkedin/.test(domain) }
  }).filter(Boolean).filter((r: any) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, MAX) as any[]

  console.log(`found ${unique.length}`)
  for (const c of unique.slice(0, 20)) console.log(`  · ${c.name.slice(0, 60)}  ${c.website_url.slice(0, 40)}`)

  if (!APPLY) { console.log('\n(dry-run)'); return }

  for (const c of unique) {
    const row = {
      name: c.name, business_name: c.name, country_iso: COUNTRY,
      sector: SECTOR, product_slugs: PRODUCT ? [PRODUCT] : [],
      website_url: c.isLinkedIn ? undefined : c.website_url,
      linkedin_url: c.isLinkedIn ? c.website_url : undefined,
      confidence_score: 0.25,
      source: 'serper:' + (c.query as string).slice(0, 40),
      notes: c.snippet?.slice(0, 240),
    }
    const { data: existing } = await db.from('entrepreneurs_directory').select('id, product_slugs').eq('country_iso', COUNTRY).ilike('name', c.name).maybeSingle()
    if (existing) {
      const slugs = Array.from(new Set([...(existing as any).product_slugs ?? [], ...(PRODUCT ? [PRODUCT] : [])]))
      await db.from('entrepreneurs_directory').update({ product_slugs: slugs, website_url: row.website_url, linkedin_url: row.linkedin_url, notes: row.notes }).eq('id', (existing as any).id)
    } else await db.from('entrepreneurs_directory').insert(row)
  }
  const { count } = await db.from('entrepreneurs_directory').select('id', { count: 'exact', head: true }).eq('country_iso', COUNTRY).eq('sector', SECTOR)
  console.log(`\n✓ DB: ${count} entrepreneurs in ${COUNTRY} / ${SECTOR}`)
})().catch(e => { console.error(e); process.exit(1) })
