import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'

const vault = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }, db: { schema: 'gapup_leads' },
}) as any
const pub = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  console.log('--- vault.lv_companies ---')
  const c = await vault.from('lv_companies').select('*', { count: 'exact', head: true })
  console.log('total:', c.count)
  for (const cc of ['FRA','GBR','FR','GB']) {
    const x = await vault.from('lv_companies').select('*', { count: 'exact', head: true }).eq('country_iso', cc)
    console.log(`country=${cc}:`, x.count)
  }
  const dom = await vault.from('lv_companies').select('*', { count: 'exact', head: true }).not('domain','is',null)
  console.log('with domain:', dom.count)

  console.log('\n--- vault.lv_persons ---')
  const p = await vault.from('lv_persons').select('*', { count: 'exact', head: true })
  console.log('total:', p.count)

  console.log('\n--- vault.lv_contacts ---')
  const ct = await vault.from('lv_contacts').select('*', { count: 'exact', head: true }).eq('contact_type','email')
  console.log('total emails:', ct.count)
  const sample = await vault.from('lv_contacts').select('contact_value, verify_status, verify_score').eq('contact_type','email').limit(3)
  console.log('sample 3:', JSON.stringify(sample.data, null, 2))

  console.log('\n--- public.commerce_leads country values ---')
  const dist = await pub.from('commerce_leads').select('country_iso').is('email', null).limit(2000)
  const m: Record<string, number> = {}
  for (const r of dist.data ?? []) {
    const k = r.country_iso ?? 'NULL'; m[k] = (m[k] ?? 0) + 1
  }
  console.log(Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,15))

  console.log('\n--- public.entrepreneur_demos w/ country in vault range ---')
  const fra = await pub.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).is('email', null).eq('country_iso','FRA')
  console.log('demos FRA email null:', fra.count)
  const gbr = await pub.from('entrepreneur_demos').select('*', { count: 'exact', head: true }).is('email', null).eq('country_iso','GBR')
  console.log('demos GBR email null:', gbr.count)
}
main().catch(e=>{console.error(e);process.exit(1)})
