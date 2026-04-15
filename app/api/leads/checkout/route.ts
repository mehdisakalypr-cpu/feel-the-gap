import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase-server'
import { adminSupabase, type LeadPack } from '@/lib/lead-marketplace'

export const runtime = 'nodejs'

// POST /api/leads/checkout  { slug } → { url }
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise', redirect: '/auth/login' }, { status: 401 })
    }
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })
    const sb = adminSupabase()
    const { data: pack } = await sb.from('lead_packs').select('*').eq('slug', slug).eq('is_active', true).maybeSingle()
    if (!pack) return NextResponse.json({ error: 'pack not found' }, { status: 404 })
    const p = pack as LeadPack

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'
    const successUrl = `${appUrl}/account/purchases?success=1&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl  = `${appUrl}/data/leads/${slug}?canceled=1`

    const stripeKey = process.env.STRIPE_SECRET_KEY
    const isMock = !stripeKey || stripeKey.includes('REMPLACER')

    // Mock flow : on simule la session en créant direct la purchase "paid"
    if (isMock) {
      const mockSession = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const { data: purchase, error } = await sb.from('lead_purchases').insert({
        user_id: user.id,
        user_email: user.email,
        pack_id: p.id,
        pack_slug: p.slug,
        pack_title: p.title,
        stripe_session_id: mockSession,
        amount_cents: p.price_cents,
        currency: p.currency,
        status: 'paid',
        filters_snapshot: p.filters,
      }).select().single()
      if (error) {
        console.error('[leads/checkout] mock insert error', error)
        return NextResponse.json({ error: 'mock failed' }, { status: 500 })
      }
      // Fire-and-forget fulfill
      fetch(`${appUrl}/api/leads/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.LEADS_INTERNAL_TOKEN || 'mock',
        },
        body: JSON.stringify({ purchase_id: purchase.id }),
      }).catch(() => {})
      return NextResponse.json({ url: `${appUrl}/account/purchases?success=1&mock=1&pid=${purchase.id}`, mock: true })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey!, { apiVersion: '2025-03-31.basil' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: p.currency.toLowerCase(),
          unit_amount: p.price_cents,
          product_data: {
            name: p.title,
            description: p.subtitle ?? `${p.target_count} leads B2B`,
          },
        },
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email ?? undefined,
      metadata: {
        type: 'lead_pack',
        pack_id: p.id,
        pack_slug: p.slug,
        user_id: user.id,
        user_email: user.email ?? '',
      },
    })
    // Crée la purchase en pending
    await sb.from('lead_purchases').insert({
      user_id: user.id,
      user_email: user.email,
      pack_id: p.id,
      pack_slug: p.slug,
      pack_title: p.title,
      stripe_session_id: session.id,
      amount_cents: p.price_cents,
      currency: p.currency,
      status: 'pending',
      filters_snapshot: p.filters,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[api/leads/checkout]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
