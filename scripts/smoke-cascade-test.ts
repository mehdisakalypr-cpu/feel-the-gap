/**
 * Smoke test cascade email-finder sur 5 leads lv_persons aléatoires
 * Mesure : hit-rate, source distribution, quota burn
 *
 * Usage: npx tsx scripts/smoke-cascade-test.ts
 * Quota cost estimation: 5 leads × 1-3 calls each = 5-15 free quota burned
 */
import { cascadeFindEmail, listConfiguredProviders } from '../lib/email-finder/cascade'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sb = createClient(supabaseUrl, supabaseKey)

  console.log(`[smoke-cascade] providers: ${listConfiguredProviders().join(', ')}`)

  // Bypass supabase-js join (slow) — use Management API direct SQL
  const mgmtToken = (await import('fs')).readFileSync('/root/.supabase/access-token', 'utf8').trim()
  const ref = 'jebuagyeapkltyjitosm'
  const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `SELECT p.first_name, p.last_name, p.role,
              COALESCE(c.trade_name, c.legal_name) as company_name,
              c.domain, c.country_iso
              FROM gapup_leads.lv_persons p
              JOIN gapup_leads.lv_companies c ON p.company_id = c.id
              WHERE p.first_name IS NOT NULL
                AND LENGTH(p.last_name) > 1
                AND c.domain IS NOT NULL
                AND c.domain != ''
              ORDER BY random()
              LIMIT 5`
    })
  })
  const persons = await sqlRes.json() as any[]
  const error = (persons as any).message ? persons : null

  if (error || !persons) {
    console.error('[smoke-cascade] db error:', error)
    process.exit(1)
  }

  const results: Array<{ person: string; domain: string; result: any; ms: number }> = []

  for (const p of persons as any[]) {
    if (!p.domain || !p.first_name || !p.last_name) {
      results.push({ person: `${p.first_name} ${p.last_name}`, domain: p.domain || '?', result: 'SKIP missing fields', ms: 0 })
      continue
    }

    const t0 = Date.now()
    const found = await cascadeFindEmail({
      first_name: p.first_name,
      last_name: p.last_name,
      domain: p.domain,
      company: p.company_name,
    })
    const ms = Date.now() - t0

    results.push({
      person: `${p.first_name} ${p.last_name}`,
      domain: p.domain,
      result: found ?? 'NOT FOUND',
      ms,
    })

    // throttle pour respecter rate-limits free
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\n=== RESULTS ===')
  const found = results.filter(r => r.result && typeof r.result === 'object' && r.result.email)
  for (const r of results) {
    const res = r.result
    if (typeof res === 'string') {
      console.log(`  ❓ ${r.person.padEnd(30)} @${r.domain.padEnd(35)} ${res}`)
    } else if (res?.email) {
      console.log(`  ✅ ${r.person.padEnd(30)} @${r.domain.padEnd(35)} -> ${res.email} (conf=${res.confidence} via ${res.source}, ${r.ms}ms)`)
    } else {
      console.log(`  ❌ ${r.person.padEnd(30)} @${r.domain.padEnd(35)} no match (${r.ms}ms)`)
    }
  }

  console.log(`\n[smoke-cascade] hit-rate: ${found.length}/${results.length} = ${Math.round(100*found.length/results.length)}%`)
  console.log(`[smoke-cascade] sources:`, JSON.stringify(found.reduce((acc: any, r) => { const s = (r.result as any).source; acc[s] = (acc[s]||0)+1; return acc }, {})))
}

main().catch(e => { console.error(e); process.exit(1) })
