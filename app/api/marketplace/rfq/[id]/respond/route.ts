import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ResponseInput = {
  price_eur_per_unit?: unknown
  qty_available?: unknown
  delivery_eta_days?: unknown
  notes?: unknown
}

function n(v: unknown): number | null {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
function s(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

/**
 * POST /api/marketplace/rfq/[id]/respond
 * Supplier soumet une réponse (price + qty).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let raw: ResponseInput
  try {
    raw = (await req.json()) as ResponseInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const price = n(raw.price_eur_per_unit)
  const qty = n(raw.qty_available)
  if (price == null || price < 0) return NextResponse.json({ error: 'price_required' }, { status: 400 })
  if (qty == null || qty <= 0) return NextResponse.json({ error: 'qty_required' }, { status: 400 })

  // Vérifie que le RFQ est bien open (RLS sélectionne open + own)
  const { data: rfq, error: rfqErr } = await sb
    .from('marketplace_rfq')
    .select('id, status, buyer_user_id')
    .eq('id', id)
    .single()
  if (rfqErr || !rfq) return NextResponse.json({ error: 'rfq_not_found' }, { status: 404 })
  if (rfq.status !== 'open') return NextResponse.json({ error: 'rfq_not_open', status: rfq.status }, { status: 409 })
  if (rfq.buyer_user_id === user.id) return NextResponse.json({ error: 'self_response_forbidden' }, { status: 403 })

  // Upsert response
  const { data, error } = await sb
    .from('marketplace_rfq_responses')
    .upsert({
      rfq_id: id,
      supplier_user_id: user.id,
      price_eur_per_unit: price,
      qty_available: qty,
      delivery_eta_days: n(raw.delivery_eta_days),
      notes: s(raw.notes),
      status: 'submitted',
    }, { onConflict: 'rfq_id,supplier_user_id' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, response_id: data?.id })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await sb
    .from('marketplace_rfq_responses')
    .select('id, supplier_user_id, price_eur_per_unit, qty_available, delivery_eta_days, notes, status, created_at')
    .eq('rfq_id', id)
    .order('price_eur_per_unit', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ responses: data ?? [] })
}
