'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ActivateButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function activate() {
    setErr(null)
    setLoading(true)
    try {
      const r = await fetch('/api/store/activate', { method: 'POST' })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Activation impossible.')
      } else {
        router.refresh()
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'R\u00e9seau indisponible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={activate}
        disabled={disabled || loading}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-[#07090F] transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Activation\u2026' : 'Activer ma boutique'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
      {disabled && !err && (
        <span className="text-[10px] text-gray-500">Compl\u00e9tez la checklist pour activer.</span>
      )}
    </div>
  )
}
