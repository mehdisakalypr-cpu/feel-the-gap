import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, successUrl, cancelUrl, planLabel } = await req.json()
    // Use authenticated user instead of trusting client-supplied userId/email
    const userId = user.id
    const userEmail = user.email

    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('REMPLACER')) {
      return NextResponse.json({ url: '/pricing' })
    }

    // Récupérer le stripe_customer_id existant si l'utilisateur est connu
    let stripeCustomerId: string | undefined
    if (userId) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
      const { data: profile } = await sb
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
      stripeCustomerId = profile?.stripe_customer_id ?? undefined
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Lier au client existant ou créer avec l'email
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: userEmail }),
      // Métadonnées pour le webhook
      metadata: {
        user_id:    userId    ?? '',
        user_email: userEmail ?? '',
        plan_label: planLabel ?? '',
      },
      subscription_data: {
        metadata: {
          user_id:    userId    ?? '',
          user_email: userEmail ?? '',
          plan_label: planLabel ?? '',
        },
      },
      // Autoriser les promotions Stripe
      allow_promotion_codes: true,
      // Facturation mois en cours + renouvellement auto
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/stripe/checkout]', err)
    return NextResponse.json({ url: '/pricing' })
  }
}
