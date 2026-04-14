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
 * TOP 80 pays scoutés — filière phare/exportable par pays, priorité par
 * potentiel de gap import/export FTG (1=hot, 5=baseline).
 * Les pays déjà dans WorldMap seed sont inclus aussi : le scouting alimente
 * les directories (local_buyers/exporters/investors/entrepreneurs), pas
 * l'affichage carte — overlap OK.
 */
const JOBS: Job[] = [
  // ── Afrique (25) ────────────────────────────────────────────────
  { country_iso: 'CIV', sector: 'agriculture',  product_slug: 'cajou',         priority: 1 },
  { country_iso: 'SEN', sector: 'agriculture',  product_slug: 'arachide',      priority: 1 },
  { country_iso: 'CMR', sector: 'agriculture',  product_slug: 'cacao',         priority: 1 },
  { country_iso: 'BFA', sector: 'agriculture',  product_slug: 'sesame',        priority: 1 },
  { country_iso: 'MLI', sector: 'agriculture',  product_slug: 'coton',         priority: 2 },
  { country_iso: 'BEN', sector: 'agriculture',  product_slug: 'ananas',        priority: 2 },
  { country_iso: 'TGO', sector: 'agriculture',  product_slug: 'soja',          priority: 2 },
  { country_iso: 'GHA', sector: 'agriculture',  product_slug: 'cacao',         priority: 2 },
  { country_iso: 'NGA', sector: 'agriculture',  product_slug: 'gingembre',     priority: 1 },
  { country_iso: 'KEN', sector: 'agriculture',  product_slug: 'the',           priority: 1 },
  { country_iso: 'ETH', sector: 'agriculture',  product_slug: 'cafe',          priority: 1 },
  { country_iso: 'TZA', sector: 'agriculture',  product_slug: 'avocat',        priority: 2 },
  { country_iso: 'UGA', sector: 'agriculture',  product_slug: 'cafe',          priority: 2 },
  { country_iso: 'RWA', sector: 'agriculture',  product_slug: 'cafe',          priority: 3 },
  { country_iso: 'MDG', sector: 'agriculture',  product_slug: 'vanille',       priority: 2 },
  { country_iso: 'MAR', sector: 'agriculture',  product_slug: 'huile_argan',   priority: 2 },
  { country_iso: 'TUN', sector: 'agriculture',  product_slug: 'huile_olive',   priority: 2 },
  { country_iso: 'DZA', sector: 'materials',    product_slug: 'ciment',        priority: 3 },
  { country_iso: 'EGY', sector: 'agriculture',  product_slug: 'agrumes',       priority: 2 },
  { country_iso: 'ZAF', sector: 'agriculture',  product_slug: 'vin',           priority: 2 },
  { country_iso: 'NAM', sector: 'agriculture',  product_slug: 'viande_bovine', priority: 3 },
  { country_iso: 'AGO', sector: 'energy',       product_slug: 'petrole',       priority: 3 },
  { country_iso: 'MOZ', sector: 'agriculture',  product_slug: 'noix_cajou',    priority: 3 },
  { country_iso: 'ZMB', sector: 'materials',    product_slug: 'cuivre',        priority: 3 },
  { country_iso: 'COD', sector: 'materials',    product_slug: 'cobalt',        priority: 3 },

  // ── Asie (22) ───────────────────────────────────────────────────
  { country_iso: 'CHN', sector: 'manufactured', product_slug: 'electronique',  priority: 3 },
  { country_iso: 'IND', sector: 'agriculture',  product_slug: 'epices',        priority: 1 },
  { country_iso: 'IDN', sector: 'agriculture',  product_slug: 'huile_palme',   priority: 2 },
  { country_iso: 'PHL', sector: 'agriculture',  product_slug: 'coco',          priority: 3 },
  { country_iso: 'VNM', sector: 'agriculture',  product_slug: 'cafe',          priority: 2 },
  { country_iso: 'THA', sector: 'agriculture',  product_slug: 'riz',           priority: 2 },
  { country_iso: 'MYS', sector: 'agriculture',  product_slug: 'huile_palme',   priority: 3 },
  { country_iso: 'BGD', sector: 'manufactured', product_slug: 'textile',       priority: 2 },
  { country_iso: 'PAK', sector: 'agriculture',  product_slug: 'riz_basmati',   priority: 3 },
  { country_iso: 'LKA', sector: 'agriculture',  product_slug: 'the',           priority: 3 },
  { country_iso: 'MMR', sector: 'agriculture',  product_slug: 'legumineuses',  priority: 4 },
  { country_iso: 'KAZ', sector: 'agriculture',  product_slug: 'cereales',      priority: 4 },
  { country_iso: 'UZB', sector: 'agriculture',  product_slug: 'coton',         priority: 4 },
  { country_iso: 'JPN', sector: 'manufactured', product_slug: 'machines',      priority: 4 },
  { country_iso: 'KOR', sector: 'manufactured', product_slug: 'electronique',  priority: 4 },
  { country_iso: 'SGP', sector: 'services',     product_slug: 'logistique',    priority: 4 },
  { country_iso: 'HKG', sector: 'services',     product_slug: 'trade_hub',     priority: 4 },
  { country_iso: 'TUR', sector: 'manufactured', product_slug: 'textile',       priority: 2 },
  { country_iso: 'ARE', sector: 'services',     product_slug: 're_export',     priority: 2 },
  { country_iso: 'SAU', sector: 'energy',       product_slug: 'petrochimie',   priority: 3 },
  { country_iso: 'IRN', sector: 'agriculture',  product_slug: 'pistache',      priority: 4 },
  { country_iso: 'IRQ', sector: 'energy',       product_slug: 'petrole',       priority: 5 },

  // ── Europe (20) ─────────────────────────────────────────────────
  { country_iso: 'DEU', sector: 'manufactured', product_slug: 'machines',      priority: 3 },
  { country_iso: 'FRA', sector: 'agriculture',  product_slug: 'vin',           priority: 2 },
  { country_iso: 'ITA', sector: 'manufactured', product_slug: 'mode',          priority: 2 },
  { country_iso: 'ESP', sector: 'agriculture',  product_slug: 'huile_olive',   priority: 2 },
  { country_iso: 'GBR', sector: 'services',     product_slug: 'finance',       priority: 4 },
  { country_iso: 'NLD', sector: 'agriculture',  product_slug: 'floriculture',  priority: 3 },
  { country_iso: 'BEL', sector: 'services',     product_slug: 'logistique',    priority: 4 },
  { country_iso: 'POL', sector: 'manufactured', product_slug: 'composants',    priority: 4 },
  { country_iso: 'ROU', sector: 'agriculture',  product_slug: 'cereales',      priority: 4 },
  { country_iso: 'HUN', sector: 'manufactured', product_slug: 'automobile',    priority: 4 },
  { country_iso: 'CZE', sector: 'manufactured', product_slug: 'automobile',    priority: 4 },
  { country_iso: 'PRT', sector: 'agriculture',  product_slug: 'vin',           priority: 3 },
  { country_iso: 'GRC', sector: 'agriculture',  product_slug: 'huile_olive',   priority: 3 },
  { country_iso: 'CHE', sector: 'manufactured', product_slug: 'horlogerie',    priority: 5 },
  { country_iso: 'AUT', sector: 'manufactured', product_slug: 'machines',      priority: 5 },
  { country_iso: 'SWE', sector: 'manufactured', product_slug: 'industriels',   priority: 4 },
  { country_iso: 'FIN', sector: 'materials',    product_slug: 'bois',          priority: 5 },
  { country_iso: 'DNK', sector: 'agriculture',  product_slug: 'porc',          priority: 5 },
  { country_iso: 'NOR', sector: 'agriculture',  product_slug: 'saumon',        priority: 3 },
  { country_iso: 'UKR', sector: 'agriculture',  product_slug: 'ble',           priority: 3 },

  // ── Amériques (13) ──────────────────────────────────────────────
  { country_iso: 'USA', sector: 'agriculture',  product_slug: 'soja',          priority: 3 },
  { country_iso: 'CAN', sector: 'agriculture',  product_slug: 'legumineuses',  priority: 3 },
  { country_iso: 'MEX', sector: 'agriculture',  product_slug: 'avocat',        priority: 2 },
  { country_iso: 'BRA', sector: 'agriculture',  product_slug: 'cafe',          priority: 2 },
  { country_iso: 'ARG', sector: 'agriculture',  product_slug: 'soja',          priority: 3 },
  { country_iso: 'CHL', sector: 'agriculture',  product_slug: 'fruits',        priority: 2 },
  { country_iso: 'COL', sector: 'agriculture',  product_slug: 'cafe',          priority: 2 },
  { country_iso: 'PER', sector: 'agriculture',  product_slug: 'quinoa',        priority: 3 },
  { country_iso: 'ECU', sector: 'agriculture',  product_slug: 'banane',        priority: 3 },
  { country_iso: 'BOL', sector: 'agriculture',  product_slug: 'quinoa',        priority: 4 },
  { country_iso: 'URY', sector: 'agriculture',  product_slug: 'viande_bovine', priority: 4 },
  { country_iso: 'PRY', sector: 'agriculture',  product_slug: 'soja',          priority: 4 },
  { country_iso: 'CRI', sector: 'agriculture',  product_slug: 'ananas',        priority: 4 },
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
