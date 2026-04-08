import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Valid topup amounts in euros
const VALID_AMOUNTS = [10, 20, 50, 75, 100]

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()

    if (!VALID_AMOUNTS.includes(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

    const amountCents = amount * 100

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amountCents,
          product_data: {
            name: `Recharge crédits AI — ${amount} €`,
            description: 'Crédits pour l\'AI Advisor Feel The Gap',
          },
        },
      }],
      metadata: {
        user_id: user.id,
        credit_cents: String(amountCents * 4), // stored at 4x (we bill at cost×4, credits = tokens_cost×4)
        topup_euros: String(amount),
      },
      success_url: `${req.headers.get('origin')}/account?credits_added=1`,
      cancel_url:  `${req.headers.get('origin')}/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[/api/credits/topup]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
