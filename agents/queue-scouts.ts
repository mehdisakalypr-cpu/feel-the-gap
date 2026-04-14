/**
 * queue-scouts — seed la scout_queue avec les pays prioritaires où FTG a
 * encore des gaps de couverture (Afrique franco/anglophone, Maghreb, SEA,
 * LatAm, Europe de l'Est).
 *
 * Run: npx tsx agents/queue-scouts.ts
 *
 * Idempotent : l'index unique sur (country, sector, product) pending/running
 * évite les doublons côté DB — on utilise onConflict: ignore.
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

type Job = { country_iso: string; sector: string; product_slug?: string; priority: number }

/**
 * Gaps vs WorldMap seed (MAR/TUN/TZA/ZAF/NAM/ARE/FRA/DEU/BRA/IND/NGA/ETH/KEN/
 * CHN/USA/MEX/EGY/PAK/VNM/ARG).
 *
 * Produits choisis : la filière phare/exportable du pays qui a le meilleur
 * signal marché (cajou CI, arachide SN, cacao CM/GH, sésame BF, café CO,
 * quinoa PE, huile de palme ID, coco PH, ciment DZ, céréales RO, composants PL).
 */
const JOBS: Job[] = [
  // Afrique francophone — priorité 1 (marchés déjà ciblés par FTG côté demos)
  { country_iso: 'CIV', sector: 'agriculture', product_slug: 'cajou',        priority: 1 },
  { country_iso: 'SEN', sector: 'agriculture', product_slug: 'arachide',     priority: 1 },
  { country_iso: 'CMR', sector: 'agriculture', product_slug: 'cacao',        priority: 1 },
  { country_iso: 'BFA', sector: 'agriculture', product_slug: 'sesame',       priority: 1 },
  // Afrique anglophone
  { country_iso: 'GHA', sector: 'agriculture', product_slug: 'cacao',        priority: 2 },
  // Maghreb
  { country_iso: 'DZA', sector: 'materials',   product_slug: 'ciment',       priority: 3 },
  // South East Asia
  { country_iso: 'IDN', sector: 'agriculture', product_slug: 'huile_palme',  priority: 2 },
  { country_iso: 'PHL', sector: 'agriculture', product_slug: 'coco',         priority: 3 },
  // LatAm
  { country_iso: 'COL', sector: 'agriculture', product_slug: 'cafe',         priority: 2 },
  { country_iso: 'PER', sector: 'agriculture', product_slug: 'quinoa',       priority: 3 },
  // Europe de l'Est
  { country_iso: 'POL', sector: 'manufactured', product_slug: 'composants',  priority: 4 },
  { country_iso: 'ROU', sector: 'agriculture',  product_slug: 'cereales',    priority: 4 },
]

async function main() {
  const sb = db()
  let inserted = 0, skipped = 0
  for (const j of JOBS) {
    const { error } = await sb.from('scout_queue').insert({
      country_iso: j.country_iso,
      sector: j.sector,
      product_slug: j.product_slug ?? null,
      priority: j.priority,
      status: 'pending',
      source: 'autoscale',
    })
    if (error) {
      // 23505 = unique_violation (job pending/running déjà en base)
      if ((error as any).code === '23505' || /duplicate|unique/i.test(error.message)) {
        skipped++
        continue
      }
      console.error(`✗ ${j.country_iso}/${j.sector}/${j.product_slug}: ${error.message}`)
      continue
    }
    inserted++
    console.log(`+ queued ${j.country_iso}/${j.sector}/${j.product_slug} (p${j.priority})`)
  }
  console.log(`\n→ ${inserted} queued, ${skipped} skipped (already pending).`)

  const { count } = await sb
    .from('scout_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  console.log(`  scout_queue.pending = ${count}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
