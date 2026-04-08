import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SEED_TRADE_DATA } from '@/data/seed-trade-data'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ iso: string }> }
) {
  const { iso: isoRaw } = await params
  const iso = isoRaw.toUpperCase()
  const admin = supabaseAdmin()

  // 1. Try trade_flows table (live / collected data)
  const { data: flows } = await admin
    .from('trade_flows')
    .select('product_id, value_usd, quantity, source, year')
    .eq('reporter_iso', iso)
    .eq('flow', 'import')
    .order('value_usd', { ascending: false })
    .limit(50)

  if (flows && flows.length > 0) {
    // Join with products table for names
    const productIds = [...new Set(flows.map((f: any) => f.product_id))]
    const { data: products } = await admin
      .from('products')
      .select('id, name, name_fr, category')
      .in('id', productIds)

    const productMap = new Map((products ?? []).map((p: any) => [p.id, p]))

    // Group by product and sum values
    const grouped = new Map<string, { name: string; category: string; value_usd: number; quantity: number | null; source: string; year: number }>()
    for (const f of flows) {
      const product = productMap.get(f.product_id)
      const name = product?.name ?? f.product_id
      const category = product?.category ?? 'other'
      if (grouped.has(name)) {
        const existing = grouped.get(name)!
        existing.value_usd += f.value_usd ?? 0
        if (f.quantity) existing.quantity = (existing.quantity ?? 0) + f.quantity
      } else {
        grouped.set(name, {
          name,
          category,
          value_usd: f.value_usd ?? 0,
          quantity: f.quantity ?? null,
          source: f.source,
          year: f.year,
        })
      }
    }

    const result = Array.from(grouped.values())
      .sort((a, b) => b.value_usd - a.value_usd)

    return NextResponse.json({ imports: result, source: 'trade_flows' })
  }

  // 2. Fallback to seed data
  const seedEntry = SEED_TRADE_DATA.find(c => c.iso3 === iso)
  if (seedEntry?.top_imports?.length) {
    return NextResponse.json({
      imports: seedEntry.top_imports.map(imp => ({
        name: imp.product,
        category: imp.category,
        value_usd: imp.value_usd,
        quantity: null,
        source: 'seed',
        year: seedEntry.data_year,
      })),
      source: 'seed',
    })
  }

  // 3. No data — return empty
  return NextResponse.json({ imports: [], source: null })
}
