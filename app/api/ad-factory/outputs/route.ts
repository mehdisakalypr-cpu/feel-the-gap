import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public read endpoint — sert la liste des formats d'un variant Ad Factory
 * pour embed cross-site (utilisé par <AdFactoryVideo />).
 */
export async function GET(req: NextRequest) {
  const variantId = new URL(req.url).searchParams.get('variant_id')
  if (!variantId) return NextResponse.json({ error: 'variant_id required' }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb
    .from('ftg_ad_outputs')
    .select('aspect_ratio, resolution, url, format_kind, duration_s, file_size_bytes')
    .eq('variant_id', variantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, outputs: data ?? [] }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' },
  })
}
