import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/funding/dossier/[id]/offers-received
// Returns all offers (funding + investor) received on a dossier owned by the caller.
// Uses the dossier_offers_received() RPC which enforces the owner check.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership up-front so we return a clean 403 rather than empty list.
  const { data: dossier } = await sb
    .from('funding_dossiers').select('user_id, public_number, type, country_iso, amount_eur, title, status')
    .eq('id', id).maybeSingle()
  if (!dossier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dossier.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await sb.rpc('dossier_offers_received', { p_dossier: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    dossier: {
      id,
      public_number: dossier.public_number,
      type: dossier.type,
      country_iso: dossier.country_iso,
      amount_eur: dossier.amount_eur,
      title: dossier.title,
      status: dossier.status,
    },
    offers: data ?? [],
  })
}
