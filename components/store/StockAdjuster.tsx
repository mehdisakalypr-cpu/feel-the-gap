'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  productId: string
  unit: string
  disabled?: boolean
}

export function StockAdjuster({ productId, unit, disabled }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'restock' | 'adjustment'>('restock')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const delta = Number(qty.replace(',', '.'))
    if (!isFinite(delta) || delta === 0) { setErr('Quantit\u00e9 invalide.'); return }

    setBusy(true)
    try {
      const r = await fetch(`/api/store/stocks/${productId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_delta: delta, type, notes: notes.trim() || null }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur.')
      } else {
        setOpen(false); setQty(''); setNotes('')
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  if (disabled) return <span className="text-[10px] text-gray-600">stock illimit\u00e9</span>

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10">
        Ajuster
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="inline-flex flex-col gap-1.5 rounded-lg border border-white/10 bg-[#0D1117] p-2 text-left">
      <div className="flex items-center gap-1">
        <select value={type} onChange={e => setType(e.target.value as 'restock' | 'adjustment')} className="rounded-md bg-[#111827] px-2 py-1 text-[10px] text-white">
          <option value="restock">R\u00e9appro</option>
          <option value="adjustment">Ajustement</option>
        </select>
        <input
          value={qty}
          onChange={e => setQty(e.target.value)}
          inputMode="decimal"
          placeholder={`+/- ${unit}`}
          className="w-20 rounded-md border border-white/10 bg-[#111827] px-2 py-1 text-[10px] text-white"
        />
        <button type="submit" disabled={busy} className="rounded-md bg-[#C9A84C] px-2 py-1 text-[10px] font-bold text-[#07090F] disabled:opacity-50">
          {busy ? '\u2026' : 'OK'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setErr(null) }} className="text-[10px] text-gray-500 hover:text-gray-300">
          Annuler
        </button>
      </div>
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Note (optionnel)"
        className="rounded-md border border-white/10 bg-[#111827] px-2 py-1 text-[10px] text-white"
      />
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </form>
  )
}
