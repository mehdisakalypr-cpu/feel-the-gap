// © 2025-2026 Feel The Gap — buyer order detail + invoice + tracking

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireBuyer } from '../../_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

interface OrderRow {
  id: string
  created_at: string
  paid_at: string | null
  fulfilled_at: string | null
  status: string
  subtotal_cents: number
  discount_cents: number
  vat_cents: number
  shipping_cents: number
  total_cents: number
  currency: string
  buyer_email: string
  buyer_name: string | null
  buyer_address: Record<string, unknown> | null
  notes: string | null
}

interface ItemRow {
  id: string
  product_id: string | null
  product_snapshot: { name?: string; sku?: string } | null
  qty: number
  unit_price_cents: number
  vat_rate_pct: number | null
  line_total_cents: number
}

interface InvoiceRow {
  id: string
  invoice_number: string
  version: number
  issued_at: string
  pdf_url: string | null
}

interface RefundRow {
  id: string
  amount_cents: number
  reason: string | null
  type: string
  status: string
  created_at: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'En attente',  color: '#9CA3AF' },
  paid:      { label: 'Payée',       color: '#60A5FA' },
  fulfilled: { label: 'Expédiée',    color: '#34D399' },
  refunded:  { label: 'Remboursée',  color: '#F472B6' },
  cancelled: { label: 'Annulée',     color: '#F87171' },
}

function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
}

function fmtAddress(addr: Record<string, unknown> | null): string {
  if (!addr) return '—'
  const parts = [
    addr.line1, addr.line2,
    [addr.postal, addr.city].filter(Boolean).join(' '),
    addr.country,
  ].filter(Boolean) as string[]
  return parts.join('\n')
}

export default async function OrderDetailPage({ params }: Props) {
  const { slug, id } = await params
  const { user, store } = await requireBuyer(slug)
  const sb = await createSupabaseServer()

  const { data: orderData } = await sb
    .from('store_orders')
    .select('id, created_at, paid_at, fulfilled_at, status, subtotal_cents, discount_cents, vat_cents, shipping_cents, total_cents, currency, buyer_email, buyer_name, buyer_address, notes')
    .eq('id', id)
    .eq('store_id', store.id)
    .eq('buyer_user_id', user.id)
    .maybeSingle()

  if (!orderData) notFound()
  const order = orderData as OrderRow

  const [itemsRes, invoicesRes, refundsRes] = await Promise.all([
    sb.from('store_order_items')
      .select('id, product_id, product_snapshot, qty, unit_price_cents, vat_rate_pct, line_total_cents')
      .eq('order_id', order.id),
    sb.from('store_invoices')
      .select('id, invoice_number, version, issued_at, pdf_url')
      .eq('order_id', order.id)
      .order('version', { ascending: false }),
    sb.from('store_refunds')
      .select('id, amount_cents, reason, type, status, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false }),
  ])
  const items: ItemRow[] = (itemsRes.data ?? []) as ItemRow[]
  const invoices: InvoiceRow[] = (invoicesRes.data ?? []) as InvoiceRow[]
  const refunds: RefundRow[] = (refundsRes.data ?? []) as RefundRow[]

  const status = STATUS_LABEL[order.status] ?? { label: order.status, color: '#9CA3AF' }
  const trackingSteps: { key: string; label: string; date?: string | null; reached: boolean }[] = [
    { key: 'created',   label: 'Commande passée', date: order.created_at,    reached: true },
    { key: 'paid',      label: 'Paiement validé', date: order.paid_at,       reached: ['paid','fulfilled','refunded'].includes(order.status) },
    { key: 'fulfilled', label: 'Expédiée',        date: order.fulfilled_at,  reached: order.status === 'fulfilled' },
    { key: 'delivered', label: 'Livrée',          date: null,                reached: false },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/store/${slug}/account/orders`} className="text-xs text-gray-400 hover:text-white">
          ← Toutes mes commandes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Commande #{order.id.slice(0, 8)}</h1>
          <span
            className="rounded-full px-3 py-0.5 text-xs font-semibold"
            style={{ background: `${status.color}20`, color: status.color }}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Passée le {new Date(order.created_at).toLocaleString('fr-FR')}
        </p>
      </div>

      {/* Tracking */}
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-300">Suivi</h2>
        <ol className="grid gap-4 sm:grid-cols-4">
          {trackingSteps.map((step, i) => (
            <li key={step.key} className="relative">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    step.reached ? 'bg-[#C9A84C] text-[#07090F]' : 'bg-white/10 text-gray-500'
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-xs font-semibold ${step.reached ? 'text-white' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {step.date && <div className="mt-1 pl-8 text-[10px] text-gray-500">{new Date(step.date).toLocaleString('fr-FR')}</div>}
            </li>
          ))}
        </ol>
      </div>

      {/* Items */}
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117]">
        <h2 className="border-b border-white/5 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-gray-300">
          Articles
        </h2>
        <ul className="divide-y divide-white/5">
          {items.map(it => (
            <li key={it.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {it.product_snapshot?.name ?? 'Article supprimé'}
                </div>
                {it.product_snapshot?.sku && (
                  <div className="text-[10px] font-mono text-gray-500">SKU {it.product_snapshot.sku}</div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {it.qty} × {fmtMoney(it.unit_price_cents, order.currency)}
                </div>
              </div>
              <div className="text-sm font-semibold text-white">{fmtMoney(it.line_total_cents, order.currency)}</div>
            </li>
          ))}
        </ul>
        <div className="space-y-2 border-t border-white/5 px-6 py-4 text-sm">
          <Row label="Sous-total" value={fmtMoney(order.subtotal_cents, order.currency)} />
          {order.discount_cents > 0 && (
            <Row label="Remise" value={`- ${fmtMoney(order.discount_cents, order.currency)}`} />
          )}
          <Row label="Livraison" value={fmtMoney(order.shipping_cents, order.currency)} />
          <Row label="TVA" value={fmtMoney(order.vat_cents, order.currency)} />
          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-3 text-base font-bold">
            <span className="text-white">Total</span>
            <span className="text-white">{fmtMoney(order.total_cents, order.currency)}</span>
          </div>
        </div>
      </div>

      {/* Address + invoice */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Adresse de livraison</h3>
          <div className="text-sm text-gray-300">
            {order.buyer_name && <div className="font-semibold text-white">{order.buyer_name}</div>}
            <div className="whitespace-pre-line text-gray-400">{fmtAddress(order.buyer_address)}</div>
            <div className="mt-2 text-xs text-gray-500">{order.buyer_email}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Facture</h3>
          {invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-white">{inv.invoice_number}</div>
                    <div className="text-[10px] text-gray-500">v{inv.version} · {new Date(inv.issued_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <a
                    href={`/api/store/${encodeURIComponent(slug)}/account/orders/${order.id}/invoice?invoice_id=${inv.id}`}
                    className="rounded-xl bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#07090F] hover:bg-[#E8C97A]"
                  >
                    Télécharger PDF
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400">Aucune facture émise — nous générons à la demande.</p>
              <a
                href={`/api/store/${encodeURIComponent(slug)}/account/orders/${order.id}/invoice`}
                className="mt-3 inline-block rounded-xl bg-[#C9A84C] px-4 py-2 text-xs font-semibold text-[#07090F] hover:bg-[#E8C97A]"
              >
                Générer la facture (PDF)
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Refunds */}
      {refunds.length > 0 && (
        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-300">Remboursements</h3>
          <ul className="space-y-2">
            {refunds.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm text-gray-300">
                <div>
                  <div>{fmtMoney(r.amount_cents, order.currency)} — {r.type === 'total' ? 'remboursement total' : 'remboursement partiel'}</div>
                  <div className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleString('fr-FR')}{r.reason ? ` · ${r.reason}` : ''}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.notes && (
        <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-300">Notes</h3>
          <p className="whitespace-pre-line text-sm text-gray-300">{order.notes}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-300">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
