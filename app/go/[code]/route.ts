import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://feel-the-gap.vercel.app'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  // ── User referral codes (U-XXXXXX) ──────────────────────────────────────
  if (code.startsWith('U-')) {
    const { data: row } = await supabase
      .from('user_referral_codes')
      .select('user_id, unique_code')
      .eq('unique_code', code)
      .maybeSingle()

    if (!row) {
      console.warn('[/go] unknown user referral code', code)
      return NextResponse.redirect(FALLBACK_URL)
    }

    // Increment clicks (non-blocking)
    supabase
      .from('user_referral_codes')
      .update({ clicks: ((row as { clicks?: number }).clicks ?? 0) + 1 })
      .eq('unique_code', code)
      .then(() => {})

    const res = NextResponse.redirect(`${FALLBACK_URL}/?ref=${encodeURIComponent(code)}`, { status: 302 })
    res.cookies.set('ftg_ref', JSON.stringify({ code, ts: Date.now() }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return res
  }

  // ── Legacy affiliate links ───────────────────────────────────────────────
  const { data: link, error } = await supabase
    .from('affiliate_links')
    .select('id, affiliate_offers(affiliate_base_url, status)')
    .eq('unique_code', code)
    .single()

  if (error || !link) {
    console.warn('[/go] unknown code', code)
    return NextResponse.redirect(FALLBACK_URL)
  }

  const offer = (Array.isArray(link.affiliate_offers) ? link.affiliate_offers[0] : link.affiliate_offers) as { affiliate_base_url: string; status: string } | null

  if (!offer || offer.status !== 'active') {
    console.warn('[/go] offer inactive or missing for code', code)
    return NextResponse.redirect(`${FALLBACK_URL}/map`)
  }

  supabase.rpc('increment_affiliate_clicks', { p_link_id: link.id }).then(({ error: e }) => {
    if (e) console.error('[/go] click increment failed', e.message)
  })

  return NextResponse.redirect(offer.affiliate_base_url, { status: 302 })
}
