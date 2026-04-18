'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLang } from '@/components/LanguageProvider'
import { createSupabaseBrowser } from '@/lib/supabase'
import UpgradeOfferModal, { type UpgradeTier } from '@/components/UpgradeOfferModal'

export type JourneyStep = 'country' | 'report' | 'studies' | 'methods' | 'business_plan' | 'clients' | 'videos' | 'store' | 'recap' | 'success'

type Phase = 'feel' | 'fill'

interface Step {
  id: JourneyStep
  tier: 'explorer' | 'data' | 'strategy' | 'premium'
  phase: Phase
  labelFr: string
  labelEn: string
  descFr: string
  descEn: string
  icon: string
  href: (iso: string) => string
  optional?: boolean
}

const ALL_STEPS: Step[] = [
  { id: 'country',       phase: 'feel', tier: 'explorer', labelFr: 'Fiche pays',                 labelEn: 'Country sheet',            descFr: 'Vue d\'ensemble du marché',         descEn: 'Market overview',                icon: '🌍', href: (iso) => `/country/${iso}` },
  { id: 'report',        phase: 'feel', tier: 'data',     labelFr: 'Rapport d\'opportunités',    labelEn: 'Opportunities report',     descFr: 'Analyse détaillée',                 descEn: 'Detailed analysis',              icon: '📊', href: (iso) => `/reports/${iso}` },
  { id: 'studies',       phase: 'feel', tier: 'strategy', labelFr: 'Études approfondies',        labelEn: 'In-depth studies',         descFr: 'Recherche avancée',                 descEn: 'Advanced research',              icon: '📑', href: (iso) => `/country/${iso}?tab=studies`, optional: true },
  { id: 'methods',       phase: 'feel', tier: 'strategy', labelFr: 'Méthodes de production',    labelEn: 'Production methods',       descFr: 'Comparateur multi-critères',        descEn: 'Multi-criteria comparator',      icon: '🏭', href: (iso) => `/country/${iso}/methods` },
  { id: 'business_plan', phase: 'feel', tier: 'strategy', labelFr: 'Business plan',              labelEn: 'Business plan',            descFr: '3 scénarios chiffrés',              descEn: '3 costed scenarios',             icon: '💼', href: (iso) => `/country/${iso}/enriched-plan` },
  { id: 'videos',        phase: 'fill', tier: 'data',     labelFr: 'Vidéos de ce marché',        labelEn: 'Videos on this market',    descFr: 'Formation + insights terrain',      descEn: 'Training + field insights',      icon: '🎬', href: (iso) => `/country/${iso}/videos` },
  { id: 'clients',       phase: 'feel', tier: 'strategy', labelFr: 'Clients potentiels',         labelEn: 'Potential customers',      descFr: 'Acheteurs B2B matchés par IA',      descEn: 'AI-matched B2B buyers',          icon: '🎯', href: (iso) => `/country/${iso}/clients` },
  { id: 'recap',         phase: 'fill', tier: 'explorer', labelFr: 'Synthèse de l\'opportunité', labelEn: 'Opportunity recap',        descFr: 'Tout ce que vous avez débloqué',    descEn: 'Everything you\'ve unlocked',    icon: '🎖️', href: (iso) => `/country/${iso}/recap` },
  // Store is the LAST step of the journey and is optional — it never blocks
  // completion of the journey.
  { id: 'store',         phase: 'fill', tier: 'premium',  labelFr: 'Site e-commerce en 5 min',   labelEn: 'E-commerce site in 5 min', descFr: 'Mini-site marchand prêt à vendre',  descEn: 'Ready-to-sell seller mini-site', icon: '🏪', href: (iso) => `/country/${iso}/store`, optional: true },
]

const TIER_RANK: Record<string, number> = {
  free: 0, explorer: 0,
  basic: 1, data: 1,
  standard: 2, strategy: 2,
  premium: 3,
  ultimate: 4,
  enterprise: 5,
}

const TIER_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  data:     { fr: 'Data',     en: 'Data',     color: '#60A5FA' },
  strategy: { fr: 'Strategy', en: 'Strategy', color: '#C9A84C' },
  premium:  { fr: 'Premium',  en: 'Premium',  color: '#A78BFA' },
  ultimate: { fr: 'Ultimate', en: 'Ultimate', color: '#34D399' },
}

interface JourneySidebarProps {
  iso: string
  currentStep: JourneyStep
  userTier?: string
  hasStudies?: boolean
}

export default function JourneySidebar({ iso, currentStep, userTier: initialTier = 'free', hasStudies = false }: JourneySidebarProps) {
  const { lang } = useLang()
  const L: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr'

  // Tier and subscription end date drive both the access column and the
  // upgrade modal proration. We refetch when the modal reports success so
  // the sidebar reflects the new tier without a page reload.
  const [userTier, setUserTier] = useState(initialTier)
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null)
  const userRank = TIER_RANK[userTier] ?? 0

  const [upgradeTarget, setUpgradeTarget] = useState<UpgradeTier | null>(null)

  // Fill-the-Gap monthly quota (Premium 150 / Ultimate 250). Only fetched
  // when the user is on a tier that has a quota. Gracefully hidden on error.
  const [ftgQuota, setFtgQuota] = useState<{
    balance: number
    grant: number
    plan: string
    periodEnd: string | null
  } | null>(null)

  const showFtgCounter = userTier === 'premium' || userTier === 'ultimate'

  useEffect(() => {
    if (!showFtgCounter) { setFtgQuota(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/credits/fillthegap/balance', { cache: 'no-store' })
        if (!res.ok) { if (!cancelled) setFtgQuota(null); return }
        const json = await res.json()
        if (cancelled) return
        if (!json?.ok) { setFtgQuota(null); return }
        setFtgQuota({
          balance: Number(json.balance ?? 0),
          grant: Number(json.grant ?? 0),
          plan: String(json.plan ?? 'free'),
          periodEnd: json.periodEnd ?? null,
        })
      } catch {
        if (!cancelled) setFtgQuota(null)
      }
    })()
    return () => { cancelled = true }
  }, [showFtgCounter, userTier])

  const refreshProfile = async () => {
    const sb = createSupabaseBrowser()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { data } = await sb
      .from('profiles')
      .select('tier, subscription_ends_at')
      .eq('id', user.id)
      .single()
    if (data?.tier) setUserTier(data.tier)
    setSubscriptionEndsAt((data as { subscription_ends_at?: string | null })?.subscription_ends_at ?? null)
  }

  useEffect(() => { refreshProfile() }, [])

  const steps = ALL_STEPS.filter(s => s.id !== 'studies' || hasStudies)
  const totalSteps = steps.length
  const accessibleCount = steps.filter(s => userRank >= TIER_RANK[s.tier]).length

  // Optional steps must never block journey completion. We keep them visible
  // in the sidebar but exclude them from the progress denominator, so the
  // journey is considered "complete" once every required step is done.
  const requiredSteps = steps.filter(s => !s.optional)
  const requiredTotal = requiredSteps.length
  const currentRequiredIdx = requiredSteps.findIndex(s => s.id === currentStep)
  // If the user is currently on an optional step (e.g. Store), treat all
  // required steps as done for the progress bar.
  const progressCount = currentRequiredIdx >= 0 ? currentRequiredIdx + 1 : requiredTotal
  const progressPct = requiredTotal > 0 ? (progressCount / requiredTotal) * 100 : 0

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-16 w-80 h-[calc(100vh-4rem)] overflow-y-auto bg-[#0B0F1A]/95 border-r border-white/10 backdrop-blur-md z-30">
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{L === 'fr' ? 'Parcours' : 'Journey'}</div>
          <div className="text-sm font-semibold text-white mb-5">{iso}</div>

          <nav className="space-y-1">
            {steps.map((step, idx) => {
              const isCurrent = step.id === currentStep
              const hasAccess = userRank >= TIER_RANK[step.tier]
              const label = L === 'fr' ? step.labelFr : step.labelEn
              const desc = L === 'fr' ? step.descFr : step.descEn
              const tierInfo = TIER_LABELS[step.tier]
              const tierLabel = tierInfo ? tierInfo[L] : step.tier
              const tierColor = tierInfo?.color ?? '#9CA3AF'
              const prevPhase = idx > 0 ? steps[idx - 1].phase : null
              const showPhaseHeader = step.phase !== prevPhase

              // Circle content: progression "N/total" on the current step, plain
              // number elsewhere.
              const circleText = isCurrent ? `${idx + 1}/${totalSteps}` : String(idx + 1)

              return (
                <div key={step.id}>
                  {showPhaseHeader && (
                    <div className={`${idx === 0 ? 'mt-0' : 'mt-4'} mb-2 px-1 flex items-center gap-2`}>
                      <div className={`h-px flex-1 ${step.phase === 'feel' ? 'bg-sky-400/30' : 'bg-emerald-400/30'}`} />
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${step.phase === 'feel' ? 'text-sky-300' : 'text-emerald-300'}`}>
                        {step.phase === 'feel' ? '👁️ Feel the gap' : '⚒️ Fill the gap'}
                      </span>
                      <div className={`h-px flex-1 ${step.phase === 'feel' ? 'bg-sky-400/30' : 'bg-emerald-400/30'}`} />
                    </div>
                  )}

                  <div
                    className={`group relative flex items-stretch gap-2 rounded-lg transition-all overflow-hidden ${
                      isCurrent ? 'ring-1 ring-amber-500/40' : ''
                    }`}
                  >
                    {/* Background veil — explicitly behind everything else (z-0). */}
                    <div
                      className={`absolute inset-0 -z-0 pointer-events-none rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-amber-500/15'
                          : hasAccess
                          ? 'group-hover:bg-white/5'
                          : 'bg-white/[0.015] group-hover:bg-white/5'
                      }`}
                    />
                    {isCurrent && (
                      <div className="absolute right-0 top-1 bottom-1 w-1 rounded-full bg-[#C9A84C] z-10" />
                    )}

                    {/* Main clickable step cell — always readable, but disabled
                        cursor when the tier is locked. */}
                    <Link
                      href={hasAccess ? step.href(iso) : '#'}
                      onClick={(e) => { if (!hasAccess) e.preventDefault() }}
                      aria-disabled={!hasAccess}
                      className={`relative z-10 flex items-start gap-2 pl-1.5 pr-3 py-2.5 flex-1 min-w-0 ${
                        !hasAccess ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      {/* Smaller circle, shifted left close to the rail. */}
                      <div
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${
                          isCurrent
                            ? 'bg-amber-500 text-gray-950 text-[10px]'
                            : hasAccess
                            ? 'bg-white/10 text-gray-200 text-xs group-hover:bg-white/15'
                            : 'bg-white/5 text-gray-500 text-xs'
                        }`}
                      >
                        {circleText}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span className="text-base shrink-0 leading-tight">{step.icon}</span>
                          <span className={`text-sm font-semibold leading-tight break-words ${isCurrent ? 'text-amber-300' : hasAccess ? 'text-gray-200' : 'text-gray-400'}`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {label}
                            {step.optional && (
                              <span className="ml-2 text-xs text-zinc-400 font-normal">
                                {L === 'fr' ? '(optionnel)' : '(optional)'}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</div>
                      </div>
                    </Link>

                    {/* Access column — sits outside the step card. Fixed
                        width so every cell aligns vertically. "Inclus" when
                        access, tier pill (clickable → upgrade modal) when
                        locked. */}
                    <div className="relative z-10 shrink-0 w-20 flex items-center justify-center pr-2">
                      {hasAccess ? (
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 whitespace-nowrap">
                          ✓ {L === 'fr' ? 'Inclus' : 'Included'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // Only upgrade tiers (data/strategy/premium) have a modal.
                            if (step.tier === 'explorer') return
                            setUpgradeTarget(step.tier as UpgradeTier)
                          }}
                          className="px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all hover:scale-105"
                          style={{
                            color: tierColor,
                            background: tierColor + '15',
                            border: `1px solid ${tierColor}44`,
                          }}
                          aria-label={L === 'fr' ? `Débloquer avec l'offre ${tierLabel}` : `Unlock with ${tierLabel} plan`}
                        >
                          🔒 {tierLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          {/* Global progress bar (keeps a single step-counter at the bottom —
              not duplicated on the current step). */}
          <div className="mt-4 px-1">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
              <span>{L === 'fr' ? 'Progression' : 'Progress'}</span>
              <span className="text-[#C9A84C] font-bold">
                {L === 'fr' ? `Étape ${progressCount}/${requiredTotal}` : `Step ${progressCount}/${requiredTotal}`}
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 mt-2">
              {L === 'fr'
                ? `Accès : ${accessibleCount}/${totalSteps} étapes débloquées`
                : `Access: ${accessibleCount}/${totalSteps} steps unlocked`}
            </div>

            {/* Fill-the-Gap monthly quota counter (Premium 150 / Ultimate 250).
                Hidden on lower tiers and on API/auth errors. */}
            {showFtgCounter && ftgQuota && ftgQuota.grant > 0 && (() => {
              const { balance, grant, periodEnd } = ftgQuota
              const pct = Math.max(0, Math.min(100, (balance / grant) * 100))
              const isEmpty = balance === 0
              const isLow = !isEmpty && balance < grant * 0.1
              const barColor = isEmpty
                ? 'bg-red-500'
                : isLow
                ? 'bg-orange-500'
                : 'bg-emerald-500'
              const dateLocale = L === 'fr' ? 'fr-FR' : 'en-US'
              const resetDate = periodEnd
                ? new Date(periodEnd).toLocaleDateString(dateLocale, {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })
                : null
              return (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span>
                      {L === 'fr' ? 'Fill the Gap · ' : 'Fill the Gap · '}
                      <span className="font-bold text-gray-300">{balance}</span>
                      <span>/{grant}</span>
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {resetDate && (
                    <div className="text-[10px] text-gray-500 mt-1">
                      {isEmpty
                        ? (L === 'fr'
                            ? `Quota atteint. Reset · ${resetDate}`
                            : `Quota reached. Reset · ${resetDate}`)
                        : (L === 'fr'
                            ? `Reset · ${resetDate}`
                            : `Reset · ${resetDate}`)}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          <div className="mt-6 pt-5 border-t border-white/5">
            <Link
              href="/map"
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-amber-400 transition-colors"
            >
              <span>←</span>
              <span>{L === 'fr' ? 'Retour à la carte' : 'Back to map'}</span>
            </Link>
          </div>
        </div>
      </aside>

      <UpgradeOfferModal
        open={upgradeTarget !== null}
        targetTier={upgradeTarget ?? 'data'}
        currentTier={userTier}
        subscriptionEndsAt={subscriptionEndsAt}
        lang={L}
        onClose={() => setUpgradeTarget(null)}
        onSuccess={() => { refreshProfile() }}
      />
    </>
  )
}
