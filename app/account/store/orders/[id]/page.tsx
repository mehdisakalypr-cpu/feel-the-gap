// © 2025-2026 Feel The Gap — order detail (owner)

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireStoreOwner } from '../../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { fmtMoney, fmtDate } from '@/components/store/_utils'
import { OrderActions } from '@/components/store/OrderActions'

export const dynamic = 'force-dynamic'

interface OrderItemRow {
  id: string
  qty: number | string
  unit_price_cents: number
  line_total_cents: number
  product_snapshot: Record<string, unknown>
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()
  const { data: order } = await sb
    .from('store_orders')
    .select('*')
    .eq('id', id)
    .eq('store_id', gate.ctx.store.id)
    .maybeSingle()
  if (!order) notFound()

  const { data: itemsRaw } = await sb
    .from('store_order_items')
    .select('id, qty, unit_price_cents, line_total_cents, product_snapshot')
    .eq('order_id', id)
  const items: OrderItemRow[] = (itemsRaw ?? []).map(i => ({
    id: String(i.id),
    qty: i.qty as number | string,
    unit_price_cents: Number(i.unit_price_cents),
    line_total_cents: Number(i.line_total_cents),
    product_snapshot: (i.product_snapshot ?? {}) as Record<string, unknown>,
  }))

  const { data: refunds } = await sb
    .from('store_refunds')
    .select('id, amount_cents, type, status, created_at, reason')
    .eq('order_id', id)
    .order('created_at', { ascending: false })

  const { data: invoices } = await sb
    .from('store_invoices')
    .select('id, invoice_number, version, issued_at, pdf_url')
    .eq('order_id', id)
    .order('version', { ascending: false })

  const addr = (order.buyer_address ?? null) as Record<string, unknown> | null
  const refundedTotal = (refunds ?? []).filter(r => r.status === 'succeeded').reduce((s, r) => s + Number(r.amount_cents), 0)
  const refundable = Math.max(0, Number(order.total_cents) - refundedTotal)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/account/store/orders" className="text-xs text-gray-500 hover:text-gray-300">\u2190 Retour aux commandes</Link>
          <h1 className="mt-1 text-2xl font-bold text-white">Commande #{String(order.id).slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {fmtDate(order.created_at)} \u00b7 statut <strong className="text-white">{order.status}</strong>
          </p>
        </div>
        <OrderActions orderId={id} status={String(order.status)} refundable={refundable} currency={String(order.currency)} />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Acheteur</h2>
          <div className="mt-2 text-sm text-white">{order.buyer_name ?? '\u2014'}</div>
          <div className="text-sm text-gray-400">{order.buyer_email}</div>
          {addr && (
            <div className="mt-3 rounded-lg bg-white/5 p-3 text-xs text-gray-300">
              {(addr.full_name as string) ?? ''}
              {addr.line1 ? <><br />{String(addr.line1)}</> : null}
              {addr.line2 ? <><br />{String(addr.line2)}</> : null}
              {(addr.postal_code || addr.city) ? <><br />{[addr.postal_code, addr.city].filter(Boolean).map(String).join(' ')}</> : null}
              {addr.country ? <><br />{String(addr.country)}</> : null}
              {addr.phone ? <><br /><span className="text-gray-500">tel.</span> {String(addr.phone)}</> : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paiement</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Row k="Sous-total" v={fmtMoney(order.subtotal_cents, order.currency)} />
            <Row k="Remise" v={`- ${fmtMoney(order.discount_cents, order.currency)}`} />
            <Row k="TVA" v={fmtMoney(order.vat_cents, order.currency)} />
            <Row k="Livraison" v={fmtMoney(order.shipping_cents, order.currency)} />
            <Row k="Total" v={<strong className="text-white">{fmtMoney(order.total_cents, order.currency)}</strong>} />
            {refundedTotal > 0 && <Row k="Rembours\u00e9" v={<span className="text-purple-300">- {fmtMoney(refundedTotal, order.currency)}</span>} />}
          </dl>
          {order.stripe_payment_intent && (
            <div className="mt-3 break-all rounded-lg bg-white/5 px-3 py-2 text-[11px] font-mono text-gray-400">
              PI: {String(order.stripe_payment_intent)}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Articles</h2>
        <ul className="divide-y divide-white/5">
          {items.map(it => {
            const snap = it.product_snapshot
            const name = (snap.name as string) ?? 'Produit'
            return (
              <li key={it.id} className="grid grid-cols-12 items-center gap-2 py-3">
                <div className="col-span-6 text-sm text-white">{name}</div>
                <div className="col-span-2 text-sm text-gray-300">x {Number(it.qty)}</div>
                <div className="col-span-2 text-sm text-gray-300">{fmtMoney(it.unit_price_cents, order.currency)}</div>
                <div className="col-span-2 text-right text-sm font-semibold text-white">{fmtMoney(it.line_total_cents, order.currency)}</div>
              </li>
            )
          })}
        </ul>
      </section>

      {invoices && invoices.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Factures</h2>
          <ul className="divide-y divide-white/5">
            {invoices.map(inv => (
              <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-mono text-gray-300">{inv.invoice_number}</span>
                  <span className="ml-2 text-gray-500">v{inv.version}</span>
                  <span className="ml-2 text-gray-500">{fmtDate(inv.issued_at)}</span>
                </div>
                {inv.pdf_url ? (
                  <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C9A84C] hover:underline">
                    T\u00e9l\u00e9charger PDF
                  </a>
                ) : (
                  <span className="text-xs text-gray-500">PDF en attente</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {refunds && refunds.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Remboursements</h2>
          <ul className="divide-y divide-white/5">
            {refunds.map(r => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-semibold text-white">{fmtMoney(r.amount_cents, order.currency)}</span>
                  <span className="ml-2 text-gray-500">{r.type}</span>
                  {r.reason && <span className="ml-2 text-gray-400">\u2014 {r.reason}</span>}
                </div>
                <span className="text-xs text-gray-400">{r.status} \u00b7 {fmtDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-gray-400">{k}</dt>
      <dd className="text-gray-200">{v}</dd>
    </div>
  )
}
