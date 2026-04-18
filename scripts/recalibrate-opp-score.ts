// @ts-nocheck
/**
 * Recalibrage opportunity_score sur 938k rows (2026-04-18).
 *
 * Étapes :
 *  1. ALTER TABLE add column opportunity_score_llm (via Mgmt API, fast)
 *  2. Backup : update opportunity_score_llm = opportunity_score (batched 50k)
 *  3. Precompute calibration: read all (id, gap_value_usd, opp_score_llm) → percent_rank → new score
 *  4. Apply update batched 50k
 *
 * Usage : npx tsx scripts/recalibrate-opp-score.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const REF = 'jebuagyeapkltyjitosm'
const TOKEN = fs.readFileSync('/root/.supabase/access-token', 'utf8').trim()

async function mgmtSql(query: string): Promise<any> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`mgmt ${res.status}: ${body.slice(0, 300)}`)
  return JSON.parse(body)
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function step1AddColumn() {
  console.log('[step1] ALTER TABLE + comment…')
  await mgmtSql(`
    alter table public.opportunities add column if not exists opportunity_score_llm int;
    comment on column public.opportunities.opportunity_score_llm is 'Score LLM brut avant calibrage 2026-04-18';
  `)
  console.log('[step1] ✓ column opportunity_score_llm added')
}

async function step2BackupLLM() {
  console.log('[step2] Backup opportunity_score → opportunity_score_llm (batched)…')
  // Use ctid-based pagination — no offset cost
  let batch = 0
  while (true) {
    const { count } = await mgmtSql(`
      with ids as (
        select id from public.opportunities
        where opportunity_score_llm is null
        order by id
        limit 50000
      )
      update public.opportunities o
      set opportunity_score_llm = o.opportunity_score
      from ids
      where o.id = ids.id
      returning 1;
    `).then((rows: any) => ({ count: Array.isArray(rows) ? rows.length : 0 }))
    batch++
    console.log(`  batch ${batch} → ${count} rows backed up`)
    if (count === 0) break
    if (batch > 30) { console.error('  safety break at 30 batches'); break }
  }
  console.log('[step2] ✓ backup done')
}

async function step3ComputeAndApply() {
  console.log('[step3] Computing percent_rank + applying calibration (batched)…')
  // Idée : faire le calcul percent_rank côté PG via une matview temporaire
  // puis UPDATE par batches depuis la matview. Plus rapide que tout passer en Node.
  await mgmtSql(`drop materialized view if exists opportunities_calibration_tmp;`)
  await mgmtSql(`
    create materialized view opportunities_calibration_tmp as
    select
      id,
      greatest(40, least(100, round(
        40 + 60 * (
          0.70 * percent_rank() over (order by coalesce(gap_value_usd, 0)) +
          0.30 * percent_rank() over (order by coalesce(opportunity_score_llm, 50))
        )
      )::int)) as new_score
    from public.opportunities;
  `)
  console.log('[step3] matview built')
  await mgmtSql(`create index on opportunities_calibration_tmp (id);`)
  console.log('[step3] idx done')

  let batch = 0
  let totalUpdated = 0
  while (true) {
    const rows = await mgmtSql(`
      with ids as (
        select c.id, c.new_score
        from opportunities_calibration_tmp c
        join public.opportunities o on o.id = c.id
        where o.opportunity_score is distinct from c.new_score
        limit 50000
      )
      update public.opportunities o
      set opportunity_score = ids.new_score
      from ids
      where o.id = ids.id
      returning 1;
    `)
    const count = Array.isArray(rows) ? rows.length : 0
    batch++
    totalUpdated += count
    console.log(`  batch ${batch} → ${count} rows (total ${totalUpdated})`)
    if (count === 0) break
    if (batch > 30) { console.error('  safety break at 30 batches'); break }
  }

  await mgmtSql(`drop materialized view if exists opportunities_calibration_tmp;`)
  await mgmtSql(`create index if not exists idx_opportunities_score_desc on public.opportunities (opportunity_score desc) where opportunity_score is not null;`)
  await mgmtSql(`comment on column public.opportunities.opportunity_score is 'Score calibré 40-100 via percent_rank composite (gap 70% + LLM 30%). Remappé 2026-04-18.';`)
  console.log('[step3] ✓ calibration applied + matview dropped + index + comment')
}

async function step4Verify() {
  console.log('[step4] Verification distribution…')
  const dist = await mgmtSql(`
    select
      width_bucket(opportunity_score, 40, 100, 12) as bucket,
      min(opportunity_score) min_s, max(opportunity_score) max_s, count(*)
    from public.opportunities
    group by bucket order by bucket;
  `)
  console.log('[step4] buckets:')
  for (const b of dist) {
    console.log(`  ${b.min_s}-${b.max_s}: ${b.count.toLocaleString('fr-FR')}`)
  }
}

async function main() {
  const t0 = Date.now()
  await step1AddColumn()
  await step2BackupLLM()
  await step3ComputeAndApply()
  await step4Verify()
  console.log(`\n✓ Recalibrage terminé en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
