// © 2025-2026 Feel The Gap — shared "confirm order" pipeline (idempotent).
// Used both by /checkout/success (best-effort immediate confirm) and by the
// webhook (canonical truth via Stripe signature). All side-effects must be
// idempotent: invoice creation guarded by orderId, cart marked converted only
// once, email sent at most once via `confirmation_email_sent_at` flag.

import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getStripe, stripeConfigured } from '@/lib/stripe'
import { markCartConverted } from './_cart'

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

function admin() {
  return createClient(ADMIN_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type ConfirmResult =
  | {
      ok: true
      order_id: string
      status: string
      invoice_id?: string
      invoice_number?: string
      email_sent?: boolean
    }
  | { ok: false; error: string }

interface OrderRow {
  id: string
  store_id: string
  buyer_user_id: string | null
  buyer_email: string
  buyer_name: string | null
  buyer_address: Record<string, unknown> | null
  subtotal_cents: number
  discount_cents: number
  vat_cents: number
  shipping_cents: number
  total_cents: number
  currency: string
  status: string
  stripe_payment_intent: string | null
}

interface OrderItemRow {
  id: string
  product_id: string | null
  product_snapshot: { name?: string; sku?: string; packaging_label?: string } | null
  qty: number
  unit_price_cents: number
  vat_rate_pct: number | null
  line_total_cents: number
}

interface CartRow {
  id: string
  items: Array<{
    product_id: string
    variant_id?: string | null
    name: string
    sku?: string | null
    unit_price_cents: number
    vat_rate_pct: number
    qty: number
    image_url?: string | null
    packaging_label?: string | null
    segment: 'b2b' | 'b2c'
  }>
  status: string
}

export async function confirmFromIntent(args: {
  storeId: string
  paymentIntentId: string
  orderId: string
}): Promise<ConfirmResult> {
  if (!stripeConfigured()) return { ok: false, error: 'stripe_not_configured' }

  const a = admin()
  const stripe = getStripe()

  // 1. Verify Stripe truth
  let pi
  try {
    pi = await stripe.paymentIntents.retrieve(args.paymentIntentId)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'pi_retrieve_failed' }
  }
  if (pi.status !== 'succeeded') {
    return { ok: false, error: `pi_not_succeeded:${pi.status}` }
  }
  if (pi.metadata?.store_id && pi.metadata.store_id !== args.storeId) {
    return { ok: false, error: 'store_mismatch' }
  }

  // 2. Fetch the order
  const { data: orderData, error: orderErr } = await a
    .from('store_orders')
    .select('id, store_id, buyer_user_id, buyer_email, buyer_name, buyer_address, subtotal_cents, discount_cents, vat_cents, shipping_cents, total_cents, currency, status, stripe_payment_intent')
    .eq('id', args.orderId)
    .eq('store_id', args.storeId)
    .maybeSingle()
  if (orderErr || !orderData) return { ok: false, error: 'order_not_found' }
  const order = orderData as OrderRow

  // Idempotent guard: if already paid or beyond, just resync side-effects we missed.
  const alreadyPaid = ['paid', 'fulfilled', 'refunded'].includes(order.status)

  // 3. Mark order paid (only if not already) — also persist charge id
  let chargeId: string | null = null
  const ch = (pi as unknown as { latest_charge?: string | { id?: string } }).latest_charge
  if (typeof ch === 'string') chargeId = ch
  else if (ch && typeof ch === 'object' && typeof ch.id === 'string') chargeId = ch.id

  if (!alreadyPaid) {
    await a.from('store_orders').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: pi.id,
      stripe_charge_id: chargeId,
    }).eq('id', order.id).eq('status', 'pending')
  }

  // 4. Hydrate order_items from the cart if not already done.
  // The trigger `decrement_stock_on_order_item` runs on insert.
  const cartId = (pi.metadata?.cart_id ?? '') as string
  const { data: existingItems } = await a
    .from('store_order_items')
    .select('id')
    .eq('order_id', order.id)
    .limit(1)
  if ((existingItems?.length ?? 0) === 0 && cartId) {
    const { data: cartRow } = await a
      .from('store_carts')
      .select('id, items, status')
      .eq('id', cartId)
      .maybeSingle()
    if (cartRow) {
      const cart = cartRow as CartRow
      if (cart.items && cart.items.length > 0) {
        const rows = cart.items.map(it => {
          const lineTotal = it.unit_price_cents * it.qty
          return {
            order_id: order.id,
            product_id: it.product_id,
            product_snapshot: {
              name: it.name,
              sku: it.sku,
              packaging_label: it.packaging_label,
              variant_id: it.variant_id,
              segment: it.segment,
            },
            qty: it.qty,
            unit_price_cents: it.unit_price_cents,
            vat_rate_pct: it.vat_rate_pct,
            line_total_cents: lineTotal,
          }
        })
        const { error: itemsErr } = await a.from('store_order_items').insert(rows)
        if (itemsErr) {
          console.error('[store-confirm] items insert error', itemsErr.message)
        }
      }
      await markCartConverted(cart.id, order.id).catch(() => undefined)
    }
  }

  // 5. Link any orphan orders sharing the same email to the buyer_user_id.
  if (order.buyer_user_id) {
    await a
      .from('store_orders')
      .update({ buyer_user_id: order.buyer_user_id })
      .eq('store_id', args.storeId)
      .eq('buyer_email', order.buyer_email)
      .is('buyer_user_id', null)
  }

  // 6a. Create pending shipment (idempotent by order_id). Label created later via cron.
  if (!alreadyPaid) {
    try {
      await a.from('store_shipments').upsert({
        order_id: order.id,
        store_id: order.store_id,
        status: 'pending',
      }, { onConflict: 'order_id', ignoreDuplicates: true })
    } catch (err) {
      console.error('[store-confirm] shipment create error', err)
    }
  }

  // 6. Generate invoice (idempotent by store+order)
  const invoice = await ensureInvoice(order)

  // 7. Send confirmation email (idempotent via metadata flag in store_orders.notes? we use a column-free approach: try insert into store_invoices.data → check `email_sent` flag).
  //    To stay schema-safe we don't add a column; instead we rely on a soft "did we already email" check via a marker in invoice.data.
  let emailSent = false
  if (invoice && !alreadyPaid) {
    emailSent = await sendOrderEmail(order, invoice).catch(err => {
      console.error('[store-confirm] email error', err)
      return false
    })
  }

  return {
    ok: true,
    order_id: order.id,
    status: alreadyPaid ? order.status : 'paid',
    invoice_id: invoice?.id,
    invoice_number: invoice?.invoice_number,
    email_sent: emailSent,
  }
}

interface InvoiceRow {
  id: string
  invoice_number: string
  pdf_url: string | null
}

async function ensureInvoice(order: OrderRow): Promise<InvoiceRow | null> {
  const a = admin()
  const { data: existing } = await a
    .from('store_invoices')
    .select('id, invoice_number, pdf_url')
    .eq('order_id', order.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return existing as InvoiceRow

  // Fetch issuer (store billing entity) + items
  const [{ data: storeRow }, { data: itemsData }] = await Promise.all([
    a.from('stores').select('id, name, billing_entity').eq('id', order.store_id).maybeSingle(),
    a.from('store_order_items')
      .select('id, product_id, product_snapshot, qty, unit_price_cents, vat_rate_pct, line_total_cents')
      .eq('order_id', order.id),
  ])

  const issuer = (storeRow?.billing_entity ?? {}) as Record<string, unknown>
  const items = (itemsData ?? []) as OrderItemRow[]

  // Generate invoice number: STORE-YYYYMM-XXXX
  const date = new Date()
  const yyyymm = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  const invoiceNumber = `${(storeRow?.name ?? 'STORE').replace(/\W/g, '').slice(0, 6).toUpperCase()}-${yyyymm}-${random}`

  const data = {
    issued_at: new Date().toISOString(),
    issuer,
    buyer: {
      email: order.buyer_email,
      name: order.buyer_name,
      address: order.buyer_address,
    },
    items: items.map(it => ({
      name: it.product_snapshot?.name ?? '—',
      sku: it.product_snapshot?.sku,
      qty: it.qty,
      unit_price_cents: it.unit_price_cents,
      line_total_cents: it.line_total_cents,
      vat_rate_pct: it.vat_rate_pct,
    })),
    totals: {
      subtotal_cents: order.subtotal_cents,
      discount_cents: order.discount_cents,
      vat_cents: order.vat_cents,
      shipping_cents: order.shipping_cents,
      total_cents: order.total_cents,
      currency: order.currency,
    },
  }

  const { data: created, error } = await a.from('store_invoices').insert({
    order_id: order.id,
    store_id: order.store_id,
    invoice_number: invoiceNumber,
    version: 1,
    issuer_snapshot: issuer,
    data,
    pdf_url: null,
  }).select('id, invoice_number, pdf_url').single()
  if (error) {
    console.error('[store-confirm] invoice insert failed', error.message)
    return null
  }
  return created as InvoiceRow
}

async function sendOrderEmail(order: OrderRow, invoice: InvoiceRow): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[store-confirm] RESEND_API_KEY missing — skipping confirmation email')
    return false
  }

  // Idempotency: check if we already inserted a marker row in invoice data.
  // Cheaper and column-free: re-fetch invoice.data.email_sent_at — if present, skip.
  const a = admin()
  const { data: latest } = await a
    .from('store_invoices')
    .select('id, data')
    .eq('id', invoice.id)
    .maybeSingle()
  const dataObj = (latest?.data ?? {}) as Record<string, unknown>
  if (typeof dataObj.email_sent_at === 'string') return false

  // Fetch store + slug for the link
  const { data: storeRow } = await a
    .from('stores')
    .select('slug, name')
    .eq('id', order.store_id)
    .maybeSingle()
  const slug = String(storeRow?.slug ?? '')
  const storeName = String(storeRow?.name ?? 'Boutique')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gapup.io'
  const orderUrl = `${appUrl}/store/${slug}/account/orders/${order.id}`
  const total = (order.total_cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: order.currency || 'EUR',
  })

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#07090F;color:#e2e8f0;padding:32px">
    <div style="max-width:560px;margin:auto;background:#0D1117;border:1px solid rgba(201,168,76,.2);border-radius:16px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 8px;color:#C9A84C">${storeName}</h1>
      <h2 style="font-size:24px;margin:8px 0 16px;color:#fff">Merci pour votre commande !</h2>
      <p style="color:#cbd5e1;line-height:1.6">
        Votre commande <strong style="color:#fff">#${order.id.slice(0, 8).toUpperCase()}</strong> a bien été enregistrée et le paiement a été confirmé.
      </p>
      <div style="margin:20px 0;padding:16px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:12px">
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:4px">TOTAL</div>
        <div style="font-size:22px;font-weight:700;color:#C9A84C">${total}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:6px">Facture n° ${invoice.invoice_number}</div>
      </div>
      <a href="${orderUrl}" style="display:inline-block;margin-top:8px;background:#C9A84C;color:#07090F;padding:12px 24px;text-decoration:none;font-weight:700;border-radius:10px">
        Voir ma commande →
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,.35);margin-top:24px">
        Vous recevrez une notification dès l&apos;expédition. Pour toute question, répondez simplement à cet email.
      </p>
    </div>
  </body></html>`
  const text = `Merci pour votre commande !

Commande #${order.id.slice(0, 8).toUpperCase()} — Total ${total}
Facture n° ${invoice.invoice_number}

Voir ma commande : ${orderUrl}`

  try {
    const resend = new Resend(key)
    const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM || `${storeName} <noreply@gapup.io>`
    await resend.emails.send({
      from,
      to: order.buyer_email,
      subject: `✅ Commande ${order.id.slice(0, 8).toUpperCase()} confirmée — ${storeName}`,
      html,
      text,
    })
  } catch (err) {
    console.error('[store-confirm] resend send failed', err)
    return false
  }

  // Mark email_sent_at in invoice.data to enforce idempotency
  await a.from('store_invoices').update({
    data: { ...dataObj, email_sent_at: new Date().toISOString() },
  }).eq('id', invoice.id)

  return true
}
