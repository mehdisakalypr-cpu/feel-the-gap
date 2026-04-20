// © 2025-2026 Feel The Gap — stocks management

import { redirect } from 'next/navigation'
import { requireStoreOwner } from '../_lib/store-owner'
import { createSupabaseServer } from '@/lib/supabase-server'
import { fmtDate } from '@/components/store/_utils'
import { StockAdjuster } from '@/components/store/StockAdjuster'

export const dynamic = 'force-dynamic'

interface MovementRow {
  id: string
  product_id: string
  movement_type: string
  qty_delta: number
  qty_before: number
  qty_after: number
  notes: string | null
  created_at: string
}

export default async function StocksPage() {
  const gate = await requireStoreOwner()
  if (!gate.ok) redirect(gate.redirectTo)

  const sb = await createSupabaseServer()
  const { data: products } = await sb
    .from('store_products')
    .select('id, name, sku, packaging_unit, stock_qty, stock_low_alert, stock_unlimited')
    .eq('store_id', gate.ctx.store.id)
    .order('name', { ascending: true })

  const productIds = (products ?? []).map(p => String(p.id))
  const { data: movRaw } = productIds.length
    ? await sb
        .from('store_stock_movements')
        .select('id, product_id, movement_type, qty_delta, qty_before, qty_after, notes, created_at')
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as MovementRow[] }
  const movements: MovementRow[] = (movRaw ?? []).map(m => ({
    id: String(m.id),
    product_id: String(m.product_id),
    movement_type: String(m.movement_type),
    qty_delta: Number(m.qty_delta),
    qty_before: Number(m.qty_before),
    qty_after: Number(m.qty_after),
    notes: m.notes ? String(m.notes) : null,
    created_at: String(m.created_at),
  }))
  const nameMap = new Map((products ?? []).map(p => [String(p.id), String(p.name)]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Stocks</h1>
        <p className="mt-1 text-sm text-gray-400">G\u00e9rez l&apos;inventaire et l&apos;historique des mouvements.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
        <div className="grid grid-cols-12 border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <div className="col-span-5">Produit</div>
          <div className="col-span-2">Stock</div>
          <div className="col-span-2">Alerte</div>
          <div className="col-span-3 text-right">Ajuster</div>
        </div>
        {products && products.length ? (
          <ul className="divide-y divide-white/5">
            {products.map(p => {
              const low = !p.stock_unlimited && p.stock_low_alert != null && Number(p.stock_qty) <= Number(p.stock_low_alert)
              return (
                <li key={p.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-5 min-w-0">
                    <div className="truncate text-white">{p.name}</div>
                    {p.sku && <div className="truncate text-[11px] text-gray-500">{p.sku}</div>}
                  </div>
                  <div className="col-span-2">
                    {p.stock_unlimited
                      ? <span className="text-gray-400">\u221E</span>
                      : <span className={low ? 'font-semibold text-orange-400' : 'text-white'}>{Number(p.stock_qty)} {p.packaging_unit}</span>}
                  </div>
                  <div className="col-span-2 text-gray-400">{p.stock_low_alert ?? '\u2014'}</div>
                  <div className="col-span-3 text-right">
                    <StockAdjuster productId={String(p.id)} unit={String(p.packaging_unit)} disabled={!!p.stock_unlimited} />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Aucun produit.</div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1117] p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Historique mouvements (50 derniers)</h2>
        {movements.length === 0 ? (
          <div className="text-sm text-gray-400">Aucun mouvement enregistr\u00e9.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {movements.map(m => (
              <li key={m.id} className="grid grid-cols-12 items-center gap-2 py-2 text-xs">
                <div className="col-span-3 text-gray-400">{fmtDate(m.created_at)}</div>
                <div className="col-span-3 truncate text-white">{nameMap.get(m.product_id) ?? m.product_id.slice(0, 8)}</div>
                <div className="col-span-2 text-gray-300">{m.movement_type}</div>
                <div className={`col-span-2 font-semibold ${m.qty_delta < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {m.qty_delta > 0 ? '+' : ''}{m.qty_delta}
                </div>
                <div className="col-span-2 text-right text-gray-500">{m.qty_before} \u2192 {m.qty_after}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
