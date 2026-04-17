'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'

export type UpgradeTier = 'data' | 'strategy' | 'premium'

const TIER_META: Record<UpgradeTier, {
  name: string
  nameFr: string
  monthlyEur: number
  emoji: string
  color: string
  perks: { fr: string[]; en: string[] }
}> = {
  data: {
    name: 'Data',
    nameFr: 'Data',
    monthlyEur: 19,
    emoji: '📊',
    color: '#60A5FA',
    perks: {
      fr: ['Rapport d\'opportunités complet', 'Vidéos terrain', 'Exports CSV'],
      en: ['Full opportunities report', 'Field videos', 'CSV exports'],
    },
  },
  strategy: {
    name: 'Strategy',
    nameFr: 'Strategy',
    monthlyEur: 49,
    emoji: '💼',
    color: '#C9A84C',
    perks: {
      fr: ['Études approfondies', 'Business plans 3 scénarios', 'Clients B2B matchés IA'],
      en: ['In-depth studies', '3-scenario business plans', 'AI-matched B2B buyers'],
    },
  },
  premium: {
    name: 'Premium',
    nameFr: 'Premium',
    monthlyEur: 99,
    emoji: '🏪',
    color: '#A78BFA',
    perks: {
      fr: ['Site e-commerce clé en main', 'Support prioritaire', 'Toutes les offres inférieures'],
      en: ['Ready-to-sell e-commerce', 'Priority support', 'All lower tiers included'],
    },
  },
}

interface UpgradeOfferModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  targetTier: UpgradeTier
  currentTier: string
  subscriptionEndsAt: string | null
  lang: 'fr' | 'en'
}

function tierMonthly(t: string): number {
  const map: Record<string, number> = {
    free: 0, explorer: 0,
    basic: 19, data: 19,
    standard: 49, strategy: 49,
    premium: 99, enterprise: 299,
  }
  return map[t] ?? 0
}

export default function UpgradeOfferModal({
  open, onClose, onSuccess, targetTier, currentTier, subscriptionEndsAt, lang,
}: UpgradeOfferModalProps) {
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset success state when opening a fresh modal
  useEffect(() => { if (open) setSuccess(false) }, [open, targetTier])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Listen for Stripe success return (?upgrade=success)
  useEffect(() => {
    if (!open) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('upgrade') === 'success') {
      setSuccess(true)
      // Clean the URL so refresh doesn't retrigger
      url.searchParams.delete('upgrade')
      window.history.replaceState({}, '', url.toString())
      onSuccess?.()
    }
  }, [open, onSuccess])

  if (!open) return null

  const meta = TIER_META[targetTier]
  const targetPrice = meta.monthlyEur
  const currentPrice = tierMonthly(currentTier)

  // Proration: remaining days on current subscription = credit pro-rata
  // Stripe handles the real proration; this is the UX preview.
  let creditEur = 0
  let remainingDays = 0
  if (subscriptionEndsAt && currentPrice > 0) {
    const end = new Date(subscriptionEndsAt).getTime()
    const now = Date.now()
    const msPerDay = 86_400_000
    remainingDays = Math.max(0, Math.ceil((end - now) / msPerDay))
    if (remainingDays > 30) remainingDays = 30
    creditEur = Math.round((remainingDays / 30) * currentPrice * 100) / 100
  }
  const dueEur = Math.max(0, Math.round((targetPrice - creditEur) * 100) / 100)

  const fr = lang === 'fr'
  const tierLabel = fr ? meta.nameFr : meta.name
  const perks = fr ? meta.perks.fr : meta.perks.en

  async function onPay() {
    if (paying) return
    setPaying(true)
    try {
      // Build return URL back to the current page with a success marker so the
      // modal (or the sidebar) can show the celebration state on return.
      const returnUrl = new URL(window.location.href)
      returnUrl.searchParams.set('upgrade', 'success')
      // Stripe checkout endpoint only knows "starter" and "premium" plans today.
      // Map sidebar tiers to the closest Stripe plan until dedicated Price IDs
      // are wired for data/strategy/premium.
      const planParam = targetTier === 'premium' ? 'premium' : 'starter'
      const href = `/api/stripe/checkout?plan=${planParam}&return_to=${encodeURIComponent(returnUrl.toString())}`
      window.location.assign(href)
    } finally {
      // keep paying=true while redirecting; onload of next page resets state
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="hidden lg:block fixed left-80 top-16 bottom-0 w-[420px] z-40 bg-[#0B0F1A]/98 border-r border-white/10 backdrop-blur-md overflow-y-auto shadow-2xl animate-in slide-in-from-left-4 duration-200"
    >
      <div className="p-6">
        <button
          onClick={onClose}
          aria-label={fr ? 'Fermer' : 'Close'}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-sm transition-colors"
        >
          ✕
        </button>

        {success ? (
          <div className="text-center py-10">
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <div className="text-xl font-bold text-white mb-1">
              {fr ? 'Félicitations !' : 'Congratulations!'}
            </div>
            <div className="text-sm text-gray-300 mb-6" style={{ color: meta.color }}>
              {fr
                ? <>Vous êtes maintenant <strong>{tierLabel}</strong></>
                : <>You are now <strong>{tierLabel}</strong></>}
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{ background: meta.color, color: '#07090F' }}
            >
              {fr ? 'Continuer la lecture →' : 'Continue reading →'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5 pr-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: meta.color + '22', border: `1px solid ${meta.color}55` }}
              >
                {meta.emoji}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  {fr ? 'Passer à' : 'Upgrade to'}
                </div>
                <div className="text-xl font-bold text-white">{tierLabel}</div>
              </div>
            </div>

            <ul className="space-y-2 mb-5">
              {perks.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span style={{ color: meta.color }} className="mt-0.5 shrink-0">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <div
              className="rounded-2xl p-4 mb-4 border"
              style={{ background: meta.color + '0D', borderColor: meta.color + '33' }}
            >
              <div className="flex items-baseline justify-between text-sm mb-2">
                <span className="text-gray-400">{fr ? `${tierLabel} — mensuel` : `${tierLabel} — monthly`}</span>
                <span className="text-white font-semibold">{targetPrice.toFixed(2)} €</span>
              </div>

              {currentPrice > 0 && creditEur > 0 && (
                <div className="flex items-baseline justify-between text-xs mb-2">
                  <span className="text-emerald-400">
                    {fr
                      ? `Crédit prorata (${remainingDays} j restants sur ${currentTier})`
                      : `Prorated credit (${remainingDays}d left on ${currentTier})`}
                  </span>
                  <span className="text-emerald-400 font-semibold">− {creditEur.toFixed(2)} €</span>
                </div>
              )}

              <div className="h-px bg-white/10 my-2" />

              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-300">{fr ? 'À régler aujourd\'hui' : 'Due today'}</span>
                <span
                  className="text-2xl font-bold"
                  style={{ color: meta.color }}
                >
                  {dueEur.toFixed(2)} €
                </span>
              </div>
              {currentPrice > 0 && creditEur > 0 && (
                <div className="text-[10px] text-gray-500 mt-2 leading-snug">
                  {fr
                    ? 'Le crédit correspond aux jours non consommés de votre abonnement actuel.'
                    : 'Credit matches unused days of your current subscription.'}
                </div>
              )}
            </div>

            <button
              onClick={onPay}
              disabled={paying}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
              style={{ background: meta.color, color: '#07090F' }}
            >
              {paying && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {fr ? `Payer ${dueEur.toFixed(2)} € →` : `Pay ${dueEur.toFixed(2)} € →`}
            </button>

            <div className="text-[10px] text-center text-gray-500 mt-3">
              {fr
                ? 'Paiement sécurisé via Stripe · Résiliable à tout moment'
                : 'Secure Stripe payment · Cancel anytime'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
