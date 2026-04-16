#!/usr/bin/env node
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(
  fs.readFileSync('/var/www/feel-the-gap/.env.local','utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
for (const t of ['local_buyers','exporters_directory','investors_directory','entrepreneurs_directory']) {
  const { count } = await sb.from(t).select('id', { count: 'exact', head: true })
  console.log(t, count)
  const { data } = await sb.from(t).select('country_iso').limit(5)
  console.log(' sample countries:', (data ?? []).map(d => d.country_iso).join(','))
}
