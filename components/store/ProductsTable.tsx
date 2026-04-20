'use client'

import Link from 'next/link'
import { fmtMoney } from './_utils'

export interface ProductRow {
  id: string
  name: string
  sku: string | null
  segment: 'b2b' | 'b2c' | 'both'
  visibility: 'draft' | 'active' | 'archived'
  stock_qty: number
  stock_low_alert: number | null
  stock_unlimited: boolean
  price_b2c_ttc_cents: number | null
  price_b2b_ht_cents: number | null
  packaging_type: 'unit' | 'weight' | 'volume'
  packaging_unit: string
  packaging_qty: number | string | null
  category_id: string | null
  updated_at: string
}

const VIS_BADGE: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  draft:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  archived: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
}

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center">
        <div className="text-sm text-gray-300">Aucun produit pour l&apos;instant.</div>
        <Link
          href="/account/store/products/new"
          className="mt-4 inline-block rounded-xl bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A]"
        >
          Cr\u00e9er mon premier produit
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
      <div className="grid grid-cols-12 border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <div className="col-span-4">Produit</div>
        <div className="col-span-2">Prix</div>
        <div className="col-span-2">Stock</div>
        <div className="col-span-2">Segment</div>
        <div className="col-span-2 text-right">Statut</div>
      </div>
      <ul className="divide-y divide-white/5">
        {rows.map(p => {
          const lowStock = !p.stock_unlimited && p.stock_low_alert != null && Number(p.stock_qty) <= Number(p.stock_low_alert)
          return (
            <li key={p.id}>
              <Link
                href={`/account/store/products/${p.id}`}
                className="grid grid-cols-12 items-center gap-2 px-4 py-3 hover:bg-white/5"
              >
                <div className="col-span-4 min-w-0">
                  <div className="truncate text-sm font-medium text-white">{p.name}</div>
                  <div className="truncate text-[11px] text-gray-500">
                    {p.sku ? `SKU ${p.sku} \u00b7 ` : ''}
                    {Number(p.packaging_qty || 1)} {p.packaging_unit} ({p.packaging_type})
                  </div>
                </div>
                <div className="col-span-2 text-sm text-gray-300">
                  {p.segment !== 'b2b' && p.price_b2c_ttc_cents != null && (
                    <div>{fmtMoney(p.price_b2c_ttc_cents)} <span className="text-[10px] text-gray-500">TTC</span></div>
                  )}
                  {p.segment !== 'b2c' && p.price_b2b_ht_cents != null && (
                    <div className="text-xs text-gray-400">{fmtMoney(p.price_b2b_ht_cents)} <span className="text-[10px] text-gray-500">HT</span></div>
                  )}
                </div>
                <div className="col-span-2 text-sm">
                  {p.stock_unlimited ? (
                    <span className="text-gray-400">\u221E</span>
                  ) : (
                    <span className={lowStock ? 'font-semibold text-orange-400' : 'text-gray-300'}>
                      {Number(p.stock_qty)} {p.packaging_unit}
                    </span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-300">
                    {p.segment}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${VIS_BADGE[p.visibility] ?? VIS_BADGE.draft}`}>
                    {p.visibility}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
