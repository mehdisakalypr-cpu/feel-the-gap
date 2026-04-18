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

  // ── Cross-product routing guard ───────────────────────────────────────────
  // The same Stripe account can be shared by multiple products (FTG, OFA, …).
  // If an event carries metadata.product for a product other than FTG, we
  // early-return 200 so the other product's webhook can handle it without
  // producing noise here. Legacy events without metadata.product fall through.
  const FTG_PRODUCTS = new Set(['ftg', 'feel-the-gap', 'feelthegap'])
  function extractProduct(ev: typeof event): string | null {
    const obj = ev.data.object as unknown as { metadata?: Record<string, string> | null }
    const p = obj?.metadata?.product
    return typeof p === 'string' && p.length > 0 ? p.toLowerCase() : null
  }
  const product = extractProduct(event)
  if (product && !FTG_PRODUCTS.has(product)) {
    console.log(`[webhook] skip event=${event.type} product=${product} (not FTG)`)
    return NextResponse.json({ received: true, skipped: true, product })
  }

  // ── checkout.session.completed ───────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object as import('stripe').Stripe.Checkout.Session
    const userId     = session.metadata?.user_id
    const userEmail  = session.metadata?.user_email ?? session.customer_details?.email ?? ''
    const planLabel  = session.metadata?.plan_label ?? ''
    const creditCents= Number(session.metadata?.credit_cents ?? 0)

    // ── V2 credit quota: pack one-shot ───────────────────────────────────
    if (session.metadata?.kind === 'credit_pack' && userId) {
      const packSize = Number(session.metadata.pack_size || 0)
      const PACK_PRICES: Record<number, number> = { 10: 12, 20: 22, 30: 30, 50: 45 }
      const price = PACK_PRICES[packSize] ?? (session.amount_total ?? 0) / 100
      if (packSize > 0) {
        await supabaseAdmin.from('user_credits_topup').insert({
          user_id: userId,
          balance: packSize,
          initial_qty: packSize,
          pack_size: packSize,
          pack_price_eur: price,
          stripe_payment_id: (session.payment_intent as string) ?? session.id,
        })
      }
      return NextResponse.json({ ok: true, kind: 'credit_pack_applied', packSize })
    }

    // ── V2 credit quota: subscription starter/premium ─────────────────────
    if (session.metadata?.kind === 'subscription' && userId) {
      const plan = session.metadata.plan as 'starter' | 'premium' | undefined
      const GRANTS: Record<string, number> = { starter: 60, premium: 120 }
      const grant = plan ? GRANTS[plan] : 0
      if (plan && grant) {
        await supabaseAdmin.from('user_credits_subscription').upsert({
          user_id: userId,
          plan,
          balance: grant,
          monthly_grant: grant,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }
      return NextResponse.json({ ok: true, kind: 'subscription_applied', plan })
    }

    // Lead pack one-shot
    if (session.metadata?.type === 'lead_pack') {
      const packId = session.metadata?.pack_id
      const sessionId = session.id
      // Update purchase to paid
      await supabaseAdmin.from('lead_purchases').update({
        status: 'paid',
        stripe_payment_intent: (session.payment_intent as string) ?? null,
      }).eq('stripe_session_id', sessionId)
      // Retrouve la purchase
      const { data: purchase } = await supabaseAdmin.from('lead_purchases')
        .select('id').eq('stripe_session_id', sessionId).maybeSingle()
      if (purchase) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://feel-the-gap.vercel.app'
        // Trigger fulfill
        fetch(`${appUrl}/api/leads/fulfill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': process.env.LEADS_INTERNAL_TOKEN || 'mock',
          },
          body: JSON.stringify({ purchase_id: purchase.id }),
        }).catch(err => console.error('[webhook] fulfill trigger error', err))
      }
      await trackRevenue({
        id: `lead_pack_${sessionId}`, event_type: 'lead_pack_purchase',
        stripe_event_id: event.id, user_id: userId, email: userEmail,
        amount_eur: (session.amount_total ?? 0) / 100,
        metadata: { pack_id: packId, pack_slug: session.metadata?.pack_slug },
      })
      return NextResponse.json({ received: true })
    }

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

      // ── Referral attribution ─────────────────────────────────────────
      const referrerId = session.metadata?.referrer_id
      if (referrerId && userId && subscriptionId) {
        try {
          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
          // 1 month 100% off coupon for the referee
          const coupon = await stripe.coupons.create({
            percent_off: 100,
            duration: 'once',
            name: `Referral reward — 1 month free`,
            metadata: { referrer_id: referrerId, referee_id: userId },
          })
          await stripe.subscriptions.update(subscriptionId, {
            discounts: [{ coupon: coupon.id }],
          })
          // Bonus month for referrer
          try {
            const { error: rpcErr } = await supabaseAdmin.rpc('add_bonus_month_credit', { p_user: referrerId })
            if (rpcErr) throw rpcErr
          } catch {
            // Fallback: direct SQL if RPC doesn't exist — increment profiles.bonus_months_credit
            const { data: prof } = await supabaseAdmin
              .from('profiles').select('bonus_months_credit').eq('id', referrerId).maybeSingle()
            await supabaseAdmin.from('profiles')
              .update({ bonus_months_credit: (prof?.bonus_months_credit ?? 0) + 1 })
              .eq('id', referrerId)
          }
          // Update referral row
          await supabaseAdmin.from('user_referrals')
            .update({
              status: 'converted',
              stripe_subscription_id: subscriptionId,
              first_paid_at: new Date().toISOString(),
            })
            .eq('referee_id', userId)
          // Counters
          const { data: codeRow } = await supabaseAdmin
            .from('user_referral_codes')
            .select('conversions, bonus_months_earned')
            .eq('user_id', referrerId)
            .maybeSingle()
          await supabaseAdmin.from('user_referral_codes').update({
            conversions: (codeRow?.conversions ?? 0) + 1,
            bonus_months_earned: (codeRow?.bonus_months_earned ?? 0) + 1,
          }).eq('user_id', referrerId)
        } catch (e) {
          console.error('[webhook] referral attribution failed', e)
        }
      }

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

  // ── V2: subscription renewal — reset crédits mensuels ────────────────────
  if (event.type === 'invoice.paid') {
    const inv = event.data.object as import('stripe').Stripe.Invoice
    const customerId = inv.customer as string
    if (customerId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
      if (profile?.id) {
        await supabaseAdmin.rpc('renew_subscription_credits', { p_user_id: profile.id })
      }
    }
    // ... fallthrough to legacy logic
  }

  // ── invoice.paid — renouvellement mensuel (legacy) ───────────────────────
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

    // ── Referral recurring share (20%) ──────────────────────────────────
    try {
      if (!isFirst && sub && inv.amount_paid && inv.amount_paid > 0) {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' })
        const subObj = await stripe.subscriptions.retrieve(sub)
        const referrerId = subObj.metadata?.referrer_id
        if (referrerId) {
          const share = Math.floor((inv.amount_paid ?? 0) * 0.20)
          if (share > 0) {
            // Dedupe by invoice id
            const { data: existing } = await supabaseAdmin
              .from('user_referral_earnings')
              .select('id')
              .eq('stripe_invoice_id', inv.id!)
              .maybeSingle()
            if (!existing) {
              // Lookup referrer customer id for balance tx
              const { data: refProfile } = await supabaseAdmin
                .from('profiles')
                .select('stripe_customer_id')
                .eq('id', referrerId)
                .maybeSingle()

              let applied = false
              if (refProfile?.stripe_customer_id) {
                try {
                  await stripe.customers.createBalanceTransaction(refProfile.stripe_customer_id, {
                    amount: -share,
                    currency: inv.currency ?? 'eur',
                    description: `Referral share 20% — invoice ${inv.id}`,
                  })
                  applied = true
                } catch (e) {
                  console.error('[webhook] referrer balance tx failed', e)
                }
              }

              // Find referral row id for FK
              const { data: refRow } = await supabaseAdmin
                .from('user_referrals')
                .select('id')
                .eq('stripe_subscription_id', sub)
                .maybeSingle()

              await supabaseAdmin.from('user_referral_earnings').insert({
                referral_id: refRow?.id ?? null,
                referrer_id: referrerId,
                stripe_invoice_id: inv.id,
                amount_cents: share,
                currency: inv.currency ?? 'eur',
                applied_to_balance: applied,
              })

              // Bump cumulative counter
              const { data: codeRow } = await supabaseAdmin
                .from('user_referral_codes')
                .select('recurring_credit_cents')
                .eq('user_id', referrerId)
                .maybeSingle()
              await supabaseAdmin.from('user_referral_codes').update({
                recurring_credit_cents: (codeRow?.recurring_credit_cents ?? 0) + share,
              }).eq('user_id', referrerId)
            }
          }
        }
      }
    } catch (e) {
      console.error('[webhook] referral share failed', e)
    }
  }

  // ── customer.subscription.created — sync Fill the Gap quota ─────────────
  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object as import('stripe').Stripe.Subscription
    const plan = sub.metadata?.plan ?? 'free'
    const userId = sub.metadata?.user_id
    if (userId && ['free','solo_producer','starter','strategy','premium','ultimate','custom'].includes(plan)) {
      try {
        await supabaseAdmin.rpc('sync_fillthegap_quota', { p_user_id: userId, p_plan: plan })
        console.log(`[stripe-webhook] Fill the Gap quota synced for ${userId} → ${plan}`)
      } catch (err) {
        console.error(`[stripe-webhook] Failed to sync FtG quota for ${userId}:`, err)
        // Do NOT throw — sub update is primary, quota is secondary
      }
    }
  }

  // ── customer.subscription.updated — annulation programmée ───────────────
  if (event.type === 'customer.subscription.updated') {
    const sub  = event.data.object as import('stripe').Stripe.Subscription
    const prev = event.data.previous_attributes as Record<string, unknown>

    // After successful subscription sync/tier update, sync the Fill the Gap quota
    const prevMeta = prev?.metadata as Record<string, string> | undefined
    const plan = sub.metadata?.plan ?? prevMeta?.plan ?? 'free'
    const userId = sub.metadata?.user_id
    if (userId && ['free','solo_producer','starter','strategy','premium','ultimate','custom'].includes(plan)) {
      try {
        await supabaseAdmin.rpc('sync_fillthegap_quota', { p_user_id: userId, p_plan: plan })
        console.log(`[stripe-webhook] Fill the Gap quota synced for ${userId} → ${plan}`)
      } catch (err) {
        console.error(`[stripe-webhook] Failed to sync FtG quota for ${userId}:`, err)
        // Do NOT throw — sub update is primary, quota is secondary
      }
    }

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

    // Revert to free plan → quota zeroed on next reset
    const deletedUserId = sub.metadata?.user_id
    if (deletedUserId) {
      try {
        await supabaseAdmin.rpc('sync_fillthegap_quota', { p_user_id: deletedUserId, p_plan: 'free' })
      } catch { /* quota sync secondary — swallow */ }
    }

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

  // ── account.updated — Connect onboarding status (KYC, payouts) ──────────
  if (event.type === 'account.updated') {
    const acct = event.data.object as import('stripe').Stripe.Account
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_connect_charges_enabled: acct.charges_enabled,
        stripe_connect_payouts_enabled: acct.payouts_enabled,
        stripe_connect_details_submitted: acct.details_submitted,
        stripe_connect_updated_at: new Date().toISOString(),
      })
      .eq('stripe_connect_account_id', acct.id)
    if (profErr) {
      console.error('[webhook] account.updated profile sync failed', profErr.message, 'acct:', acct.id)
    }
  }

  // ── payment_intent.succeeded — escrow capturé, release côté buyer OK ────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as import('stripe').Stripe.PaymentIntent
    const matchId = pi.metadata?.match_id
    if (matchId) {
      const { error: upErr } = await supabaseAdmin
        .from('marketplace_matches')
        .update({
          escrow_status: 'released',
          escrow_released_at: new Date().toISOString(),
        })
        .eq('id', matchId)
        .neq('escrow_status', 'released') // idempotent : ne pas réécrire si déjà release
      if (upErr) {
        console.error('[webhook] pi.succeeded match update failed', upErr.message, 'match:', matchId)
      }
      await trackRevenue({
        id: `escrow_released_${pi.id}`, event_type: 'marketplace_escrow_released',
        stripe_event_id: event.id,
        amount_eur: (pi.amount_received ?? 0) / 100,
        metadata: {
          match_id: matchId,
          producer_id: pi.metadata?.producer_id ?? null,
          buyer_id: pi.metadata?.buyer_id ?? null,
          commission_eur: (pi.application_fee_amount ?? 0) / 100,
          product_slug: pi.metadata?.product_slug ?? null,
          country_iso: pi.metadata?.country_iso ?? null,
        },
      })

      // ── Email escrow_released (idempotent via released_email_sent_at) ──
      try {
        const { data: matchRow } = await supabaseAdmin
          .from('marketplace_matches')
          .select(`
            id, released_email_sent_at,
            volume:volume_id (producer_id, product_slug, product_label),
            demand:demand_id (buyer_id)
          `)
          .eq('id', matchId)
          .single()
        if (matchRow && !matchRow.released_email_sent_at) {
          const { emailEscrowReleased } = await import('@/lib/email/marketplace')
          const vol = matchRow.volume as unknown as { producer_id: string; product_slug: string; product_label: string | null } | null
          const dem = matchRow.demand as unknown as { buyer_id: string } | null
          const productLabel = vol?.product_label ?? vol?.product_slug ?? '—'
          const amountEur = (pi.amount_received ?? 0) / 100
          const commissionEur = (pi.application_fee_amount ?? 0) / 100

          let sent = 0
          if (vol?.producer_id) {
            const { data: p } = await supabaseAdmin.auth.admin.getUserById(vol.producer_id)
            if (p?.user?.email) {
              const ok = await emailEscrowReleased({
                to: p.user.email, role: 'producer', matchId,
                productLabel, amountEur, commissionEur, paymentIntentId: pi.id,
              })
              if (ok) sent++
            }
          }
          if (dem?.buyer_id) {
            const { data: b } = await supabaseAdmin.auth.admin.getUserById(dem.buyer_id)
            if (b?.user?.email) {
              const ok = await emailEscrowReleased({
                to: b.user.email, role: 'buyer', matchId,
                productLabel, amountEur, commissionEur, paymentIntentId: pi.id,
              })
              if (ok) sent++
            }
          }
          if (sent > 0) {
            await supabaseAdmin.from('marketplace_matches')
              .update({ released_email_sent_at: new Date().toISOString() })
              .eq('id', matchId)
          }
        }
      } catch (e) {
        console.error('[webhook] escrow_released email failed', e)
      }
    }
  }

  // ── payment_intent.canceled / payment_failed — escrow annulé ou KO ──────
  if (event.type === 'payment_intent.canceled' || event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as import('stripe').Stripe.PaymentIntent
    const matchId = pi.metadata?.match_id
    if (matchId) {
      const newStatus = event.type === 'payment_intent.canceled' ? 'canceled' : 'failed'
      const { error: upErr } = await supabaseAdmin
        .from('marketplace_matches')
        .update({ escrow_status: newStatus })
        .eq('id', matchId)
        .in('escrow_status', ['pending_capture', 'not_initiated'])
      if (upErr) {
        console.error(`[webhook] ${event.type} match update failed`, upErr.message, 'match:', matchId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
