// © 2025-2026 Feel The Gap — orders list (owner)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { fmtMoney, fmtDate } from '@/components/store/_utils'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams?: Promise<{
    status?: string
    q?: string
    from?: string
    to?: string
    page?: string
  }>
}

const PAGE_SIZE = 30

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  paid:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  fulfilled: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  refunded:  'bg-purple-500/15 text-purple-300 border-purple-500/30',
  cancelled: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
}

export default async function OrdersListPage(props: Props) {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sp = (await props.searchParams) ?? {}
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  const sb = await createSupabaseServer()
  let query = sb
    .from('store_orders')
    .select('id, buyer_email, buyer_name, status, total_cents, currency, created_at, paid_at', { count: 'exact' })
    .eq('store_id', gate.ctx.store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (sp.status && ['pending', 'paid', 'fulfilled', 'refunded', 'cancelled'].includes(sp.status)) {
    query = query.eq('status', sp.status)
  }
  if (sp.q) query = query.ilike('buyer_email', `%${sp.q}%`)
  if (sp.from) query = query.gte('created_at', sp.from)
  if (sp.to) query = query.lte('created_at', sp.to)

  const { data: orders, count } = await query
  const total = count ?? (orders?.length ?? 0)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white">Commandes</h1>
        <p className="mt-1 text-sm text-gray-400">{total} commande{total > 1 ? 's' : ''}</p>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Email acheteur"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white placeholder-gray-600"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        >
          <option value="">Tous statuts</option>
          <option value="pending">En attente</option>
          <option value="paid">Pay\u00e9e</option>
          <option value="fulfilled">Exp\u00e9di\u00e9e</option>
          <option value="refunded">Rembours\u00e9e</option>
          <option value="cancelled">Annul\u00e9e</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ''}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <button type="submit" className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10">
          Filtrer
        </button>
        <Link href="/account/store/orders" className="text-xs text-gray-500 hover:text-gray-300">R\u00e9initialiser</Link>
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
        <div className="grid grid-cols-12 border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <div className="col-span-3">Date</div>
          <div className="col-span-4">Acheteur</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-3 text-right">Statut</div>
        </div>
        {orders && orders.length ? (
          <ul className="divide-y divide-white/5">
            {orders.map(o => (
              <li key={o.id}>
                <Link href={`/account/store/orders/${o.id}`} className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-white/5">
                  <div className="col-span-3 text-sm text-gray-300">{fmtDate(o.created_at)}</div>
                  <div className="col-span-4 min-w-0">
                    <div className="truncate text-sm text-white">{o.buyer_email}</div>
                    {o.buyer_name && <div className="truncate text-[11px] text-gray-500">{o.buyer_name}</div>}
                  </div>
                  <div className="col-span-2 text-sm font-semibold text-white">{fmtMoney(o.total_cents, o.currency)}</div>
                  <div className="col-span-3 text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[o.status] ?? STATUS_BADGE.pending}`}>
                      {o.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Aucune commande pour ces crit\u00e8res.</div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div>Page {page} / {pages}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/account/store/orders?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page - 1) }).toString()}`}
                className="rounded-lg bg-white/5 px-3 py-1.5 hover:bg-white/10"
              >
                \u2190 Pr\u00e9c.
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/account/store/orders?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page + 1) }).toString()}`}
                className="rounded-lg bg-white/5 px-3 py-1.5 hover:bg-white/10"
              >
                Suiv. \u2192
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
