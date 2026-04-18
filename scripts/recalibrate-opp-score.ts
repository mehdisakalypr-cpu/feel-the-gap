// @ts-nocheck
/**
 * Recalibrage opportunity_score — v4 per-country 2026-04-18.
 *
 * Approche : calibrer par pays (SQL CTE + UPDATE dans un seul stmt de ~<1s).
 * Chaque pays = percent_rank indépendant sur gap_value_usd + score_llm.
 * Résultat : au sein de CHAQUE rapport pays, scores étalés 40-100.
 * C'est exactement ce que l'user veut : granularité dans la vue rapport d'un pays.
 */

import * as fs from 'fs'

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
  try { return JSON.parse(body) } catch { return [] }
}

async function main() {
  const t0 = Date.now()

  console.log('[setup] ALTER TABLE add opportunity_score_llm…')
  await mgmtSql(`alter table public.opportunities add column if not exists opportunity_score_llm int;`)
  console.log('[setup] ✓')

  console.log('[load] list countries…')
  const countries = await mgmtSql(`
    select country_iso, count(*) as n
    from public.opportunities
    where country_iso is not null
    group by country_iso
    order by country_iso;
  `)
  console.log(`[load] ${countries.length} countries`)

  let done = 0
  let errs = 0
  for (const c of countries) {
    const iso = c.country_iso
    const n = c.n
    try {
      await mgmtSql(`
        with ranked as (
          select id,
            percent_rank() over (order by coalesce(gap_value_usd, 0)) as pr_gap,
            percent_rank() over (order by coalesce(opportunity_score, 50)) as pr_llm
          from public.opportunities
          where country_iso = '${iso}'
        )
        update public.opportunities o
        set
          opportunity_score_llm = coalesce(o.opportunity_score_llm, o.opportunity_score),
          opportunity_score = greatest(40, least(100, round(40 + 60 * (0.70 * r.pr_gap + 0.30 * r.pr_llm))::int))
        from ranked r
        where o.id = r.id and o.country_iso = '${iso}';
      `)
      done++
    } catch (err) {
      errs++
      console.error(`[${iso}] err:`, (err as Error).message.slice(0, 150))
    }
    if (done % 20 === 0 || done === countries.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
      console.log(`  ${done}/${countries.length} countries · errs=${errs} · ${elapsed}s`)
    }
  }

  console.log('[verify] Distribution per country (sample)…')
  const sample = await mgmtSql(`
    select country_iso, min(opportunity_score) as min, max(opportunity_score) as max, count(*) as n
    from public.opportunities
    where country_iso in ('CIV','FRA','USA','CHN','IND','BRA')
    group by country_iso order by country_iso;
  `)
  for (const s of sample) console.log(`  ${s.country_iso}: min=${s.min} max=${s.max} n=${s.n}`)

  const topCIV = await mgmtSql(`
    select product_id, opportunity_score, gap_value_usd
    from public.opportunities where country_iso = 'CIV'
    order by opportunity_score desc limit 8;
  `)
  console.log('[verify] Top CIV (should be spread):')
  for (const t of topCIV) console.log(`  ${t.product_id.slice(0, 40)} score=${t.opportunity_score} gap=${Number(t.gap_value_usd).toLocaleString('fr-FR')}`)

  console.log(`\n✓ Terminé en ${((Date.now() - t0) / 1000).toFixed(0)}s · done=${done}/${countries.length} errs=${errs}`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
