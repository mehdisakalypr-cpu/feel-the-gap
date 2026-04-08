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

// POST /api/affiliate/links — get-or-create a tracked link for an offer
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { offer_id } = await req.json()
  if (!offer_id) return NextResponse.json({ error: 'offer_id requis' }, { status: 400 })

  // Verify user has an influencer profile
  const { data: influencer } = await supabase
    .from('influencer_profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!influencer) {
    return NextResponse.json({ error: 'Profil influenceur requis' }, { status: 403 })
  }

  // get-or-create via RPC
  const { data: code, error } = await supabase.rpc('get_or_create_affiliate_link', {
    p_offer_id:      offer_id,
    p_influencer_id: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://feel-the-gap.vercel.app'
  return NextResponse.json({ code, url: `${appUrl}/go/${code}` })
}

// GET /api/affiliate/links — list influencer's links with stats
export async function GET(_req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('affiliate_links')
    .select(`
      id, unique_code, clicks, conversions, total_earned_cents, created_at,
      affiliate_offers(product_name, product_url, commission_pct, category)
    `)
    .eq('influencer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
