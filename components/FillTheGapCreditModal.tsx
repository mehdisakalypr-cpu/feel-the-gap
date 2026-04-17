'use client'

import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'

export type FillTheGapAction = 'video' | 'clients' | 'store' | 'recap' | 'ai_engine' | 'bp_bulk'

export type FillTheGapCreditModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  action: FillTheGapAction
  quantity?: number
  balance: number
  monthlyGrant: number
  periodEnd?: string | Date | null
  tier: 'premium' | 'ultimate'
}

const ACTION_LABELS: Record<FillTheGapAction, string> = {
  video:     'Visionner la vidéo de formation',
  clients:   'Révéler les clients potentiels',
  store:     'Créer le site e-commerce',
  recap:     'Générer le récap Fill the Gap',
  ai_engine: 'Lancer l\'AI Engine personnalisé',
  bp_bulk:   'Générer les business plans sélectionnés',
}

function formatFrDate(d: string | Date | null | undefined): string {
  if (!d) return '1er du mois prochain'
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    if (Number.isNaN(date.getTime())) return '1er du mois prochain'
    return date.toLocaleDateString('fr-FR', {
      day:   'numeric',
      month: 'long',
      year:  'numeric',
    })
  } catch {
    return '1er du mois prochain'
  }
}

export function FillTheGapCreditModal({
  open,
  onClose,
  onConfirm,
  action,
  quantity = 1,
  balance,
  monthlyGrant,
  periodEnd,
  tier,
}: FillTheGapCreditModalProps) {
  const [loading, setLoading] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Reset loading when modal opens/closes
  useEffect(() => {
    if (!open) setLoading(false)
  }, [open])

  // Esc to close + focus confirm on open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', onKey)
    // focus confirm on open (basic trap)
    const t = setTimeout(() => confirmRef.current?.focus(), 40)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const qty = Math.max(1, Math.floor(quantity))
  const remainingAfter = Math.max(0, balance - qty)
  const hasEnough = balance >= qty
  const creditWord = qty === 1 ? '1 crédit' : `${qty} crédits`
  const dateLabel = formatFrDate(periodEnd)

  async function handleConfirm() {
    if (loading || !hasEnough) return
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      console.error('[FillTheGapCreditModal] onConfirm failed', err)
      setLoading(false)
    }
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !loading) onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ftg-credit-modal-title"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          disabled={loading}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
        >
          ✕
        </button>

        {/* Title */}
        <div className="mb-3 flex items-center gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2
            id="ftg-credit-modal-title"
            className="text-lg font-semibold text-zinc-900"
          >
            Consommer {creditWord} Fill the Gap ?
          </h2>
        </div>

        {/* Action description */}
        <p className="mb-4 text-sm text-zinc-600">
          Action : <span className="font-medium text-zinc-900">{ACTION_LABELS[action]}</span>
        </p>

        {/* Body */}
        <div className="mb-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          {hasEnough ? (
            <p className="text-sm text-zinc-700">
              Il vous restera{' '}
              <strong className="text-emerald-600">{remainingAfter}</strong> crédits sur{' '}
              <strong>{monthlyGrant}</strong> ce mois-ci.
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Vous avez <strong>{balance}</strong> crédit{balance > 1 ? 's' : ''} sur{' '}
              <strong>{monthlyGrant}</strong>, il en faut <strong>{qty}</strong> pour cette action.
            </p>
          )}
        </div>

        {/* Info reset date */}
        <p className="mb-5 text-xs text-zinc-500">
          Votre compteur sera rechargé au maximum le <strong>{dateLabel}</strong>.
        </p>

        {/* Buttons */}
        {hasEnough ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-70"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Confirmation…' : 'Confirmer'}
            </button>
          </div>
        ) : tier === 'premium' ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Annuler
            </button>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
            >
              Passer Ultimate
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-2">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
              Quota atteint — reset le <strong>{dateLabel}</strong>
            </p>
            <button
              type="button"
              ref={confirmRef}
              onClick={onClose}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default FillTheGapCreditModal
