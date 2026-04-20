'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CampaignForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [pct, setPct] = useState('')
  const [productIds, setProductIds] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) { setErr('Nom requis.'); return }
    const numPct = Number(pct.replace(',', '.'))
    if (!isFinite(numPct) || numPct <= 0 || numPct > 100) { setErr('Pourcentage 0-100.'); return }
    const ids = productIds.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
    if (!ids.length) { setErr('Au moins 1 ID produit.'); return }
    if (!startsAt || !endsAt) { setErr('Dates de d\u00e9but et fin requises.'); return }

    setBusy(true)
    try {
      const r = await fetch('/api/store/discount-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          discount_pct: numPct,
          product_ids: ids,
          starts_at: startsAt,
          ends_at: endsAt,
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur.')
      } else {
        setName(''); setPct(''); setProductIds(''); setStartsAt(''); setEndsAt('')
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
      {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      <div className="grid gap-2 sm:grid-cols-[2fr_120px_1fr_1fr_auto]">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom (Soldes \u00e9t\u00e9)"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          value={pct}
          onChange={e => setPct(e.target.value)}
          placeholder="% remise"
          inputMode="decimal"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          value={startsAt}
          onChange={e => setStartsAt(e.target.value)}
          type="datetime-local"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          value={endsAt}
          onChange={e => setEndsAt(e.target.value)}
          type="datetime-local"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-50">
          + Cr\u00e9er
        </button>
      </div>
      <textarea
        value={productIds}
        onChange={e => setProductIds(e.target.value)}
        placeholder="IDs produits (s\u00e9par\u00e9s par virgule ou espace)"
        rows={2}
        className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 font-mono text-[11px] text-white"
      />
    </form>
  )
}
