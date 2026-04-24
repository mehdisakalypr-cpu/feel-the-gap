import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
for (const line of fs.readFileSync('.env.local','utf8').split('\n')) {
  const t=line.trim(); if(!t||t.startsWith('#'))continue
  const i=t.indexOf('='); if(i<0)continue
  if(!process.env[t.slice(0,i).trim()]) process.env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,'')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  // Reset any 'running' job older than 10 min back to pending
  const tenMinAgo = new Date(Date.now() - 10*60*1000).toISOString()
  const { data: stuck, error } = await db.from('scout_queue').update({ status: 'pending', started_at: null, last_error: 'stale_reset' }).eq('status','running').lt('started_at', tenMinAgo).select('id, country_iso, sector, product_slug')
  console.log('Unstuck:', stuck?.length ?? 0, error?.message ?? '')
  // Also reset failed jobs with zero_results / quota_exhausted — give them another try
  const { data: retry } = await db.from('scout_queue').update({ status: 'pending', last_error: null, finished_at: null }).eq('status','failed').in('last_error', ['quota_exhausted','zero_results']).select('id')
  console.log('Retry-queued failed:', retry?.length ?? 0)
  const { count } = await db.from('scout_queue').select('*',{count:'exact',head:true}).eq('status','pending')
  console.log('pending total:', count)
})()
