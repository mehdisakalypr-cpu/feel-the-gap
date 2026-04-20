// © 2025-2026 Feel The Gap — discount code input (client)
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  storeSlug: string
  initialError?: string | null
}

export function DiscountCodeForm({ storeSlug, initialError }: Props) {
  void storeSlug
  // Discount validation happens at checkout/intent time. Here we only persist
  // the code to a cookie via a tiny POST call; for now keep it client-only.
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [applied, setApplied] = useState<string | null>(null)
  const router = useRouter()

  const submit = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      // Persist the code in a same-site cookie via a lightweight endpoint
      // (handled by /api/store/[slug]/cart with action=discount). If the
      // endpoint isn't available we fall back to client-side echo.
      document.cookie = `ftg_discount_code=${encodeURIComponent(code.trim())}; path=/; max-age=900; samesite=lax`
      setApplied(code.trim().toUpperCase())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide')
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    document.cookie = `ftg_discount_code=; path=/; max-age=0`
    setApplied(null)
    setCode('')
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-4">
      <label htmlFor="discount" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Code promo
      </label>
      {applied ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <span>✓ {applied}</span>
          <button type="button" onClick={remove} className="text-[10px] text-red-400 hover:underline">
            Retirer
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            id="discount"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
            placeholder="SUMMER25"
            className="flex-1 rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm uppercase tracking-wide text-white focus:border-[#C9A84C] focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !code.trim()}
            className="rounded-lg bg-[#C9A84C] px-3 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60"
          >
            Appliquer
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2 text-xs text-red-400">{error}</div>
      )}
      <p className="mt-2 text-[10px] text-gray-500">
        Le code sera validé à la finalisation de la commande.
      </p>
    </div>
  )
}
