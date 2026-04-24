import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
for (const line of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue
  const i=t.indexOf('='); if(i<0)continue
  if(!process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,'')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  for (const t of ['entrepreneur_demos','entrepreneurs_directory','scout_queue','profiles','personal_network_contacts','marketplace_matches','lead_marketplace_leads']) {
    const { count, error } = await db.from(t).select('*',{count:'exact',head:true})
    console.log(String(t).padEnd(34), error?('ERR:'+error.message):count)
  }
  const { data: sq } = await db.from('scout_queue').select('status, country_iso, sector, product_slug').limit(20000)
  const by: Record<string,number> = {}
  for (const r of sq ?? []) by[r.status as string] = (by[r.status as string]??0)+1
  console.log('\nscout_queue statuses:', by)
  const { data: ed } = await db.from('entrepreneur_demos').select('status').limit(20000)
  const by2: Record<string,number> = {}
  for (const r of ed ?? []) by2[r.status as string] = (by2[r.status as string]??0)+1
  console.log('entrepreneur_demos statuses:', by2)
  const { data: dir } = await db.from('entrepreneurs_directory').select('country_iso, sector').limit(20000)
  const byCountry: Record<string,number> = {}
  for (const r of dir ?? []) byCountry[r.country_iso as string] = (byCountry[r.country_iso as string]??0)+1
  console.log('directory by country:', byCountry)
})()
