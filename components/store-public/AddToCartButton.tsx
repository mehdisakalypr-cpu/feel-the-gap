// © 2025-2026 Feel The Gap — add-to-cart client widget
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface VariantOption {
  id: string
  label: string
  price_cents?: number | null
  stock_qty?: number
}

interface Props {
  storeSlug: string
  productId: string
  maxQty?: number
  variants?: VariantOption[]
  accent?: string
  unitLabel?: string | null
  defaultQty?: number
  disabled?: boolean
}

export function AddToCartButton({
  storeSlug,
  productId,
  maxQty,
  variants,
  accent = '#C9A84C',
  unitLabel,
  defaultQty = 1,
  disabled,
}: Props) {
  const router = useRouter()
  const [qty, setQty] = useState(defaultQty)
  const [variantId, setVariantId] = useState<string | null>(variants?.[0]?.id ?? null)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = () => {
    if (busy || disabled) return
    setError(null)
    setDone(false)
    const body = {
      action: 'add',
      product_id: productId,
      variant_id: variantId,
      qty,
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/store/${encodeURIComponent(storeSlug)}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError((j as { error?: string }).error || 'Ajout impossible')
          return
        }
        setDone(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    })
  }

  return (
    <div className="space-y-3">
      {variants && variants.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Variante
          </label>
          <select
            value={variantId ?? ''}
            onChange={e => setVariantId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
          >
            {variants.map(v => (
              <option key={v.id} value={v.id} disabled={(v.stock_qty ?? 1) <= 0}>
                {v.label}
                {v.stock_qty !== undefined && v.stock_qty <= 0 ? ' (rupture)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#111827]">
          <button
            type="button"
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="px-3 py-2 text-lg text-white hover:bg-white/5"
            aria-label="Diminuer"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={maxQty ?? 9999}
            value={qty}
            onChange={e => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) setQty(Math.max(1, Math.min(maxQty ?? 9999, Math.floor(v))))
            }}
            className="w-14 bg-transparent text-center text-sm text-white focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQty(q => Math.min(maxQty ?? 9999, q + 1))}
            className="px-3 py-2 text-lg text-white hover:bg-white/5"
            aria-label="Augmenter"
          >
            +
          </button>
          {unitLabel && (
            <span className="border-l border-white/10 px-3 text-xs text-gray-400">{unitLabel}</span>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={submit}
          className="flex-1 rounded-xl px-5 py-3 text-sm font-bold text-[#07090F] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: accent }}
        >
          {busy ? 'Ajout…' : done ? '✓ Ajouté au panier' : 'Ajouter au panier'}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {done && !error && (
        <a
          href={`/store/${encodeURIComponent(storeSlug)}/cart`}
          className="block text-center text-xs text-[#C9A84C] hover:underline"
        >
          Voir mon panier →
        </a>
      )}
    </div>
  )
}
