// © 2025-2026 Feel The Gap — checkout success page (post-Stripe redirect)

import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { fmtMoney } from '@/components/store-public/_lib'
import { loadChrome } from '../../_chrome'
import { confirmFromIntent } from '../../_confirm-helper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{
    payment_intent?: string
    payment_intent_client_secret?: string
    redirect_status?: string
    order_id?: string
  }>
}

const ADMIN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

interface OrderRow {
  id: string
  created_at: string
  status: string
  total_cents: number
  currency: string
  buyer_email: string
}

interface InvoiceRow {
  id: string
  invoice_number: string
}

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const { store, user, cartCount } = await loadChrome(slug)
  const accent = store.primary_color || '#C9A84C'

  let order: OrderRow | null = null
  let invoice: InvoiceRow | null = null
  let confirmError: string | null = null

  // Trigger the server confirm now if Stripe redirected with payment_intent.
  // This is best-effort: the canonical truth is the webhook, but confirming here
  // gives users an immediate answer without waiting for the webhook to land.
  if (sp.payment_intent && sp.redirect_status === 'succeeded' && sp.order_id) {
    const r = await confirmFromIntent({
      storeId: store.id,
      paymentIntentId: sp.payment_intent,
      orderId: sp.order_id,
    }).catch(err => ({ ok: false as const, error: err instanceof Error ? err.message : 'confirm_failed' }))
    if (!r.ok) confirmError = r.error
  }

  if (sp.order_id) {
    const a = createClient(ADMIN_URL, ADMIN_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: orderData } = await a
      .from('store_orders')
      .select('id, created_at, status, total_cents, currency, buyer_email')
      .eq('id', sp.order_id)
      .eq('store_id', store.id)
      .maybeSingle()
    if (orderData) {
      order = orderData as OrderRow
      const { data: inv } = await a
        .from('store_invoices')
        .select('id, invoice_number')
        .eq('order_id', order.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      invoice = inv ? (inv as InvoiceRow) : null
    }
  }

  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl text-[#07090F]">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">Merci pour votre commande !</h1>
          {order ? (
            <>
              <p className="mt-2 text-sm text-gray-300">
                Confirmation envoyée à <span className="text-[#C9A84C]">{order.buyer_email}</span>.
              </p>
              <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-[#0D1117] p-5 text-left text-sm">
                <Row label="Numéro de commande" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
                <Row label="Date" value={new Date(order.created_at).toLocaleString('fr-FR')} />
                <Row label="Statut" value={order.status === 'paid' ? 'Payée ✓' : order.status} />
                <Row label="Total" value={fmtMoney(order.total_cents, order.currency)} bold />
              </div>
              {confirmError && (
                <p className="mt-3 text-[10px] text-amber-300">
                  ⓘ Confirmation différée : {confirmError}. Le webhook Stripe finalisera votre commande sous quelques secondes.
                </p>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/store/${store.slug}/account/orders/${order.id}`}
                  className="rounded-xl px-5 py-3 text-sm font-bold text-[#07090F]"
                  style={{ background: accent }}
                >
                  Voir ma commande →
                </Link>
                {invoice && (
                  <a
                    href={`/api/store/${encodeURIComponent(store.slug)}/account/orders/${order.id}/invoice?invoice_id=${invoice.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Télécharger la facture
                  </a>
                )}
                <Link
                  href={`/store/${store.slug}/products`}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Continuer mes achats
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-400">
              Votre commande est en cours de traitement. Vous recevrez un email de confirmation dans quelques instants.
            </p>
          )}
        </div>
      </div>
    </StoreChrome>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
      <span className={bold ? 'text-base font-bold text-white' : 'text-sm text-gray-200'}>{value}</span>
    </div>
  )
}
