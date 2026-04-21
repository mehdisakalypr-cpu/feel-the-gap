/**
 * /api/marketplace/matches/[id]/decide — accept | refuse | counter
 * Shaka 2026-04-21 — workflow 4-color matching
 *
 * Body: { action: 'accept' | 'refuse' | 'counter', counter?: { price?, quantity?, message? } }
 *
 * Règles :
 * - Seul le buyer OU le producer (parties au match) peuvent décider
 * - Refuse par l'un → status=rejected (rouge)
 * - Counter par l'un → status=counter_proposed (bleu) + counter_by=role
 * - Accept par un seul → status=accepted_producer OU accepted_buyer
 * - Accept par les deux → status=confirmed (vert) + compute pricing_tier_fee
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function ctx() {
  const store = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await client.auth.getUser()
  return { client, user }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { client, user } = await ctx()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    action?: 'accept' | 'refuse' | 'counter'
    counter?: { price?: number; quantity?: number; message?: string }
  }
  if (!body.action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  // Load match + relations to verify role
  const { data: match, error: loadErr } = await client
    .from('marketplace_matches')
    .select(`
      id, status, proposed_quantity_kg, proposed_price_eur_per_kg, proposed_total_eur,
      volume_id, demand_id,
      producer_decision, buyer_decision,
      production_volumes(producer_id),
      buyer_demands(buyer_id, delivery_country_iso)
    `)
    .eq('id', id)
    .maybeSingle()
  if (loadErr || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const producerId = (match.production_volumes as unknown as { producer_id: string } | null)?.producer_id
  const buyerId = (match.buyer_demands as unknown as { buyer_id: string; delivery_country_iso: string } | null)?.buyer_id
  const buyerCountry = (match.buyer_demands as unknown as { delivery_country_iso: string } | null)?.delivery_country_iso

  const isProducer = user.id === producerId
  const isBuyer = user.id === buyerId
  if (!isProducer && !isBuyer) {
    return NextResponse.json({ error: 'Not a party to this match' }, { status: 403 })
  }

  const role: 'producer' | 'buyer' = isProducer ? 'producer' : 'buyer'
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {}

  if (body.action === 'refuse') {
    patch.status = 'rejected'
    patch[`${role}_decision`] = 'refuse'
    patch[`${role}_decision_at`] = now
  } else if (body.action === 'counter') {
    const c = body.counter ?? {}
    patch.status = 'counter_proposed'
    patch.counter_by = role
    patch.counter_at = now
    patch.counter_message = c.message ?? null
    if (c.price && c.price > 0) {
      patch.counter_price_eur_per_kg = c.price
      patch.counter_quantity_kg = c.quantity ?? match.proposed_quantity_kg
      patch.counter_total_eur = (c.price) * (c.quantity ?? Number(match.proposed_quantity_kg))
    }
    patch[`${role}_decision`] = 'counter'
    patch[`${role}_decision_at`] = now
  } else if (body.action === 'accept') {
    patch[`${role}_decision`] = 'accept'
    patch[`${role}_decision_at`] = now
    // Si l'autre a déjà accept → confirmed, sinon partial
    const otherRole: 'producer' | 'buyer' = role === 'producer' ? 'buyer' : 'producer'
    const otherDecision = (match as Record<string, unknown>)[`${otherRole}_decision`]
    if (otherDecision === 'accept') {
      patch.status = 'confirmed'
      patch.accepted_at = now
      // Calcul fee adjusted PPP buyer country
      const { data: feeRow } = await client.rpc('marketplace_tier_fee_adjusted_cents' as never, {
        total_eur: match.proposed_total_eur, country_iso: buyerCountry ?? null,
      }) as { data: number | null }
      const { data: labelRow } = await client.rpc('marketplace_tier_label' as never, {
        total_eur: match.proposed_total_eur,
      }) as { data: string | null }
      if (feeRow !== null) patch.pricing_tier_fee_eur = feeRow
      if (labelRow !== null) patch.pricing_tier_label = labelRow
    } else {
      patch.status = role === 'producer' ? 'accepted_producer' : 'accepted_buyer'
    }
  }

  const { error: updErr } = await client
    .from('marketplace_matches')
    .update(patch)
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, new_status: patch.status ?? match.status, role })
}
