import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { checkEntity } from '../../../sanctions/_lib/check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AcceptInput = {
  response_id?: unknown
}

/**
 * POST /api/marketplace/rfq/[id]/accept
 * Buyer accepte une réponse → ferme le RFQ + crée seller_quote_requests link
 * + screening sanctions sur le supplier (BLOCK si match).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let raw: AcceptInput
  try {
    raw = (await req.json()) as AcceptInput
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const responseId = typeof raw.response_id === 'string' ? raw.response_id : null
  if (!responseId) return NextResponse.json({ error: 'response_id_required' }, { status: 400 })

  // Charge le RFQ et vérifie ownership
  const { data: rfq, error: rfqErr } = await sb
    .from('marketplace_rfq')
    .select('id, status, buyer_user_id, product_slug, product_label, qty_unit, delivery_country_iso')
    .eq('id', id)
    .single()
  if (rfqErr || !rfq) return NextResponse.json({ error: 'rfq_not_found' }, { status: 404 })
  if (rfq.buyer_user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (rfq.status !== 'open' && rfq.status !== 'closing') {
    return NextResponse.json({ error: 'rfq_not_open', status: rfq.status }, { status: 409 })
  }

  // Charge la réponse à accepter
  const { data: resp, error: respErr } = await sb
    .from('marketplace_rfq_responses')
    .select('id, supplier_user_id, price_eur_per_unit, qty_available, status')
    .eq('id', responseId)
    .eq('rfq_id', id)
    .single()
  if (respErr || !resp) return NextResponse.json({ error: 'response_not_found' }, { status: 404 })

  // Sanctions screening — fetch supplier email/name (best-effort)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  let supplierName = ''
  let supplierCountry: string | null = null
  try {
    const { data: u } = await admin.auth.admin.getUserById(resp.supplier_user_id)
    const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>
    supplierName = String(meta.legal_name ?? meta.company ?? meta.full_name ?? u?.user?.email ?? '')
    supplierCountry = (meta.country as string | undefined) ?? null
  } catch (err) {
    console.warn('[rfq.accept] could not load supplier meta', (err as Error).message)
  }

  if (supplierName) {
    const screen = await checkEntity(supplierName, supplierCountry)
    if (screen.matched) {
      console.warn(`[rfq.accept] BLOCKED — sanctions hit supplier=${supplierName} matches=${screen.matches.length}`)
      return NextResponse.json({
        error: 'sanctions_blocked',
        matches: screen.matches,
      }, { status: 451 })
    }
  }

  // Update RFQ + accepted response
  const { error: updRfqErr } = await admin
    .from('marketplace_rfq')
    .update({
      status: 'closed',
      awarded_response_id: responseId,
    })
    .eq('id', id)
  if (updRfqErr) return NextResponse.json({ error: 'rfq_update_failed', details: updRfqErr.message }, { status: 500 })

  const { error: updRespErr } = await admin
    .from('marketplace_rfq_responses')
    .update({ status: 'accepted' })
    .eq('id', responseId)
  if (updRespErr) {
    console.error('[rfq.accept] failed to mark response accepted', updRespErr.message)
  }

  // Reject autres responses du même RFQ
  await admin
    .from('marketplace_rfq_responses')
    .update({ status: 'rejected' })
    .eq('rfq_id', id)
    .neq('id', responseId)
    .eq('status', 'submitted')

  return NextResponse.json({
    ok: true,
    rfq_id: id,
    accepted_response_id: responseId,
    supplier_user_id: resp.supplier_user_id,
  })
}
