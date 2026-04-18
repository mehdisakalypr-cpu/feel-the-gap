import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

/**
 * Cron marketplace matcher — tourne toutes les heures.
 *
 * Scan `production_volumes` × `buyer_demands` status='open', score chaque paire
 * sur 100 points, upsert dans `marketplace_matches` pour score >= 65.
 *
 * Déclenche le flywheel 2.5% commission sans intervention humaine.
 *
 * Réutilise la même logique que `agents/matcher.ts` (source unique à terme
 * à refactorer en `lib/marketplace/matcher.ts`, dupliqué ici en attendant).
 */

type Volume = {
  id: string; country_iso: string; product_slug: string
  quantity_kg: number; quality_grade: string | null
  certifications: string[] | null; floor_price_eur_per_kg: number | null
  incoterm: string | null; available_from: string | null
}
type Demand = {
  id: string; product_slug: string
  quantity_kg_min: number; quantity_kg_max: number | null
  quality_grade: string | null; required_certifications: string[] | null
  ceiling_price_eur_per_kg: number | null; incoterm: string | null
  origin_country_whitelist: string[] | null; deadline: string | null
}
type Match = {
  volume_id: string; demand_id: string; match_score: number
  proposed_quantity_kg: number; proposed_price_eur_per_kg: number
  commission_rate_pct: number; matcher_notes: Record<string, number | string>
}

const GRADE_ORDER: Record<string, number> = {
  specialty: 5, premium: 4, grade_1: 4, grade_a: 4,
  standard: 3, grade_2: 3, grade_b: 3,
  commercial: 2, grade_3: 2, basic: 1,
}
function gradeRank(g: string | null | undefined): number {
  if (!g) return 0
  return GRADE_ORDER[g.toLowerCase()] ?? 0
}

function scoreMatch(v: Volume, d: Demand): { score: number; notes: Record<string, number | string> } {
  const notes: Record<string, number | string> = {}
  let s = 0
  if (v.product_slug !== d.product_slug) return { score: 0, notes: { product: 'mismatch' } }
  s += 20; notes.product = 20

  const qV = gradeRank(v.quality_grade), qD = gradeRank(d.quality_grade)
  if (!d.quality_grade) { s += 15; notes.quality = 15 }
  else if (qV >= qD) { s += 15; notes.quality = 15 }
  else if (qV === qD - 1) { s += 7; notes.quality = 7 }
  else notes.quality = 0

  const req = (d.required_certifications ?? []).map(c => c.toLowerCase())
  const have = (v.certifications ?? []).map(c => c.toLowerCase())
  if (req.length === 0) { s += 15; notes.certs = 15 }
  else {
    const covered = req.filter(r => have.includes(r)).length
    const pts = Math.round((covered / req.length) * 15)
    s += pts; notes.certs = pts
  }

  const qtyMin = d.quantity_kg_min, qtyMax = d.quantity_kg_max ?? Number.POSITIVE_INFINITY
  if (v.quantity_kg >= qtyMin && v.quantity_kg <= qtyMax) { s += 15; notes.quantity = 15 }
  else if (v.quantity_kg >= qtyMin * 0.8 && v.quantity_kg <= qtyMax * 1.2) { s += 8; notes.quantity = 8 }
  else notes.quantity = 0

  if (d.ceiling_price_eur_per_kg == null || v.floor_price_eur_per_kg == null) { s += 10; notes.price = 10 }
  else if (v.floor_price_eur_per_kg <= d.ceiling_price_eur_per_kg) { s += 15; notes.price = 15 }
  else if (v.floor_price_eur_per_kg <= d.ceiling_price_eur_per_kg * 1.05) { s += 7; notes.price = 7 }
  else notes.price = 0

  if (!d.incoterm || !v.incoterm || d.incoterm === v.incoterm) { s += 10; notes.incoterm = 10 }
  else notes.incoterm = 0

  const wl = d.origin_country_whitelist ?? []
  if (wl.length === 0 || wl.includes(v.country_iso)) { s += 5; notes.origin = 5 }
  else notes.origin = 0

  if (!d.deadline) { s += 5; notes.deadline = 5 }
  else {
    const dl = new Date(d.deadline).getTime()
    const af = v.available_from ? new Date(v.available_from).getTime() : Date.now()
    if (af <= dl) { s += 5; notes.deadline = 5 }
    else notes.deadline = 0
  }

  return { score: Math.min(100, s), notes }
}

export async function GET(req: NextRequest) {
  // Vercel cron : header 'user-agent' = 'vercel-cron/1.0' OR Authorization Bearer CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? ''
  const ua = req.headers.get('user-agent') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = ua.includes('vercel-cron')
  const isAuthed = cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isVercelCron && !isAuthed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    const [volRes, demRes] = await Promise.all([
      db.from('production_volumes').select('id, country_iso, product_slug, quantity_kg, quality_grade, certifications, floor_price_eur_per_kg, incoterm, available_from').eq('status', 'open').limit(5000),
      db.from('buyer_demands').select('id, product_slug, quantity_kg_min, quantity_kg_max, quality_grade, required_certifications, ceiling_price_eur_per_kg, incoterm, origin_country_whitelist, deadline').eq('status', 'open').limit(5000),
    ])
    if (volRes.error) throw volRes.error
    if (demRes.error) throw demRes.error

    const volumes = (volRes.data ?? []) as Volume[]
    const demands = (demRes.data ?? []) as Demand[]

    const byProduct = new Map<string, Demand[]>()
    for (const d of demands) {
      const arr = byProduct.get(d.product_slug) ?? []
      arr.push(d); byProduct.set(d.product_slug, arr)
    }

    const matches: Match[] = []
    const FLOOR = 65
    const COMMISSION = 2.5

    for (const v of volumes) {
      const cand = byProduct.get(v.product_slug) ?? []
      for (const d of cand) {
        const { score, notes } = scoreMatch(v, d)
        if (score < FLOOR) continue
        const qMax = d.quantity_kg_max ?? v.quantity_kg
        const qty = Math.max(d.quantity_kg_min, Math.min(v.quantity_kg, qMax))
        let price: number | null = null
        if (v.floor_price_eur_per_kg != null && d.ceiling_price_eur_per_kg != null) {
          price = (v.floor_price_eur_per_kg + d.ceiling_price_eur_per_kg) / 2
        } else if (v.floor_price_eur_per_kg != null) price = v.floor_price_eur_per_kg
        else if (d.ceiling_price_eur_per_kg != null) price = d.ceiling_price_eur_per_kg
        if (price == null || !Number.isFinite(price)) continue
        matches.push({
          volume_id: v.id, demand_id: d.id, match_score: score,
          proposed_quantity_kg: qty,
          proposed_price_eur_per_kg: Number(price.toFixed(4)),
          commission_rate_pct: COMMISSION,
          matcher_notes: notes,
        })
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({
        ok: true, scanned: volumes.length * demands.length,
        open_volumes: volumes.length, open_demands: demands.length,
        matches_upserted: 0, duration_ms: Date.now() - startedAt,
      })
    }

    const { error: upErr, data: upserted } = await db
      .from('marketplace_matches')
      .upsert(matches, { onConflict: 'volume_id,demand_id', ignoreDuplicates: false })
      .select('id, match_score, proposed_total_eur, commission_amount_eur')
    if (upErr) throw upErr

    const totalGMV = matches.reduce((s, m) => s + m.proposed_quantity_kg * m.proposed_price_eur_per_kg, 0)
    const totalCommission = totalGMV * COMMISSION / 100
    const topScore = Math.max(...matches.map(m => m.match_score))

    return NextResponse.json({
      ok: true,
      open_volumes: volumes.length,
      open_demands: demands.length,
      matches_upserted: upserted?.length ?? matches.length,
      top_score: topScore,
      total_gmv_eur: Math.round(totalGMV),
      total_commission_eur: Math.round(totalCommission),
      duration_ms: Date.now() - startedAt,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      duration_ms: Date.now() - startedAt,
    }, { status: 500 })
  }
}
