#!/usr/bin/env node
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(
  fs.readFileSync('/var/www/feel-the-gap/.env.local','utf8').split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
await sb.from('lead_packs').delete().neq('id','00000000-0000-0000-0000-000000000000')
console.log('Cleared. Re-run seed-lead-packs.mjs now.')
