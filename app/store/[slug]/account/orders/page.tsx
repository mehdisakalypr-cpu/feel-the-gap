// © 2025-2026 Feel The Gap — buyer orders list (paginated)

import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { requireBuyer } from '../_lib/store-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ page?: string; status?: string }>
}

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: 'En attente',  color: '#9CA3AF' },
  paid:      { label: 'Payée',       color: '#60A5FA' },
  fulfilled: { label: 'Expédiée',    color: '#34D399' },
  refunded:  { label: 'Remboursée',  color: '#F472B6' },
  cancelled: { label: 'Annulée',     color: '#F87171' },
}

interface OrderRow {
  id: string
  created_at: string
  status: string
  total_cents: number
  currency: string
  paid_at: string | null
}

function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
}

export default async function OrdersListPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const filterStatus = (sp.status ?? '').trim()
  const { user, store } = await requireBuyer(slug)

  const sb = await createSupabaseServer()
  let query = sb.from('store_orders')
    .select('id, created_at, status, total_cents, currency, paid_at', { count: 'exact' })
    .eq('store_id', store.id)
    .eq('buyer_user_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (filterStatus && STATUS_LABEL[filterStatus]) {
    query = query.eq('status', filterStatus)
  }
  const { data, count } = await query
  const orders: OrderRow[] = (data ?? []) as OrderRow[]
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes commandes</h1>
          <p className="mt-1 text-sm text-gray-400">
            {totalCount} commande{totalCount > 1 ? 's' : ''} chez {store.name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip slug={slug} active={!filterStatus} label="Toutes" status="" />
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <FilterChip key={k} slug={slug} active={filterStatus === k} label={v.label} status={k} color={v.color} />
        ))}
      </div>

      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117]">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Aucune commande{filterStatus ? ` au statut "${STATUS_LABEL[filterStatus]?.label}"` : ''} pour le moment.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const status = STATUS_LABEL[o.status] ?? { label: o.status, color: '#9CA3AF' }
                return (
                  <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-300">{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${status.color}20`, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{fmtMoney(o.total_cents, o.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/store/${slug}/account/orders/${o.id}`} className="text-xs text-[#C9A84C] hover:underline">
                        Détails →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm">
          <PaginationLink slug={slug} page={page - 1} status={filterStatus} disabled={page <= 1} label="← Précédent" />
          <span className="text-gray-500">Page {page} / {totalPages}</span>
          <PaginationLink slug={slug} page={page + 1} status={filterStatus} disabled={page >= totalPages} label="Suivant →" />
        </nav>
      )}
    </div>
  )
}

function FilterChip(props: { slug: string; active: boolean; label: string; status: string; color?: string }) {
  const href = props.status
    ? `/store/${props.slug}/account/orders?status=${encodeURIComponent(props.status)}`
    : `/store/${props.slug}/account/orders`
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs ${
        props.active
          ? 'border-transparent bg-[#C9A84C] text-[#07090F]'
          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
      }`}
    >
      {props.label}
    </Link>
  )
}

function PaginationLink(props: { slug: string; page: number; status: string; disabled?: boolean; label: string }) {
  if (props.disabled) {
    return <span className="cursor-not-allowed text-gray-600">{props.label}</span>
  }
  const params = new URLSearchParams({ page: String(props.page) })
  if (props.status) params.set('status', props.status)
  return (
    <Link
      href={`/store/${props.slug}/account/orders?${params.toString()}`}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300 hover:bg-white/10"
    >
      {props.label}
    </Link>
  )
}
