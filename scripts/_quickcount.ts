import { config } from 'dotenv'; import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
const v = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false }, db: { schema: 'gapup_leads' } }) as any
async function c(t: string, build: (q: any) => any = (q: any) => q): Promise<number | null> {
  const { count } = await build(v.from(t).select('*', { count: 'exact', head: true })); return count
}
async function main() {
  console.log('lv_persons:', (await c('lv_persons'))?.toLocaleString())
  console.log('lv_persons CH:', (await c('lv_persons', (q: any) => q.eq('primary_source','companies_house')))?.toLocaleString())
  console.log('lv_persons INPI:', (await c('lv_persons', (q: any) => q.eq('primary_source','inpi')))?.toLocaleString())
  console.log('lv_contacts emails total:', (await c('lv_contacts', (q: any) => q.eq('contact_type','email')))?.toLocaleString())
  console.log('  valid:', (await c('lv_contacts', (q: any) => q.eq('contact_type','email').eq('verify_status','valid')))?.toLocaleString())
  console.log('  risky:', (await c('lv_contacts', (q: any) => q.eq('contact_type','email').eq('verify_status','risky')))?.toLocaleString())
  console.log('  unverified:', (await c('lv_contacts', (q: any) => q.eq('contact_type','email').eq('verify_status','unverified')))?.toLocaleString())
}
main().catch(e=>{console.error(e);process.exit(1)})
