import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// GET /api/catalog/products
//   ?category=food     → filter by category (optional)
//   ?q=chocolat        → search in name/description (optional)
// Returns only products where catalog_opt_in=true and status='active' (via RLS).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const q = searchParams.get('q')?.trim()

    const supabase = await getSupabase()
    let query = supabase
      .from('products_catalog')
      .select('id, name, slug, short_pitch, description, price_eur, currency, category, images, hero_image_url, benefits, ingredients, variants, origin_country, impact_data, commission_pct, platform_pct, influencer_pct, external_url, our_go_code, views_count, saves_count')
      .eq('catalog_opt_in', true)
      .eq('status', 'active')
      .order('saves_count', { ascending: false })
      .limit(200)

    if (category) query = query.eq('category', category)
    if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,short_pitch.ilike.%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Group by category for sidebar
    const byCategory: Record<string, number> = {}
    for (const p of data ?? []) {
      byCategory[p.category] = (byCategory[p.category] ?? 0) + 1
    }

    return NextResponse.json({ products: data ?? [], categories: byCategory })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
