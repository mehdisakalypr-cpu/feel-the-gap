import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
for (const line of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue
  const i=t.indexOf('='); if(i<0)continue
  if(!process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,'')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const [demosWithEmail, demosSent, dirWithEmail, dirWithPhone, dirWithWhatsapp, dirWithLinkedin] = await Promise.all([
    db.from('entrepreneur_demos').select('*',{count:'exact',head:true}).not('email','is',null),
    db.from('entrepreneur_demos').select('*',{count:'exact',head:true}).not('outreach_sent_at','is',null),
    db.from('entrepreneurs_directory').select('*',{count:'exact',head:true}).not('email','is',null),
    db.from('entrepreneurs_directory').select('*',{count:'exact',head:true}).not('phone','is',null),
    db.from('entrepreneurs_directory').select('*',{count:'exact',head:true}).not('whatsapp','is',null),
    db.from('entrepreneurs_directory').select('*',{count:'exact',head:true}).not('linkedin_url','is',null),
  ])
  console.log('demos with email:', demosWithEmail.count)
  console.log('demos sent:', demosSent.count)
  console.log('directory with email:', dirWithEmail.count)
  console.log('directory with phone:', dirWithPhone.count)
  console.log('directory with whatsapp:', dirWithWhatsapp.count)
  console.log('directory with linkedin:', dirWithLinkedin.count)
  // How many demos have a directory match with any contact?
  const { data: demos } = await db.from('entrepreneur_demos').select('id, full_name, country_iso').limit(1000)
  if (demos) {
    let reachable = 0
    for (const d of demos) {
      const { data: row } = await db.from('entrepreneurs_directory').select('id').eq('country_iso', d.country_iso).ilike('name', d.full_name).or('email.not.is.null,phone.not.is.null,whatsapp.not.is.null').maybeSingle()
      if (row) reachable++
    }
    console.log(`demos (sample 1000) reachable via directory contact: ${reachable}`)
  }
})()
