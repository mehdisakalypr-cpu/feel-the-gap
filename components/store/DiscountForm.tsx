'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { eurosToCents } from './_utils'

export function DiscountForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [discType, setDiscType] = useState<'fixed' | 'percent'>('percent')
  const [value, setValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!code.trim()) { setErr('Code requis.'); return }
    const numericValue = Number(value.replace(',', '.'))
    if (!isFinite(numericValue) || numericValue <= 0) { setErr('Valeur invalide.'); return }
    if (discType === 'percent' && numericValue > 100) { setErr('Pourcentage 0-100.'); return }

    setBusy(true)
    try {
      const r = await fetch('/api/store/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discount_type: discType,
          discount_value: discType === 'fixed' ? eurosToCents(value) : numericValue,
          max_uses: maxUses ? Number(maxUses) : null,
          ends_at: endsAt || null,
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur.')
      } else {
        setCode(''); setValue(''); setMaxUses(''); setEndsAt('')
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-[#0D1117] p-4">
      {err && <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_1fr_140px_auto]">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="CODE (BLACKFRI)"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs uppercase text-white"
        />
        <select
          value={discType}
          onChange={e => setDiscType(e.target.value as 'fixed' | 'percent')}
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        >
          <option value="percent">% remise</option>
          <option value="fixed">\u20ac fixe</option>
        </select>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={discType === 'percent' ? '10' : '5.00 \u20ac'}
          inputMode="decimal"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          value={maxUses}
          onChange={e => setMaxUses(e.target.value)}
          placeholder="Usages max"
          inputMode="numeric"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <input
          value={endsAt}
          onChange={e => setEndsAt(e.target.value)}
          type="datetime-local"
          className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-white"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:opacity-50">
          + Ajouter
        </button>
      </div>
    </form>
  )
}
