/**
 * POST /api/buyer/contracts/[id]/sign
 * Body: { typed_name, scroll_completed? }
 *
 * Acheteur authentifié signe un contrat Incoterms. Écrit signed_by_buyer + signed_at
 * et passe status -> signed si seller déjà signé, sinon pending_seller.
 * Enregistre aussi une preuve dans signed_agreements (hash SHA-256 du contract_html).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createHash } from 'node:crypto'
import { getAuthUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getAuthUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: { typed_name?: string; scroll_completed?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const typedName = (body.typed_name ?? '').trim()
  if (typedName.length < 3) {
    return NextResponse.json({ ok: false, error: 'signature_too_short' }, { status: 400 })
  }

  const db = admin()

  const { data: contract, error: fetchErr } = await db
    .from('incoterms_contracts')
    .select('id, product_id, seller_id, buyer_id, incoterm, contract_html, status, signed_by_seller, signed_by_buyer')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !contract) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (contract.buyer_id && contract.buyer_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (contract.signed_by_buyer) {
    return NextResponse.json({ ok: false, error: 'already_signed' }, { status: 409 })
  }
  if (contract.status === 'cancelled') {
    return NextResponse.json({ ok: false, error: 'cancelled' }, { status: 409 })
  }

  const signedAt = new Date().toISOString()
  const newStatus = contract.signed_by_seller ? 'signed' : 'pending_seller'

  const { error: updErr } = await db
    .from('incoterms_contracts')
    .update({
      signed_by_buyer: typedName,
      signed_at: contract.signed_by_seller ? signedAt : null,
      status: newStatus,
      buyer_id: contract.buyer_id ?? user.id,
    })
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ ok: false, error: 'update_failed', detail: updErr.message }, { status: 500 })
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null
  const ua = hdrs.get('user-agent') ?? null
  const bodyHash = sha256(contract.contract_html ?? '')

  await db.from('signed_agreements').insert({
    user_id: user.id,
    email: user.email ?? '',
    product: 'ftg',
    plan: `incoterms_${contract.incoterm.toLowerCase()}`,
    agreement_version: 'incoterms_2020',
    agreement_hash_sha256: bodyHash,
    body_hash_sha256: bodyHash,
    ip,
    user_agent: ua,
    scroll_completed: !!body.scroll_completed,
    signature_text: typedName,
    acceptance_method: 'typed_signature',
    purchase_intent: { role: 'buyer', contract_id: id, incoterm: contract.incoterm },
    signed_at: signedAt,
  }).then(() => null).catch(() => null)

  return NextResponse.json({
    ok: true,
    contract_id: id,
    status: newStatus,
    signed_by_buyer: typedName,
    signed_at: newStatus === 'signed' ? signedAt : null,
  })
}
