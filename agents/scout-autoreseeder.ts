/**
 * scout-autoreseeder — re-alimente scout_queue quand pending < SEED_THRESHOLD.
 * Genere des combos frais (country x sector x product) non encore couverts
 * ou epuises (done > 30 jours). Pilote l'expansion auto vers 500k prospects.
 *
 * Run via PM2 ftg-scout-autoreseeder (loop interne 300s).
 * Usage CLI: npx tsx agents/scout-autoreseeder.ts --apply [--threshold=50]
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
loadEnv()

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const SEED_THRESHOLD = Number((process.argv.find(a => a.startsWith('--threshold='))?.split('=')[1]) ?? 50)
const APPLY = process.argv.includes('--apply')

// 60 pays x 5 sectors x produits multi-sous-variantes = pool enorme
const COUNTRIES = [
  'CIV','SEN','CMR','GHA','NGA','BFA','MLI','BEN','TGO','KEN','ETH','TZA','UGA','RWA','MDG',
  'MAR','TUN','EGY','ZAF','DZA','LBY','SDN','COD','COG','GAB','AGO','MOZ','ZMB','ZWE','NAM',
  'COL','BRA','PER','ECU','MEX','ARG','CHL','BOL','PRY','URY','VEN','CRI','PAN','DOM','CUB',
  'VNM','IND','IDN','PHL','THA','BGD','TUR','PAK','LKA','MYS','NPL','KHM','LAO','MMR','MNG',
]
const SECTORS = ['agriculture','food_processing','textile','artisan','aquaculture','technology','manufactured','services']
const PRODUCTS_BY_SECTOR: Record<string, string[]> = {
  agriculture: ['cacao','cafe','mangue','ananas','anacarde','hevea','coton','sesame','karite','riz','mais','soja','avocat','vanille','epices','fruits_tropicaux','miel_bio','the','quinoa','dattes','agrumes','huile_olive','huile_palme','gingembre','hibiscus','noix_cajou','cannelle','clou_girofle','poivre','safran'],
  food_processing: ['chocolat_origine','huile_argan','huile_avocat','jus_fruits','confitures','sauces_piment','epices_melange','torrefaction_cafe','conserves_poisson','farine_fonio','biscuits_bio','miel_aromatise','chutneys','pickles'],
  textile: ['coton_bio','kente','bogolan','pagne_wax','tapis_berbere','kilim','soie_locale','lin','cuir_tanne','vetements_ethniques','broderie_traditionnelle','chaussures_artisanales','uniformes_scolaires','linge_maison'],
  artisan: ['bijoux_argent','poterie','vannerie','maroquinerie','sculptures_bois','bronze_lost_wax','masques','tissage_alpaga','ceramique','pierres_semi_precieuses','perles','raffia','art_contemporain'],
  aquaculture: ['crevettes','tilapia','pangasius','algues','huitres','saumon_elevage','poissons_congeles','poissons_seches','farine_poisson'],
  technology: ['fintech_mobile','agritech','edtech','healthtech','logistics_tech','cleantech','e_commerce_b2b','drones_delivery','sms_banking','fintech_b2b','data_centers','cybersecurity'],
  manufactured: ['pharma_generic','composants_electroniques','automobile_parts','machines_agricoles','mobilier','metallurgie','panneaux_solaires','batteries','equipements_medicaux'],
  services: ['logistique_portuaire','tourisme','consulting_export','finance_islamique','diaspora_finance','b2b_saas','bpo','ingenierie','audit'],
}

async function loop(): Promise<void> {
  const sb = db()
  const { count: pending } = await sb.from('scout_queue').select('*', { count:'exact', head:true }).eq('status','pending')
  if ((pending ?? 0) >= SEED_THRESHOLD) {
    console.log(`[reseed] pending=${pending} >= ${SEED_THRESHOLD}, skip`)
    return
  }
  console.log(`[reseed] pending=${pending} < ${SEED_THRESHOLD}, reseeding...`)

  // Generer ~200 combos aleatoires
  const combos: { country_iso: string; sector: string; product_slug: string }[] = []
  const seen = new Set<string>()
  while (combos.length < 200) {
    const c = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
    const s = SECTORS[Math.floor(Math.random() * SECTORS.length)]
    const prods = PRODUCTS_BY_SECTOR[s] ?? []
    if (!prods.length) continue
    const p = prods[Math.floor(Math.random() * prods.length)]
    const key = `${c}/${s}/${p}`
    if (seen.has(key)) continue
    seen.add(key)
    combos.push({ country_iso: c, sector: s, product_slug: p })
  }

  let inserted = 0, skipped = 0
  for (const j of combos) {
    if (!APPLY) continue
    const { error } = await sb.from('scout_queue').insert({
      country_iso: j.country_iso,
      sector: j.sector,
      product_slug: j.product_slug,
      priority: 4,
      max_results: 100,
      status: 'pending',
      source: 'autoreseed',
    })
    if (error) {
      if ((error as any).code === '23505' || /duplicate|unique/i.test(error.message)) { skipped++; continue }
      continue
    }
    inserted++
  }
  const { count: after } = await sb.from('scout_queue').select('*', { count:'exact', head:true }).eq('status','pending')
  console.log(`[reseed] inserted=${inserted} skipped=${skipped} pending_after=${after}`)
}

async function main() {
  const runLoop = process.argv.includes('--loop')
  if (!runLoop) {
    await loop()
    return
  }
  console.log(`[autoreseeder] starting loop threshold=${SEED_THRESHOLD} apply=${APPLY}`)
  while (true) {
    try { await loop() } catch (e: any) { console.error('[reseed] err', e.message) }
    await new Promise(r => setTimeout(r, 300_000))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
