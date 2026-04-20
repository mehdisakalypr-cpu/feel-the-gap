import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { emailNewMatch } from '@/lib/email/marketplace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BROADCAST = 50

type RfqInput = {
  product_slug?: unknown
  product_label?: unknown
  qty_min?: unknown
  qty_max?: unknown
  qty_unit?: unknown
  target_price_eur_per_unit?: unknown
  required_certifications?: unknown
  delivery_country_iso?: unknown
  delivery_deadline?: unknown
  description?: unknown
}

function s(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}
function n(v: unknown): number | null {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

/**
 * POST /api/marketplace/rfq
 * Crée un RFQ + auto-broadcast vers suppliers matching
 * (production_volumes ouverts sur même product_slug, optionnel cert filter).
 *
 * GET /api/marketplace/rfq
 * Liste les RFQ du buyer connecté.
 */
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let raw: RfqInput
  try {
    raw = (await req.json()) as RfqInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const product_slug = s(raw.product_slug)
  if (!product_slug) {
    return NextResponse.json({ error: 'product_slug_required' }, { status: 400 })
  }
  const qty_min = n(raw.qty_min)
  const qty_max = n(raw.qty_max)
  if (qty_min != null && qty_max != null && qty_max < qty_min) {
    return NextResponse.json({ error: 'qty_max_lt_min' }, { status: 400 })
  }

  const insertPayload = {
    buyer_user_id: user.id,
    product_slug,
    product_label: s(raw.product_label),
    qty_min,
    qty_max,
    qty_unit: s(raw.qty_unit) ?? 'tonnes',
    target_price_eur_per_unit: n(raw.target_price_eur_per_unit),
    required_certifications: arr(raw.required_certifications),
    delivery_country_iso: s(raw.delivery_country_iso),
    delivery_deadline: s(raw.delivery_deadline),
    description: s(raw.description),
  }

  // Insert via user-scoped client (RLS validera buyer_user_id = auth.uid())
  const { data: rfq, error: insertErr } = await sb
    .from('marketplace_rfq')
    .insert(insertPayload)
    .select('id, product_slug, product_label, qty_min, qty_max, qty_unit, target_price_eur_per_unit, delivery_country_iso')
    .single()

  if (insertErr || !rfq) {
    return NextResponse.json({ error: 'insert_failed', details: insertErr?.message }, { status: 500 })
  }

  // Broadcast : utilise service-role pour scanner production_volumes + envoyer emails
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Cherche suppliers ayant un volume ouvert sur ce produit
  const { data: volumes } = await admin
    .from('production_volumes')
    .select('producer_id, country_iso, certifications, quantity_kg, floor_price_eur_per_kg')
    .eq('product_slug', product_slug)
    .eq('status', 'open')
    .limit(MAX_BROADCAST * 3) // sur-fetch pour dedup par supplier

  // Dedup + filtre cert
  const reqCerts = (insertPayload.required_certifications ?? []) as string[]
  const seen = new Set<string>()
  const matchingSuppliers: Array<{ producer_id: string }> = []
  for (const v of (volumes ?? [])) {
    const pid = (v as { producer_id?: string }).producer_id
    if (!pid || seen.has(pid)) continue
    if (reqCerts.length > 0) {
      const have = ((v as { certifications?: string[] }).certifications ?? []) as string[]
      const ok = reqCerts.every((c) => have.includes(c))
      if (!ok) continue
    }
    seen.add(pid)
    matchingSuppliers.push({ producer_id: pid })
    if (matchingSuppliers.length >= MAX_BROADCAST) break
  }

  // Notif emails (best-effort, fail-silent)
  let notified = 0
  for (const sup of matchingSuppliers) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(sup.producer_id)
      const email = u?.user?.email
      if (!email) continue
      const ok = await emailNewMatch({
        to: email,
        role: 'producer',
        matchId: rfq.id, // réutilise le template "new match" — le lien pointe sur /marketplace/rfq/${id}
        productLabel: rfq.product_label ?? rfq.product_slug,
        countryIso: rfq.delivery_country_iso ?? null,
        quantityKg: Number(rfq.qty_min ?? rfq.qty_max ?? 0) * 1000,
        pricePerKg: Number(rfq.target_price_eur_per_unit ?? 0),
        totalEur: Number(rfq.target_price_eur_per_unit ?? 0) * Number(rfq.qty_min ?? 0) * 1000,
        score: 80,
      })
      if (ok) notified++
    } catch (err) {
      console.error('[rfq.broadcast] notify error', (err as Error).message)
    }
  }

  // Met à jour broadcasted_to_count via admin (bypass RLS check qui ne ferait
  // pas de PB, mais on a la valeur précise ici)
  await admin
    .from('marketplace_rfq')
    .update({ broadcasted_to_count: matchingSuppliers.length })
    .eq('id', rfq.id)

  return NextResponse.json({
    ok: true,
    id: rfq.id,
    broadcasted_to_count: matchingSuppliers.length,
    notified,
  })
}

export async function GET() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await sb
    .from('marketplace_rfq')
    .select('id, product_slug, product_label, qty_min, qty_max, qty_unit, target_price_eur_per_unit, status, expires_at, broadcasted_to_count, responses_count, created_at')
    .eq('buyer_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rfqs: data ?? [] })
}
