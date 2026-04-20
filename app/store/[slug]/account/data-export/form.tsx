// © 2025-2026 Feel The Gap — RGPD export trigger
'use client'

import { useState, useCallback } from 'react'

interface Props { slug: string }

export function ExportButton({ slug }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trigger = useCallback(async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/store/${encodeURIComponent(slug)}/account/data-export`)
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null
        setError(j?.error ?? 'Export impossible')
        setBusy(false)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mes-donnees-${slug}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setBusy(false)
    }
  }, [slug, busy])

  return (
    <div className="space-y-3">
      <button
        onClick={trigger}
        disabled={busy}
        className="rounded-xl bg-[#C9A84C] px-5 py-3 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-60"
      >
        {busy ? 'Préparation…' : 'Télécharger mes données (JSON)'}
      </button>
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
