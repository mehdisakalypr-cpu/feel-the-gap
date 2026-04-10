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

// GET /api/influencer/favorites — current user's favorites with product details
export async function GET() {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('influencer_favorites')
      .select('id, notes, created_at, product_id, products_catalog(id, name, slug, hero_image_url, price_eur, category, commission_pct, influencer_pct)')
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ favorites: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/influencer/favorites  body: { product_id, notes? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { product_id, notes } = body as { product_id: string; notes?: string }
    if (!product_id) return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('influencer_favorites')
      .upsert({ influencer_id: user.id, product_id, notes: notes ?? null }, { onConflict: 'influencer_id,product_id' })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Bump saves_count on the product (best-effort, RPC optional)
    try {
      await supabase.rpc('increment_saves_count', { p_product_id: product_id })
    } catch {
      /* RPC may not exist yet, non-critical */
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/influencer/favorites?product_id=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('influencer_favorites')
      .delete()
      .eq('influencer_id', user.id)
      .eq('product_id', productId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
