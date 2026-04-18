// @ts-nocheck
/**
 * FTG Marketplace Matcher — Phase 2 pivot
 *
 * Scan des paires (production_volume × buyer_demand) ouvertes, score de
 * pertinence 0-100, insertion dans `marketplace_matches` pour les scores
 * >= seuil. La commission (2.5% par défaut) est stockée en colonne générée
 * côté DB — on se contente d'insérer qty + prix.
 *
 * Scoring (100 points répartis) :
 *   - Produit (slug match strict)          20
 *   - Qualité (grade ≥ demande)            15
 *   - Certifications (toutes requises ok)  15
 *   - Quantité dans [min,max]              15
 *   - Prix sous ceiling                    15
 *   - Incoterm compatible (ou null buyer)  10
 *   - Origine whitelist (ou vide)           5
 *   - Deadline cohérent (available ≤ DL)    5
 *
 * Un score < MATCH_FLOOR est ignoré. Un match déjà existant (même paire) est
 * upserté sur conflict pour refléter l'évolution des offres/demandes.
 *
 * Usage :
 *   npx tsx agents/matcher.ts
 *   npx tsx agents/matcher.ts --product=cafe
 *   npx tsx agents/matcher.ts --floor=70 --limit=500 --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── env ─────────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argv = {
  product: getArg('--product'),
  floor:   parseFloat(getArg('--floor') ?? '65'),
  limit:   parseInt(getArg('--limit') ?? '2000', 10),
  dryRun:  args.includes('--dry-run'),
  commission: parseFloat(getArg('--commission') ?? '2.5'),
}
function getArg(flag: string): string | undefined {
  const pref = `${flag}=`
  const hit = args.find(a => a.startsWith(pref))
  return hit ? hit.slice(pref.length) : undefined
}

// ─── types ───────────────────────────────────────────────────────────────────
type Volume = {
  id: string
  producer_id: string | null
  country_iso: string
  product_slug: string
  quantity_kg: number
  quality_grade: string | null
  certifications: string[] | null
  floor_price_eur_per_kg: number | null
  incoterm: string | null
  available_from: string | null
  available_until: string | null
}
type Demand = {
  id: string
  buyer_id: string | null
  product_slug: string
  quantity_kg_min: number
  quantity_kg_max: number | null
  quality_grade: string | null
  required_certifications: string[] | null
  ceiling_price_eur_per_kg: number | null
  incoterm: string | null
  origin_country_whitelist: string[] | null
  deadline: string | null
}

// ─── scoring ─────────────────────────────────────────────────────────────────
const GRADE_ORDER: Record<string, number> = {
  specialty: 5, premium: 4, grade_1: 4, grade_a: 4,
  standard: 3, grade_2: 3, grade_b: 3,
  commercial: 2, grade_3: 2,
  basic: 1,
}
function gradeRank(g: string | null | undefined): number {
  if (!g) return 0
  return GRADE_ORDER[g.toLowerCase()] ?? 0
}

function scoreMatch(v: Volume, d: Demand): { score: number; notes: Record<string, number | string> } {
  const notes: Record<string, number | string> = {}
  let s = 0

  // 1. Produit — strict (si le slug ne matche pas, score = 0, on skip plus loin)
  if (v.product_slug !== d.product_slug) {
    return { score: 0, notes: { product: 'mismatch' } }
  }
  s += 20; notes.product = 20

  // 2. Qualité — grade producteur >= grade demandé
  const qV = gradeRank(v.quality_grade)
  const qD = gradeRank(d.quality_grade)
  if (!d.quality_grade) { s += 15; notes.quality = 15 }
  else if (qV >= qD) { s += 15; notes.quality = 15 }
  else if (qV === qD - 1) { s += 7; notes.quality = 7 }
  else { notes.quality = 0 }

  // 3. Certifications requises
  const req = (d.required_certifications ?? []).map(c => c.toLowerCase())
  const have = (v.certifications ?? []).map(c => c.toLowerCase())
  if (req.length === 0) { s += 15; notes.certs = 15 }
  else {
    const covered = req.filter(r => have.includes(r)).length
    const pct = covered / req.length
    const pts = Math.round(pct * 15)
    s += pts; notes.certs = pts
  }

  // 4. Quantité dans [min, max] (max = infini si null)
  const qtyMin = d.quantity_kg_min
  const qtyMax = d.quantity_kg_max ?? Number.POSITIVE_INFINITY
  if (v.quantity_kg >= qtyMin && v.quantity_kg <= qtyMax) { s += 15; notes.quantity = 15 }
  else if (v.quantity_kg >= qtyMin * 0.8 && v.quantity_kg <= qtyMax * 1.2) { s += 8; notes.quantity = 8 }
  else notes.quantity = 0

  // 5. Prix : producteur floor <= buyer ceiling
  if (d.ceiling_price_eur_per_kg == null || v.floor_price_eur_per_kg == null) {
    s += 10; notes.price = 10 // incertain = neutre favorable
  } else if (v.floor_price_eur_per_kg <= d.ceiling_price_eur_per_kg) {
    s += 15; notes.price = 15
  } else if (v.floor_price_eur_per_kg <= d.ceiling_price_eur_per_kg * 1.05) {
    s += 7; notes.price = 7
  } else notes.price = 0

  // 6. Incoterm
  if (!d.incoterm || !v.incoterm || d.incoterm === v.incoterm) { s += 10; notes.incoterm = 10 }
  else notes.incoterm = 0

  // 7. Origin whitelist
  const wl = d.origin_country_whitelist ?? []
  if (wl.length === 0 || wl.includes(v.country_iso)) { s += 5; notes.origin = 5 }
  else notes.origin = 0

  // 8. Deadline — available_from <= deadline
  if (!d.deadline) { s += 5; notes.deadline = 5 }
  else {
    const dl = new Date(d.deadline).getTime()
    const af = v.available_from ? new Date(v.available_from).getTime() : Date.now()
    if (af <= dl) { s += 5; notes.deadline = 5 }
    else notes.deadline = 0
  }

  return { score: Math.min(100, s), notes }
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[matcher] 🔍 Scan marketplace — product=${argv.product ?? 'ALL'} floor=${argv.floor} limit=${argv.limit} commission=${argv.commission}%${argv.dryRun ? ' [DRY-RUN]' : ''}`)

  let vq = db.from('production_volumes').select('*').eq('status', 'open').limit(argv.limit)
  let dq = db.from('buyer_demands').select('*').eq('status', 'open').limit(argv.limit)
  if (argv.product) {
    vq = vq.eq('product_slug', argv.product)
    dq = dq.eq('product_slug', argv.product)
  }
  const [{ data: volumes, error: vErr }, { data: demands, error: dErr }] = await Promise.all([vq, dq])
  if (vErr) throw vErr
  if (dErr) throw dErr

  console.log(`[matcher] 📦 ${volumes?.length ?? 0} open volumes · 🛒 ${demands?.length ?? 0} open demands`)
  if (!volumes?.length || !demands?.length) {
    console.log('[matcher] rien à matcher.')
    return
  }

  // Group demands by product pour éviter N×M sur tout l'univers
  const demandsByProduct = new Map<string, Demand[]>()
  for (const d of demands as Demand[]) {
    const arr = demandsByProduct.get(d.product_slug) ?? []
    arr.push(d); demandsByProduct.set(d.product_slug, arr)
  }

  const matches: Array<{
    volume_id: string; demand_id: string; match_score: number
    proposed_quantity_kg: number; proposed_price_eur_per_kg: number
    commission_rate_pct: number; matcher_notes: unknown
  }> = []

  for (const v of volumes as Volume[]) {
    const cand = demandsByProduct.get(v.product_slug) ?? []
    for (const d of cand) {
      const { score, notes } = scoreMatch(v, d)
      if (score < argv.floor) continue

      // Qty proposée = min(volume dispo, demand max) bornée par demand min
      const qMax = d.quantity_kg_max ?? v.quantity_kg
      const qty = Math.max(d.quantity_kg_min, Math.min(v.quantity_kg, qMax))

      // Prix proposé = midpoint entre floor producer et ceiling buyer (si les 2),
      // sinon le côté connu, sinon skip.
      let price: number | null = null
      if (v.floor_price_eur_per_kg != null && d.ceiling_price_eur_per_kg != null) {
        price = (v.floor_price_eur_per_kg + d.ceiling_price_eur_per_kg) / 2
      } else if (v.floor_price_eur_per_kg != null) price = v.floor_price_eur_per_kg
      else if (d.ceiling_price_eur_per_kg != null) price = d.ceiling_price_eur_per_kg

      if (price == null || !Number.isFinite(price)) continue

      matches.push({
        volume_id: v.id,
        demand_id: d.id,
        match_score: score,
        proposed_quantity_kg: qty,
        proposed_price_eur_per_kg: Number(price.toFixed(4)),
        commission_rate_pct: argv.commission,
        matcher_notes: notes,
      })
    }
  }

  // Trie par score décroissant pour avoir les top matches en tête de table
  matches.sort((a, b) => b.match_score - a.match_score)

  console.log(`[matcher] ✨ ${matches.length} matches ≥ ${argv.floor} générés`)
  if (matches.length === 0) return

  if (argv.dryRun) {
    for (const m of matches.slice(0, 20)) {
      console.log(`  score=${m.match_score} qty=${m.proposed_quantity_kg}kg price=${m.proposed_price_eur_per_kg}€/kg total=${(m.proposed_quantity_kg * m.proposed_price_eur_per_kg).toFixed(0)}€ volume=${m.volume_id.slice(0,8)}… demand=${m.demand_id.slice(0,8)}…`)
    }
    console.log('[matcher] [DRY-RUN] rien inséré.')
    return
  }

  // Upsert en 1 pass (clé unique (volume_id, demand_id))
  const { data: upserted, error: uErr } = await db
    .from('marketplace_matches')
    .upsert(matches, { onConflict: 'volume_id,demand_id', ignoreDuplicates: false })
    .select('id')

  if (uErr) {
    console.error('[matcher] ❌ upsert error:', uErr)
    process.exit(1)
  }

  const totalGMV = matches.reduce((s, m) => s + m.proposed_quantity_kg * m.proposed_price_eur_per_kg, 0)
  const totalCommission = totalGMV * argv.commission / 100
  console.log(`[matcher] ✅ ${upserted?.length ?? matches.length} matches upserted`)
  console.log(`[matcher] 💰 GMV total proposé : ${totalGMV.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ · commission théorique (${argv.commission}%) : ${totalCommission.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`)
}

main().catch(err => {
  console.error('[matcher] fatal:', err)
  process.exit(1)
})
