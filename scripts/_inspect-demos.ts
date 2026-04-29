import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const total = await db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
  console.log('total demos:', total.count)
  const noEmail = await db.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).is('email', null)
  console.log('email null:', noEmail.count)
  const filt2 = await db.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).is('email', null).not('company_name','is',null).not('full_name','is',null)
  console.log('null email + company_name + full_name:', filt2.count)

  const sample = await db.from('entrepreneur_demos').select('id, full_name, company_name, country_iso, email, status').limit(5)
  console.log('sample 5:', JSON.stringify(sample.data, null, 2))

  // distribution country_iso
  const all = await db.from('entrepreneur_demos').select('country_iso, email').is('email', null).limit(2000)
  const dist: Record<string, number> = {}
  for (const r of all.data ?? []) {
    const k = r.country_iso ?? 'NULL'
    dist[k] = (dist[k] ?? 0) + 1
  }
  console.log('country_iso distribution (email null, top 20):')
  console.log(Object.entries(dist).sort((a,b)=>b[1]-a[1]).slice(0,20))
}
main().catch(e=>{console.error(e);process.exit(1)})
