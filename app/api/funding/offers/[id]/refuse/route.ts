import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

type ReasonCode = 'ticket_too_low' | 'valuation_unfit' | 'not_aligned' | 'timing' | 'terms_unfavorable' | 'other'
const VALID_REASONS: ReasonCode[] = ['ticket_too_low', 'valuation_unfit', 'not_aligned', 'timing', 'terms_unfavorable', 'other']

// POST /api/funding/offers/[id]/refuse?kind=funding|investor
// Body: { reason_code: ReasonCode, reason_text?: string }
// Refuses an offer with justification. Calls refuse_offer RPC — increments dossier refusal_count,
// flags dossier for admin review at 3+ refusals.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind') ?? 'funding'
    if (kind !== 'funding' && kind !== 'investor') {
      return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
    }

    const body = await req.json().catch(() => null) as { reason_code?: string; reason_text?: string } | null
    if (!body?.reason_code || !VALID_REASONS.includes(body.reason_code as ReasonCode)) {
      return NextResponse.json({ error: 'reason_code required' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const table = kind === 'funding' ? 'funding_offers' : 'investor_offers'
    const { data: offer } = await sb.from(table).select('dossier_id').eq('id', id).maybeSingle()
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const { data: dossier } = await sb
      .from('funding_dossiers')
      .select('user_id')
      .eq('id', offer.dossier_id)
      .single()
    if (!dossier || dossier.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden — only the dossier owner can refuse' }, { status: 403 })
    }

    const { error: rpcError } = await sb.rpc('refuse_offer', {
      p_offer_id: id,
      p_offer_kind: kind,
      p_reason_code: body.reason_code,
      p_reason_text: (body.reason_text ?? '').slice(0, 500) || null,
    })
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
