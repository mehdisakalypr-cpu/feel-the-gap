import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  console.log('--- commerce_leads ---')
  const total = await db.from('commerce_leads').select('*', { count: 'exact', head: true })
  console.log('total:', total.count)
  const noEmail = await db.from('commerce_leads').select('*', { count: 'exact', head: true }).is('email', null)
  console.log('email null:', noEmail.count)
  const noEmailFRGB = await db.from('commerce_leads').select('*', { count: 'exact', head: true }).is('email', null).in('country_iso', ['FRA','GBR'])
  console.log('email null FR/GB:', noEmailFRGB.count)
  const sample = await db.from('commerce_leads').select('id, business_name, country_iso, email, phone, website_url').limit(3)
  console.log('sample 3:', JSON.stringify(sample.data, null, 2))

  console.log('\n--- lv_persons (vault people) ---')
  const persons = await db.from('lv_persons').select('*', { count: 'exact', head: true })
  console.log('total persons:', persons.count)
  const personsFR = await db.from('lv_persons').select('id, lv_companies!inner(country_iso)', { count: 'exact', head: true }).eq('lv_companies.country_iso','FRA')
  console.log('persons FRA companies:', personsFR.count)
  const personsGB = await db.from('lv_persons').select('id, lv_companies!inner(country_iso)', { count: 'exact', head: true }).eq('lv_companies.country_iso','GBR')
  console.log('persons GBR companies:', personsGB.count)

  console.log('\n--- lv_contacts emails ---')
  const contacts = await db.from('lv_contacts').select('*', { count: 'exact', head: true }).eq('contact_type','email')
  console.log('total emails:', contacts.count)
  const valid = await db.from('lv_contacts').select('*', { count: 'exact', head: true }).eq('contact_type','email').in('verify_status', ['valid','risky','unverified'])
  console.log('valid/risky/unverified:', valid.count)

  console.log('\n--- lv_companies coverage ---')
  const cFR = await db.from('lv_companies').select('*', { count: 'exact', head: true }).eq('country_iso','FRA')
  console.log('FRA:', cFR.count)
  const cGB = await db.from('lv_companies').select('*', { count: 'exact', head: true }).eq('country_iso','GBR')
  console.log('GBR:', cGB.count)
  const cFRDom = await db.from('lv_companies').select('*', { count: 'exact', head: true }).eq('country_iso','FRA').not('domain','is',null)
  console.log('FRA with domain:', cFRDom.count)
  const cGBDom = await db.from('lv_companies').select('*', { count: 'exact', head: true }).eq('country_iso','GBR').not('domain','is',null)
  console.log('GBR with domain:', cGBDom.count)
}
main().catch(e=>{console.error(e);process.exit(1)})
