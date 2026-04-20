// © 2025-2026 Feel The Gap — public product card (server-safe)

import Link from 'next/link'
import { fmtMoney } from './_lib'

export interface ProductCardData {
  id: string
  name: string
  cover_url?: string | null
  price_cents: number
  currency?: string
  segment?: 'b2b' | 'b2c' | 'both'
  packaging_label?: string | null
  stock_qty?: number
  stock_unlimited?: boolean
  labels?: string[] | null
}

interface Props {
  storeSlug: string
  product: ProductCardData
  accent?: string
  showSegment?: boolean
}

export function ProductCard({ storeSlug, product, accent = '#C9A84C', showSegment = false }: Props) {
  const inStock = product.stock_unlimited || (product.stock_qty ?? 0) > 0
  return (
    <Link
      href={`/store/${storeSlug}/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0D1117] transition-colors hover:border-[rgba(201,168,76,.4)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#111827]">
        {product.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-gray-700">
            <span aria-hidden>📦</span>
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold uppercase tracking-wider text-white">
            Rupture
          </div>
        )}
        {showSegment && product.segment === 'b2b' && (
          <span className="absolute left-2 top-2 rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            B2B
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-white" style={{ minHeight: '2.5rem' }}>
          {product.name}
        </h3>
        {product.labels && product.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.labels.slice(0, 3).map(lab => (
              <span key={lab} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                {lab}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="text-base font-bold" style={{ color: accent }}>
              {fmtMoney(product.price_cents, product.currency || 'EUR')}
            </div>
            {product.packaging_label && (
              <div className="text-[10px] text-gray-500">{product.packaging_label}</div>
            )}
          </div>
          <span className="rounded-xl bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-gray-300 group-hover:bg-white/10">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  )
}
