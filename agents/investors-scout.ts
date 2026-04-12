/**
 * investors-scout — découvre business angels, VC, PE, family offices, DFIs,
 * impact funds, crowdfunding et agences grant intéressés par un secteur × région.
 *
 * Alimenté par Serper + LLM (llm-router cascade) pour l'extraction
 * d'investisseurs depuis articles/listings/sites spécialisés.
 *
 * Usage :
 *   npx tsx agents/investors-scout.ts --sector=agriculture --region=africa-west --max=30
 *   npx tsx agents/investors-scout.ts --sector=food_processing --region=CI --types=vc_fund,dfi --apply
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()

type InvestorType = 'business_angel'|'vc_fund'|'pe_fund'|'family_office'|'dfi'|'impact_fund'|'crowdfunding'|'grant_agency'

const TYPE_QUERIES: Record<InvestorType, string[]> = {
  business_angel: ['business angels {sector} {region}', 'angel investors {sector} {region}', 'super angels {sector} {region}'],
  vc_fund: ['venture capital {sector} {region}', 'VC fund list {sector} {region} 2025 2026', 'top VCs {sector} {region}'],
  pe_fund: ['private equity {sector} {region}', 'growth equity fund {sector} {region}'],
  family_office: ['family office {sector} {region}', 'private investor family {sector} {region}'],
  dfi: ['development finance institution {sector} {region}', 'DFI {region}', 'Proparco FMO AfDB BOAD {sector} {region}'],
  impact_fund: ['impact investor {sector} {region}', 'impact fund Africa {sector}', 'blended finance {sector} {region}'],
  crowdfunding: ['crowdfunding platform {sector} {region}', 'equity crowdfunding {region}'],
  grant_agency: ['grant agency {sector} {region}', 'subventions {sector} {region}', 'donor agriculture {region}', 'USAID DFID AFD GIZ {sector} {region}'],
}

type Candidate = {
  name: string
  investor_type: InvestorType
  website_url?: string
  firm_name?: string
  linkedin_url?: string
  sectors_of_interest: string[]
  regions_of_interest: string[]
  source: string
  confidence_score: number
  notes?: string
}

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const SECTOR = String(args.sector ?? '')
const REGION = String(args.region ?? '')
const TYPES = (args.types ? String(args.types).split(',') : Object.keys(TYPE_QUERIES)) as InvestorType[]
const MAX = Number(args.max ?? 30)
const APPLY = args.apply === 'true'

if (!SECTOR || !REGION) {
  console.error('usage: tsx investors-scout.ts --sector=agriculture --region=africa-west [--types=vc_fund,dfi] [--max=30] [--apply]')
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function searchSerper(query: string): Promise<any[]> {
  const keys = [process.env.SERPER_API_KEY, process.env.SERPER_API_KEY_2, process.env.SERPER_API_KEY_3].filter(Boolean)
  if (!keys.length) return []
  for (const k of keys) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST', headers: { 'X-API-KEY': k!, 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, num: 10 }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) return (await res.json() as any).organic ?? []
    } catch {}
  }
  return []
}

async function extractFromResults(type: InvestorType, query: string, results: any[]): Promise<Candidate[]> {
  const out: Candidate[] = []
  for (const r of results.slice(0, 8)) {
    const name = (r.title as string)?.split(/[|·–—-]/)[0]?.trim()
    if (!name || name.length < 3 || name.length > 120) continue
    const domain = (() => { try { return new URL(r.link).hostname } catch { return '' } })()
    // Skip news/social aggregators — those describe investors but aren't the investor itself
    if (/news|medium|blog|youtube|facebook|twitter|reddit|wikipedia|pitchbook|crunchbase/.test(domain)) continue
    out.push({
      name, investor_type: type,
      website_url: r.link,
      sectors_of_interest: [SECTOR],
      regions_of_interest: [REGION],
      source: 'serper:' + query.slice(0, 40),
      confidence_score: 0.3,
      notes: (r.snippet as string | undefined)?.slice(0, 240),
    })
  }
  return out
}

;(async () => {
  console.log(`[investors-scout] sector=${SECTOR} region=${REGION} types=${TYPES.join(',')} max=${MAX} apply=${APPLY}`)
  const candidates: Candidate[] = []
  for (const type of TYPES) {
    for (const tmpl of (TYPE_QUERIES[type] ?? [])) {
      const q = tmpl.replace('{sector}', SECTOR).replace('{region}', REGION)
      const r = await searchSerper(q)
      candidates.push(...await extractFromResults(type, q, r))
      if (candidates.length >= MAX) break
    }
    if (candidates.length >= MAX) break
  }

  const seen = new Set<string>()
  const unique = candidates.filter(c => {
    const k = c.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(k)) return false; seen.add(k); return true
  }).slice(0, MAX)

  console.log(`found ${unique.length} unique candidates`)
  for (const c of unique.slice(0, 20)) console.log(`  · ${c.investor_type.padEnd(14)} ${c.name.slice(0, 60)}  ${c.website_url?.slice(0, 40) ?? ''}`)

  if (!APPLY) { console.log('\n(dry-run — pass --apply to insert)'); return }

  for (const c of unique) {
    const { data: existing } = await db.from('investors_directory').select('id, sectors_of_interest, regions_of_interest').ilike('name', c.name).maybeSingle()
    if (existing) {
      const sec = Array.from(new Set([...(existing as any).sectors_of_interest ?? [], ...c.sectors_of_interest]))
      const reg = Array.from(new Set([...(existing as any).regions_of_interest ?? [], ...c.regions_of_interest]))
      await db.from('investors_directory').update({ sectors_of_interest: sec, regions_of_interest: reg, website_url: c.website_url, notes: c.notes }).eq('id', (existing as any).id)
    } else {
      await db.from('investors_directory').insert(c)
    }
  }
  const { count } = await db.from('investors_directory').select('id', { count: 'exact', head: true }).contains('sectors_of_interest', [SECTOR])
  console.log(`\n✓ DB: ${count} investors tagged with sector=${SECTOR}`)
})().catch(e => { console.error(e); process.exit(1) })
