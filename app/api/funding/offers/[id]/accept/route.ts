import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// POST /api/funding/offers/[id]/accept?kind=funding|investor
// Called by the entrepreneur (dossier owner) to accept an offer.
// Uses the accept_offer_atomic RPC — consumes investor's quota or 1 extra_credit.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') ?? 'funding'
    if (kind !== 'funding' && kind !== 'investor') {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify caller owns the dossier linked to this offer
    const table = kind === 'funding' ? 'funding_offers' : 'investor_offers'
    const { data: offer, error: oerr } = await sb
      .from(table)
      .select('id, dossier_id, status')
      .eq('id', id)
      .maybeSingle()
    if (oerr) return NextResponse.json({ error: oerr.message }, { status: 500 })
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const { data: dossier } = await sb
      .from('funding_dossiers')
      .select('user_id')
      .eq('id', offer.dossier_id)
      .single()
    if (!dossier || dossier.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden — only the dossier owner can accept' }, { status: 403 })
    }

    const { error: rpcError } = await sb.rpc('accept_offer_atomic', { p_offer_id: id, p_offer_kind: kind })
    if (rpcError) {
      if (rpcError.message?.includes('quota_exhausted')) {
        return NextResponse.json({ error: 'Investor quota exhausted' }, { status: 409 })
      }
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    // Mark dossier as matched
    await sb
      .from('funding_dossiers')
      .update({ status: 'matched' })
      .eq('id', offer.dossier_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
