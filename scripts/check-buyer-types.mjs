#!/usr/bin/env node
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(
  fs.readFileSync('/var/www/feel-the-gap/.env.local','utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Group by buyer_type and country
const { data: lb } = await sb.from('local_buyers').select('buyer_type,country_iso').limit(10000)
const bt = {}, cc = {}
for (const r of lb ?? []) {
  bt[r.buyer_type] = (bt[r.buyer_type] ?? 0) + 1
  cc[r.country_iso] = (cc[r.country_iso] ?? 0) + 1
}
console.log('local_buyers by buyer_type:', bt)
console.log('top 10 countries:', Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,10))

const { data: ex } = await sb.from('exporters_directory').select('product_slugs,country_iso').limit(5000)
const ps = {}
for (const r of ex ?? []) for (const s of r.product_slugs ?? []) ps[s] = (ps[s]??0)+1
console.log('exporters top product_slugs:', Object.entries(ps).sort((a,b)=>b[1]-a[1]).slice(0,15))

const { data: en } = await sb.from('entrepreneurs_directory').select('sector').limit(5000)
const se = {}
for (const r of en ?? []) se[r.sector] = (se[r.sector]??0)+1
console.log('entrepreneurs top sectors:', Object.entries(se).sort((a,b)=>b[1]-a[1]).slice(0,10))
