'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { eurosToCents, fmtMoney } from './_utils'

interface Props {
  orderId: string
  status: string
  refundable: number
  currency: string
}

export function OrderActions({ orderId, status, refundable, currency }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<'refund' | 'invoice' | null>(null)
  const [refundAmt, setRefundAmt] = useState('')
  const [refundReason, setRefundReason] = useState('')

  async function reissueInvoice() {
    if (!confirm('R\u00e9-\u00e9diter la facture ? Une nouvelle version sera g\u00e9n\u00e9r\u00e9e.')) return
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`/api/store/orders/${orderId}/invoice`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok || j.error) setErr(j.message ?? j.error ?? 'Erreur')
      else router.refresh()
    } finally { setBusy(false) }
  }

  async function submitRefund() {
    setErr(null)
    const amount = refundAmt ? eurosToCents(refundAmt) : refundable
    if (!amount || amount <= 0) { setErr('Montant invalide.'); return }
    if (amount > refundable) { setErr(`Maximum ${fmtMoney(refundable, currency)}.`); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/store/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amount, reason: refundReason.trim() || null }),
      })
      const j = await r.json()
      if (!r.ok || j.error) {
        setErr(j.message ?? j.error ?? 'Erreur lors du remboursement.')
      } else {
        setOpen(null)
        router.refresh()
      }
    } finally { setBusy(false) }
  }

  const canRefund = (status === 'paid' || status === 'fulfilled' || status === 'refunded') && refundable > 0
  const canReinvoice = status !== 'pending' && status !== 'cancelled'

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {canReinvoice && (
          <button
            onClick={reissueInvoice}
            disabled={busy}
            className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
          >
            R\u00e9-\u00e9diter facture
          </button>
        )}
        {canRefund && (
          <button
            onClick={() => setOpen('refund')}
            disabled={busy}
            className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
          >
            Rembourser
          </button>
        )}
      </div>
      {err && <span className="text-xs text-red-400">{err}</span>}

      {open === 'refund' && (
        <div className="mt-2 w-80 rounded-xl border border-white/10 bg-[#0D1117] p-4 shadow-xl">
          <div className="mb-2 text-sm font-semibold text-white">Remboursement</div>
          <div className="mb-3 text-xs text-gray-400">Disponible : {fmtMoney(refundable, currency)}</div>
          <input
            value={refundAmt}
            onChange={e => setRefundAmt(e.target.value)}
            placeholder={`Montant en \u20ac (vide = total ${fmtMoney(refundable, currency)})`}
            inputMode="decimal"
            className="mb-2 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white"
          />
          <textarea
            value={refundReason}
            onChange={e => setRefundReason(e.target.value)}
            placeholder="Motif (optionnel)"
            rows={2}
            className="mb-3 w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(null)} disabled={busy} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10">
              Annuler
            </button>
            <button onClick={submitRefund} disabled={busy} className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-400 disabled:opacity-50">
              {busy ? 'Traitement\u2026' : 'Valider'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
