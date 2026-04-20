// © 2025-2026 Feel The Gap — single cart line (client, qty editable + remove)
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CartItem } from './_lib'
import { fmtMoney } from './_lib'

interface Props {
  storeSlug: string
  item: CartItem
  currency?: string
}

export function CartItemRow({ storeSlug, item, currency = 'EUR' }: Props) {
  const router = useRouter()
  const [qty, setQty] = useState(item.qty)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const callApi = (action: 'patch' | 'remove', body: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        const method = action === 'remove' ? 'DELETE' : 'PATCH'
        const url = `/api/store/${encodeURIComponent(storeSlug)}/cart`
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError((j as { error?: string }).error || 'Mise à jour impossible')
          return
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    })
  }

  const updateQty = (next: number) => {
    const clamped = Math.max(1, Math.min(9999, Math.floor(next)))
    setQty(clamped)
    callApi('patch', {
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      qty: clamped,
    })
  }

  const remove = () => {
    callApi('remove', {
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
    })
  }

  const lineTotal = item.unit_price_cents * qty

  return (
    <li className="flex gap-4 border-b border-white/5 px-4 py-4 last:border-0">
      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-[#111827]">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl text-gray-700" aria-hidden>📦</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{item.name}</div>
            {item.sku && <div className="text-[10px] font-mono text-gray-500">SKU {item.sku}</div>}
            {item.packaging_label && <div className="text-[10px] text-gray-500">{item.packaging_label}</div>}
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-xs text-red-400 hover:underline disabled:opacity-60"
          >
            Retirer
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#111827]">
            <button
              type="button"
              onClick={() => updateQty(qty - 1)}
              disabled={busy || qty <= 1}
              className="px-2 py-1 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v >= 1) setQty(Math.floor(v))
              }}
              onBlur={() => updateQty(qty)}
              className="w-12 bg-transparent text-center text-sm text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => updateQty(qty + 1)}
              disabled={busy}
              className="px-2 py-1 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">{fmtMoney(item.unit_price_cents, currency)} / unité</div>
            <div className="text-sm font-bold text-white">{fmtMoney(lineTotal, currency)}</div>
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}
      </div>
    </li>
  )
}
