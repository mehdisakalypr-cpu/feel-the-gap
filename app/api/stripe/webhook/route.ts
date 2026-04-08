import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const TIER_MAP: Record<number, string> = {
  2900:  'data',
  9900:  'strategy',
  14900: 'premium',
}

function getTier(amountCents: number): string {
  return TIER_MAP[amountCents] ?? (amountCents <= 2900 ? 'data' : amountCents <= 9900 ? 'strategy' : 'premium')
}

const TIER_LABELS: Record<string, string> = {
  data:     'Data — 29 €/mois',
  strategy: 'Strategy — 99 €/mois',
  premium:  'Premium — 149 €/mois',
  explorer: 'Explorer (gratuit)',
}

// ── Email helper ──────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || !to) return
  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from:    'Feel The Gap <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
  } catch (err) {
    console.error('[webhook] email error', err)
  }
}

function emailBase(content: string) {
  return `
<div style="font-family:system-ui,sans-serif;background:#07090F;color:#e2e8f0;padding:40px 32px;max-width:600px;margin:0 auto">
  <div style="margin-bottom:24px">
    <span style="color:#3B82F6;font-weight:800;font-size:18px;letter-spacing:.04em">Feel The Gap</span>
  </div>
  ${content}
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.3)">
    Feel The Gap · <a href="https://feel-the-gap.vercel.app" style="color:#3B82F6;text-decoration:none">feel-the-gap.vercel.app</a>
  </div>
</div>`
}

// ── Revenue pipeline ──────────────────────────────────────────────────────────
async function trackRevenue(params: {
  id: string; event_type: string; stripe_event_id: string;
  customer_id?: string; user_id?: string; email?: string;
  amount_eur?: number; plan?: string; interval?: string;
  metadata?: Record<string, unknown>
}) {
  await supabaseAdmin.from('revenue_events').upsert({
    id:              params.id,
    product:         'feel-the-gap',
    stripe_event_id: params.stripe_event_id,
    event_type:      params.event_type,
    customer_id:     params.customer_id ?? null,
    user_id:         params.user_id     ?? null,
    email:           params.email       ?? null,
    amount_eur:      params.amount_eur  ?? 0,
    plan:            params.plan        ?? null,
    interval:        params.interval    ?? null,
    metadata:        params.metadata    ?? {},
    created_at:      new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true })
}

// ── GET /api/stripe/webhook — test ────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Stripe webhook endpoint actif' })
}

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const stripeKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const Stripe  = (await import('stripe')).default
  const stripe  = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
  const body    = await req.text()
  const sig     = req.headers.get('stripe-signature')!

  let event: import('stripe').Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] signature invalide', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── checkout.session.completed ───────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object as import('stripe').Stripe.Checkout.Session
    const userId     = session.metadata?.user_id
    const userEmail  = session.metadata?.user_email ?? session.customer_details?.email ?? ''
    const planLabel  = session.metadata?.plan_label ?? ''
    const creditCents= Number(session.metadata?.credit_cents ?? 0)

    // Recharge crédits IA
    if (userId && creditCents > 0) {
      await supabaseAdmin.rpc('add_ai_credits', {
        p_user_id:      userId,
        p_amount_cents: creditCents,
        p_description:  `Recharge ${session.metadata?.topup_euros} €`,
      })
      await sendEmail(userEmail, '✅ Vos crédits IA ont été rechargés — Feel The Gap',
        emailBase(`
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Recharge confirmée</h2>
          <p style="color:rgba(255,255,255,.7);line-height:1.6">
            Votre recharge de <strong style="color:#fff">${session.metadata?.topup_euros} €</strong> a bien été prise en compte.<br>
            Vos crédits IA sont disponibles immédiatement.
          </p>`))
      return NextResponse.json({ received: true })
    }

    // Nouvel abonnement
    if (session.mode === 'subscription') {
      const subscriptionId = session.subscription as string
      const customerId     = session.customer as string
      const amountTotal    = session.amount_total ?? 0
      const tier           = getTier(amountTotal)

      if (userId) {
        await supabaseAdmin.from('profiles').update({
          tier,
          stripe_customer_id:     customerId,
          stripe_subscription_id: subscriptionId,
        }).eq('id', userId)
      }

      await trackRevenue({
        id: `checkout_${session.id}`, event_type: 'subscription_created',
        stripe_event_id: event.id, customer_id: customerId, user_id: userId,
        email: userEmail, amount_eur: amountTotal / 100, plan: tier, interval: 'month',
      })

      await sendEmail(userEmail,
        `✅ Bienvenue sur Feel The Gap ${planLabel} !`,
        emailBase(`
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Abonnement activé</h2>
          <p style="color:rgba(255,255,255,.7);line-height:1.6">
            Votre abonnement <strong style="color:#3B82F6">${planLabel}</strong> est maintenant actif.<br>
            Vous serez facturé chaque mois. Vous pouvez gérer votre abonnement depuis votre espace compte.
          </p>
          <div style="margin:20px 0;padding:16px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:8px">
            <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:4px">PLAN SOUSCRIT</div>
            <div style="font-size:16px;font-weight:700;color:#3B82F6">${TIER_LABELS[tier] ?? planLabel}</div>
          </div>
          <p style="font-size:13px;color:rgba(255,255,255,.4)">
            ℹ️ En cas de résiliation, vous conservez l'accès jusqu'à la fin de la période en cours déjà facturée.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/account" style="display:inline-block;margin-top:16px;background:#3B82F6;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
            Accéder à mon espace →
          </a>`))
    }
  }

  // ── invoice.paid — renouvellement mensuel ────────────────────────────────
  if (event.type === 'invoice.paid') {
    const inv    = event.data.object as import('stripe').Stripe.Invoice
    const invAny = inv as unknown as Record<string, unknown>
    const sub    = invAny['subscription'] as string | undefined
    const lines  = invAny['lines'] as { data?: Array<{ plan?: { interval?: string; amount?: number }; period?: { end?: number } }> } | undefined
    const line   = lines?.data?.[0]
    const interval  = line?.plan?.interval ?? 'month'
    const periodEnd = line?.period?.end

    // Ne pas envoyer d'email pour le premier paiement (déjà couvert par checkout.completed)
    const isFirst = (inv as unknown as { billing_reason?: string }).billing_reason === 'subscription_create'
    if (!isFirst && inv.customer_email) {
      const renewDate = periodEnd ? new Date(periodEnd * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      await sendEmail(inv.customer_email,
        '🔄 Votre abonnement Feel The Gap a été renouvelé',
        emailBase(`
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Renouvellement confirmé</h2>
          <p style="color:rgba(255,255,255,.7);line-height:1.6">
            Votre abonnement a été renouvelé avec succès.<br>
            Montant prélevé : <strong style="color:#fff">${((inv.amount_paid ?? 0) / 100).toFixed(2)} €</strong>
            ${renewDate ? `<br>Prochain renouvellement : <strong style="color:#fff">${renewDate}</strong>` : ''}
          </p>`))
    }

    await trackRevenue({
      id: `invoice_${inv.id}`, event_type: 'invoice_paid',
      stripe_event_id: event.id,
      customer_id: typeof inv.customer === 'string' ? inv.customer : undefined,
      email: inv.customer_email ?? undefined,
      amount_eur: (inv.amount_paid ?? 0) / 100, interval,
      metadata: { subscription_id: sub },
    })
  }

  // ── customer.subscription.updated — annulation programmée ───────────────
  if (event.type === 'customer.subscription.updated') {
    const sub  = event.data.object as import('stripe').Stripe.Subscription
    const prev = event.data.previous_attributes as Record<string, unknown>

    // Annulation programmée (cancel_at_period_end vient de passer à true)
    if (sub.cancel_at_period_end && !prev?.cancel_at_period_end) {
      const subAny  = sub as unknown as { current_period_end?: number }
      const endDate = subAny.current_period_end
        ? new Date(subAny.current_period_end * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : ''

      // Retrouver l'email depuis le customer
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
      let email = ''
      try {
        const customer = await stripe.customers.retrieve(sub.customer as string)
        if (!customer.deleted) email = (customer as import('stripe').Stripe.Customer).email ?? ''
      } catch { /* noop */ }

      if (email) {
        await sendEmail(email,
          '📋 Résiliation de votre abonnement Feel The Gap confirmée',
          emailBase(`
            <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Résiliation enregistrée</h2>
            <p style="color:rgba(255,255,255,.7);line-height:1.6">
              Votre demande de résiliation a bien été prise en compte.<br><br>
              <strong style="color:#fff">Vous conservez l'accès à toutes les fonctionnalités de votre offre jusqu'au ${endDate}.</strong><br>
              Aucun remboursement n'est effectué pour la période en cours déjà facturée.
            </p>
            <div style="margin:20px 0;padding:16px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px">
              <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:4px">FIN D'ACCÈS PRÉVUE</div>
              <div style="font-size:16px;font-weight:700;color:#EF4444">${endDate}</div>
            </div>
            <p style="font-size:13px;color:rgba(255,255,255,.4)">
              Vous pouvez vous réabonner à tout moment depuis votre espace compte.
            </p>`))
      }

      await trackRevenue({
        id: `cancel_request_${sub.id}_${event.created}`, event_type: 'subscription_cancel_requested',
        stripe_event_id: event.id,
        customer_id: typeof sub.customer === 'string' ? sub.customer : undefined,
        metadata: { end_date: endDate, sub_id: sub.id },
      })
    }

    // Downgrade / problème de paiement
    if (prev?.status === 'active' && sub.status !== 'active' && !sub.cancel_at_period_end) {
      await trackRevenue({
        id: `downgrade_${sub.id}_${event.created}`, event_type: 'subscription_downgraded',
        stripe_event_id: event.id,
        customer_id: typeof sub.customer === 'string' ? sub.customer : undefined,
        metadata: { new_status: sub.status },
      })
    }
  }

  // ── customer.subscription.deleted — fin effective ────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as import('stripe').Stripe.Subscription

    // Rétrograder au plan gratuit
    await supabaseAdmin
      .from('profiles')
      .update({ tier: 'explorer', stripe_subscription_id: null })
      .eq('stripe_subscription_id', sub.id)

    // Email de fin
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
    let email = ''
    try {
      const customer = await stripe.customers.retrieve(sub.customer as string)
      if (!customer.deleted) email = (customer as import('stripe').Stripe.Customer).email ?? ''
    } catch { /* noop */ }

    if (email) {
      await sendEmail(email,
        '👋 Votre abonnement Feel The Gap est terminé',
        emailBase(`
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Abonnement expiré</h2>
          <p style="color:rgba(255,255,255,.7);line-height:1.6">
            Votre abonnement Feel The Gap est arrivé à expiration.<br>
            Votre compte est maintenant en plan gratuit <strong style="color:#fff">Explorer</strong>.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display:inline-block;margin-top:16px;background:rgba(59,130,246,.15);color:#3B82F6;border:1px solid rgba(59,130,246,.3);padding:12px 24px;text-decoration:none;font-weight:700;border-radius:8px">
            Se réabonner →
          </a>`))
    }

    await trackRevenue({
      id: `churn_${sub.id}`, event_type: 'subscription_cancelled',
      stripe_event_id: event.id,
      customer_id: typeof sub.customer === 'string' ? sub.customer : undefined,
      metadata: { reason: sub.cancellation_details?.reason ?? 'unknown' },
    })
  }

  return NextResponse.json({ received: true })
}
