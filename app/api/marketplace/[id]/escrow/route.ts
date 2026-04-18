import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/marketplace/[id]/escrow — status check sur un match.
 * Retourne le statut actuel + le stripe_payment_intent_id si existant.
 * Accessible au buyer et au producer du match.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await createSupabaseServer()


  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: match, error } = await sb
    .from('marketplace_matches')
    .select(`
      id, status, match_score, proposed_quantity_kg, proposed_price_eur_per_kg,
      proposed_total_eur, commission_rate_pct, commission_amount_eur,
      stripe_payment_intent_id, escrow_status, escrow_initiated_at, escrow_released_at,
      pod_confirmed_at, pod_notes,
      volume:volume_id (id, producer_id, product_slug, product_label, country_iso),
      demand:demand_id (id, buyer_id, product_slug)
    `)
    .eq('id', id)
    .single()

  if (error || !match) return NextResponse.json({ error: 'match not found' }, { status: 404 })

  // Autorisation : only buyer or producer of this match
  const volume = match.volume as unknown as { producer_id: string } | null
  const demand = match.demand as unknown as { buyer_id: string } | null
  if (volume?.producer_id !== user.id && demand?.buyer_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json(match)
}
