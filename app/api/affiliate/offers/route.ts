import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

// GET /api/affiliate/offers — list active offers (for influencers)
export async function GET(_req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('affiliate_offers')
    .select('id, product_name, product_description, product_url, commission_pct, category, target_geos, target_niches')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/affiliate/offers — create offer (Strategy+ sellers)
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  const allowedTiers = ['standard', 'premium', 'enterprise']
  if (!profile || !allowedTiers.includes(profile.tier)) {
    return NextResponse.json({ error: 'Plan Strategy ou supérieur requis' }, { status: 403 })
  }

  const body = await req.json()
  const { product_name, product_description, product_url, affiliate_base_url, commission_pct, category, target_geos, target_niches } = body

  if (!product_name || !affiliate_base_url || !commission_pct) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('affiliate_offers')
    .insert({
      seller_id: user.id,
      product_name,
      product_description,
      product_url,
      affiliate_base_url,
      commission_pct,
      category,
      target_geos: target_geos ?? [],
      target_niches: target_niches ?? [],
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
