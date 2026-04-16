import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

// GET /api/stripe/invoices?limit=10&starting_after=inv_xxx
export async function GET(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey || stripeKey.includes('REMPLACER')) {
      return NextResponse.json({ invoices: [], has_more: false, error: 'stripe_not_configured' })
    }

    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    const { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ invoices: [], has_more: false })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)
    const startingAfter = searchParams.get('starting_after') || undefined

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })

    const list = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })

    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      amount_paid: inv.amount_paid,
      amount_due: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description: inv.lines?.data?.[0]?.description ?? null,
    }))

    return NextResponse.json({ invoices, has_more: list.has_more })
  } catch (err) {
    console.error('[/api/stripe/invoices]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
