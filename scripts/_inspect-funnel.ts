import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const vault = createClient(URL, KEY, { auth: { persistSession: false }, db: { schema: 'gapup_leads' } }) as any
const pub = createClient(URL, KEY, { auth: { persistSession: false } })

async function count(table: any, build: (q: any) => any = (q: any) => q): Promise<number | null> {
  const { count } = await build(table.select('*', { count: 'exact', head: true }))
  return count
}

async function main() {
  console.log('=== LEAD VAULT FUNNEL — état réel', new Date().toISOString(), '===\n')

  const c_total = await count(vault.from('lv_companies'))
  console.log('lv_companies total:', c_total?.toLocaleString())

  // Distribution country top 15
  const { data: ccDist } = await vault.from('lv_companies').select('country_iso').limit(50000)
  const dist: Record<string, number> = {}
  for (const r of ccDist ?? []) {
    const k = r.country_iso ?? 'NULL'; dist[k] = (dist[k] ?? 0) + 1
  }
  // Better: use exact counts per country (top expected)
  const topIso = ['FRA','GBR','DEU','ESP','ITA','NLD','BEL','POL','USA','SWE','NOR','FIN','CZE','EST']
  for (const iso of topIso) {
    const c = await count(vault.from('lv_companies'), (q: any) => q.eq('country_iso', iso))
    if ((c ?? 0) > 0) console.log(`  ${iso}: ${(c ?? 0).toLocaleString()}`)
  }

  console.log('\nlv_companies with domain:', (await count(vault.from('lv_companies'), (q: any) => q.not('domain','is',null)))?.toLocaleString())

  // Persons by source
  console.log('\nlv_persons total:', (await count(vault.from('lv_persons')))?.toLocaleString())
  const sources = ['companies_house','inpi','brreg','prh','ares','ariregister','github','wikidata','sec_edgar','linkedin_serp']
  for (const s of sources) {
    const c = await count(vault.from('lv_persons'), (q: any) => q.eq('primary_source', s))
    if ((c ?? 0) > 0) console.log(`  source=${s}: ${(c ?? 0).toLocaleString()}`)
  }

  // Contacts breakdown
  console.log('\nlv_contacts total:', (await count(vault.from('lv_contacts')))?.toLocaleString())
  for (const t of ['email','phone','linkedin','other']) {
    const c = await count(vault.from('lv_contacts'), (q: any) => q.eq('contact_type', t))
    console.log(`  type=${t}: ${(c ?? 0).toLocaleString()}`)
  }
  console.log('\nlv_contacts emails by verify_status:')
  for (const s of ['valid','risky','invalid','catch-all','unverified']) {
    const c = await count(vault.from('lv_contacts'), (q: any) => q.eq('contact_type','email').eq('verify_status', s))
    console.log(`  ${s}: ${(c ?? 0).toLocaleString()}`)
  }

  console.log('\n=== PROJECT TARGETS ===')
  const cl_total = await count(pub.from('commerce_leads'))
  const cl_email = await count(pub.from('commerce_leads'), (q: any) => q.not('email','is',null))
  const cl_phone = await count(pub.from('commerce_leads'), (q: any) => q.not('phone','is',null))
  const cl_web = await count(pub.from('commerce_leads'), (q: any) => q.not('website_url','is',null))
  console.log(`commerce_leads total: ${cl_total?.toLocaleString()} · email=${cl_email} · phone=${cl_phone} · website=${cl_web}`)
  const ed_total = await count(pub.from('entrepreneur_demos'))
  const ed_email = await count(pub.from('entrepreneur_demos'), (q: any) => q.not('email','is',null))
  console.log(`entrepreneur_demos total: ${ed_total?.toLocaleString()} · with email=${ed_email}`)

  console.log('\n=== SOURCE PROVENANCE lv_companies ===')
  for (const s of ['sirene','companies_house','handelsregister','mercantil_es','opencorporates','common_crawl','osm','gmaps','openownership','opensanctions','icij']) {
    const c = await count(vault.from('lv_companies'), (q: any) => q.eq('primary_source', s))
    if ((c ?? 0) > 0) console.log(`  ${s}: ${(c ?? 0).toLocaleString()}`)
  }
}
main().catch(e=>{console.error(e);process.exit(1)})
