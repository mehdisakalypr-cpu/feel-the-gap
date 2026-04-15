import { NextRequest, NextResponse } from 'next/server'
import {
  adminSupabase, applyPackFilters, anonymizeRow, PUBLIC_COLUMNS,
  type LeadPack,
} from '@/lib/lead-marketplace'

export const runtime = 'nodejs'

// POST /api/leads/preview  { slug }  → { count, rows: [5 anonymised] }
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    const sb = adminSupabase()
    const { data: pack } = await sb.from('lead_packs').select('*')
      .eq('slug', slug).eq('is_active', true).maybeSingle()
    if (!pack) return NextResponse.json({ error: 'pack not found' }, { status: 404 })
    const p = pack as LeadPack
    const cols = PUBLIC_COLUMNS[p.source_table]

    const qCount = sb.from(p.source_table).select('id', { count: 'exact', head: true })
    const { count } = await applyPackFilters(qCount, p.source_table, p.filters, p.verified_only)
    const qRows = sb.from(p.source_table).select(cols.join(','))
    const { data: rows } = await applyPackFilters(qRows, p.source_table, p.filters, p.verified_only).limit(5)
    const masked = ((rows ?? []) as unknown as Record<string, unknown>[]).map((r) => anonymizeRow(r))
    return NextResponse.json({
      count: count ?? 0,
      target_count: p.target_count,
      price_cents: p.price_cents,
      rows: masked,
    })
  } catch (e) {
    console.error('[api/leads/preview]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
