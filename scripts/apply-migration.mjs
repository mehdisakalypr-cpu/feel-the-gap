#!/usr/bin/env node
// Apply a SQL file against Supabase via Management API.
// Usage: node scripts/apply-migration.mjs <path-to-sql>
import fs from 'node:fs'
const token = fs.readFileSync('/root/.supabase/access-token','utf8').trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'jebuagyeapkltyjitosm'
const sqlPath = process.argv[2]
if (!sqlPath) { console.error('Usage: apply-migration.mjs <path>'); process.exit(1) }
const sql = fs.readFileSync(sqlPath,'utf8')
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method:'POST',
  headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: sql })
})
const txt = await res.text()
console.log('HTTP', res.status)
console.log(txt.slice(0, 6000))
if (!res.ok) process.exit(1)
