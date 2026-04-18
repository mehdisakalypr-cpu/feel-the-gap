import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { emailMatchConfirmed } from '@/lib/email/marketplace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketplace/[id]/notify-confirmed
 * Idempotent — envoie l'email "match confirmé" aux deux parties si le match
 * est effectivement en statut 'confirmed' et que confirmed_email_sent_at est
 * null. Appelé depuis la UI après accept_match RPC.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: match } = await admin
    .from('marketplace_matches')
    .select(`
      id, status, proposed_total_eur, commission_amount_eur, confirmed_email_sent_at,
      volume:volume_id (producer_id, product_slug, product_label, country_iso),
      demand:demand_id (buyer_id)
    `)
    .eq('id', id)
    .single()

  if (!match) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (match.status !== 'confirmed') {
    return NextResponse.json({ ok: false, skipped: 'not_confirmed', status: match.status })
  }
  if (match.confirmed_email_sent_at) {
    return NextResponse.json({ ok: true, skipped: 'already_sent' })
  }

  const volume = match.volume as unknown as { producer_id: string; product_slug: string; product_label: string | null; country_iso: string | null } | null
  const demand = match.demand as unknown as { buyer_id: string } | null

  // Authorization: seul producer ou buyer peut déclencher
  if (volume?.producer_id !== user.id && demand?.buyer_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const productLabel = volume?.product_label ?? volume?.product_slug ?? '—'
  const countryIso = volume?.country_iso ?? null

  let producerEmail: string | null = null
  let buyerEmail: string | null = null
  if (volume?.producer_id) {
    const { data: p } = await admin.auth.admin.getUserById(volume.producer_id)
    producerEmail = p?.user?.email ?? null
  }
  if (demand?.buyer_id) {
    const { data: b } = await admin.auth.admin.getUserById(demand.buyer_id)
    buyerEmail = b?.user?.email ?? null
  }

  let sent = 0
  if (producerEmail) {
    const ok = await emailMatchConfirmed({
      to: producerEmail, role: 'producer', matchId: id,
      productLabel, countryIso,
      totalEur: Number(match.proposed_total_eur),
      commissionEur: Number(match.commission_amount_eur),
    })
    if (ok) sent++
  }
  if (buyerEmail) {
    const ok = await emailMatchConfirmed({
      to: buyerEmail, role: 'buyer', matchId: id,
      productLabel, countryIso,
      totalEur: Number(match.proposed_total_eur),
      commissionEur: Number(match.commission_amount_eur),
    })
    if (ok) sent++
  }

  if (sent > 0) {
    await admin.from('marketplace_matches')
      .update({ confirmed_email_sent_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true, sent, skipped: sent === 0 ? 'no_email_or_resend_disabled' : null })
}
