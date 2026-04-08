import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST /api/stripe/portal
// Génère une URL vers le portail Stripe Customer (annulation, factures, CB)
// L'annulation est configurée en cancel_at_period_end=true dans le portail Stripe
export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('REMPLACER')) {
      return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
    }

    // Lire la session Supabase côté serveur
    const cookieStore = await cookies()
    const sbSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await sbSession.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Récupérer le stripe_customer_id
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 404 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

    const body = await req.json().catch(() => ({}))
    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: (body.returnUrl as string) ?? process.env.NEXT_PUBLIC_APP_URL + '/account',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/portal]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
