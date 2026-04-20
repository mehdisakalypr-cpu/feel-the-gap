'use client'

/**
 * FlashOfferModal — proposes a flash upgrade or top-up when the user reaches
 * their Fill-the-Gap opportunity quota while ticking opportunities.
 *
 * Design : full-screen on mobile, centered card on desktop. 3 actions :
 *   1. Buy a top-up pack (jumps to /api/stripe/checkout?pack=50)
 *   2. Upgrade to nextTierUp(currentTier) (jumps to /api/stripe/checkout?plan=…)
 *   3. "Plus tard" → simply closes the modal.
 *
 * The component is purely presentational + redirect. The parent owns the
 * decision of when to open it (typically when balance === 0 on tick).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  PLAN_PRICE_EUR,
  TOPUP_PACKS,
  FILLTHEGAP_QUOTA_BY_TIER,
  type PlanTier,
} from '@/lib/credits/costs'
import { nextTierUp, ctaLabelFor } from '@/lib/credits/tier-helpers'

const TIER_GRADIENT: Record<string, string> = {
  starter:       'linear-gradient(135deg,#60A5FA,#3B82F6)',
  strategy:      'linear-gradient(135deg,#C9A84C,#E8C97A)',
  premium:       'linear-gradient(135deg,#A78BFA,#8B5CF6)',
  ultimate:      'linear-gradient(135deg,#34D399,#10B981)',
  solo_producer: 'linear-gradient(135deg,#34D399,#10B981)',
}

export interface FlashOfferModalProps {
  open: boolean
  onClose: () => void
  /** Current tier of the authenticated user (canonical PlanTier, e.g. 'premium'). */
  currentTier: PlanTier
  /** How many Fill-the-Gap credits the user has consumed this month. */
  used: number
  /** Their monthly grant (e.g. 150 for Premium). 0 means tier has no FTG quota. */
  grant: number
  /** Optional pack size to push (defaults to 50 — the cheapest unit price). */
  packSize?: 10 | 20 | 30 | 50
}

export default function FlashOfferModal({
  open,
  onClose,
  currentTier,
  used,
  grant,
  packSize = 50,
}: FlashOfferModalProps) {
  // Fake-but-honest urgency timer (15 minutes) — purely visual reassurance the
  // offer is valid right now. Persists per modal-open so it doesn't reset on
  // re-render. Stops at 0 (button still works after).
  const [secondsLeft, setSecondsLeft] = useState(15 * 60)
  useEffect(() => {
    if (!open) return
    setSecondsLeft(15 * 60)
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [open])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const target = useMemo<PlanTier | null>(() => nextTierUp(currentTier), [currentTier])
  const upgradeLabel = useMemo(() => {
    if (!target) return null
    return ctaLabelFor(currentTier, target, true)
  }, [currentTier, target])

  // Pack pricing
  const pack = useMemo(
    () => TOPUP_PACKS.find((p) => p.size === packSize) ?? TOPUP_PACKS[3],
    [packSize],
  )

  if (!open) return null

  const targetPrice = target ? PLAN_PRICE_EUR[target] : null
  const targetGrant = target ? FILLTHEGAP_QUOTA_BY_TIER[target] : 0
  const gradient    = target ? (TIER_GRADIENT[target] ?? TIER_GRADIENT.premium) : TIER_GRADIENT.premium

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function goTopup() {
    const returnTo = encodeURIComponent(window.location.href)
    window.location.assign(`/api/stripe/checkout?pack=${pack.size}&return_to=${returnTo}`)
  }

  function goUpgrade() {
    if (!target) return
    const returnTo = encodeURIComponent(window.location.href)
    window.location.assign(`/api/stripe/checkout?plan=${target}&return_to=${returnTo}`)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flash-offer-title"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden bg-[#0B0F1A] text-white shadow-2xl rounded-t-3xl sm:rounded-3xl border border-[#C9A84C]/30 animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Urgency banner */}
        <div
          className="px-5 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#07090F]"
          style={{ background: 'linear-gradient(90deg,#FBBF24,#F59E0B,#FBBF24)' }}
        >
          ⚡ Offre flash — débloquez votre prochaine opportunité maintenant
          {' · '}
          <span className="font-mono tabular-nums">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>

        <div className="p-6 sm:p-7">
          <div className="mb-4 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <h2 id="flash-offer-title" className="text-xl font-bold">
              Quota d'opportunités atteint
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Vous avez utilisé{' '}
              <strong className="text-white">{used}</strong>
              {grant > 0 ? <> sur <strong className="text-white">{grant}</strong></> : null}{' '}
              opportunité{used > 1 ? 's' : ''} Fill-the-Gap ce mois-ci.
            </p>
            <p className="text-sm text-gray-400">
              Pour cocher d'autres opportunités, choisissez l'une de ces options :
            </p>
          </div>

          {/* Option 1 — top-up pack */}
          <button
            type="button"
            onClick={goTopup}
            className="group mb-3 w-full rounded-2xl border border-[#34D399]/40 bg-[#34D399]/5 p-4 text-left transition-all hover:border-[#34D399] hover:bg-[#34D399]/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-[#34D399] font-bold mb-0.5">
                  Recharge ponctuelle
                </div>
                <div className="text-base font-bold">
                  Pack {pack.size} opportunités
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {pack.unit.toFixed(2)} € l'unité · valide 12 mois
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-[#34D399]">
                  {pack.price} €
                </div>
                <div className="text-[11px] text-gray-500 group-hover:text-[#34D399] transition-colors">
                  Acheter →
                </div>
              </div>
            </div>
          </button>

          {/* Option 2 — upgrade */}
          {target && upgradeLabel && targetPrice != null && (
            <button
              type="button"
              onClick={goUpgrade}
              className="group mb-3 w-full rounded-2xl p-px transition-transform hover:scale-[1.01]"
              style={{ background: gradient }}
            >
              <div className="rounded-[15px] bg-[#0B0F1A] p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div
                      className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                      style={{ background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      Recommandé · économique
                    </div>
                    <div className="text-base font-bold">
                      {upgradeLabel}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {targetGrant > 0
                        ? <><strong className="text-white">{targetGrant} opportunités</strong> Fill-the-Gap chaque mois</>
                        : 'Tout débloqué — sans plafond'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="text-2xl font-black"
                      style={{ background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      {targetPrice} €
                    </div>
                    <div className="text-[11px] text-gray-500">/ mois</div>
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Option 3 — later */}
          <button
            type="button"
            onClick={onClose}
            className="block w-full text-center text-xs text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline mt-2 py-2"
          >
            Plus tard
          </button>

          <div className="mt-3 text-[10px] text-center text-gray-600">
            Paiement sécurisé via Stripe · Résiliable à tout moment
          </div>
        </div>
      </div>
    </div>
  )
}
