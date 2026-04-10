'use client'

import Link from 'next/link'
import { useLang } from '@/components/LanguageProvider'

export type JourneyStep = 'country' | 'report' | 'studies' | 'business_plan' | 'success'

interface Step {
  id: JourneyStep
  tier: 'explorer' | 'data' | 'strategy'
  labelFr: string
  labelEn: string
  descFr: string
  descEn: string
  icon: string
  href: (iso: string) => string
  optional?: boolean
}

const ALL_STEPS: Step[] = [
  {
    id: 'country',
    tier: 'explorer',
    labelFr: 'Fiche pays',
    labelEn: 'Country sheet',
    descFr: 'Vue d\'ensemble du marché',
    descEn: 'Market overview',
    icon: '🌍',
    href: (iso) => `/country/${iso}`,
  },
  {
    id: 'report',
    tier: 'data',
    labelFr: 'Rapport d\'opportunités',
    labelEn: 'Opportunities report',
    descFr: 'Analyse détaillée',
    descEn: 'Detailed analysis',
    icon: '📊',
    href: (iso) => `/reports/${iso}`,
  },
  {
    id: 'studies',
    tier: 'strategy',
    labelFr: 'Études approfondies',
    labelEn: 'In-depth studies',
    descFr: 'Recherche avancée',
    descEn: 'Advanced research',
    icon: '📑',
    href: (iso) => `/country/${iso}?tab=studies`,
    optional: true,
  },
  {
    id: 'business_plan',
    tier: 'strategy',
    labelFr: 'Business plan',
    labelEn: 'Business plan',
    descFr: '3 scénarios chiffrés',
    descEn: '3 costed scenarios',
    icon: '💼',
    href: (iso) => `/country/${iso}/enriched-plan`,
  },
  {
    id: 'success',
    tier: 'strategy',
    labelFr: 'En route vers le succès',
    labelEn: 'On the way to success',
    descFr: 'IA + formation',
    descEn: 'AI + training',
    icon: '🚀',
    href: (iso) => `/country/${iso}/success`,
  },
]

// Ranks support both legacy and current DB tiers.
const TIER_RANK: Record<string, number> = {
  free: 0,
  explorer: 0,
  basic: 1,
  data: 1,
  standard: 2,
  strategy: 2,
  premium: 3,
  enterprise: 4,
}

const TIER_LABELS: Record<string, { fr: string; en: string }> = {
  explorer: { fr: 'Explorer', en: 'Explorer' },
  data: { fr: 'Data', en: 'Data' },
  strategy: { fr: 'Strategy', en: 'Strategy' },
}

interface JourneySidebarProps {
  iso: string
  currentStep: JourneyStep
  userTier?: string
  hasStudies?: boolean
}

export default function JourneySidebar({ iso, currentStep, userTier = 'free', hasStudies = false }: JourneySidebarProps) {
  const { lang } = useLang()
  const L: 'fr' | 'en' = lang === 'en' ? 'en' : 'fr'
  const userRank = TIER_RANK[userTier] ?? 0

  // Filter out studies step if no studies available
  const steps = ALL_STEPS.filter(s => s.id !== 'studies' || hasStudies)
  const totalSteps = steps.length
  const currentIdx = steps.findIndex(s => s.id === currentStep)

  return (
    <aside className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] overflow-y-auto bg-[#0B0F1A]/95 border-r border-white/10 backdrop-blur-md z-30">
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{L === 'fr' ? 'Parcours' : 'Journey'}</div>
        <div className="text-sm font-semibold text-white mb-5">{iso}</div>

        <nav className="space-y-1">
          {steps.map((step, idx) => {
            const isCurrent = step.id === currentStep
            const hasAccess = userRank >= TIER_RANK[step.tier]
            const label = L === 'fr' ? step.labelFr : step.labelEn
            const desc = L === 'fr' ? step.descFr : step.descEn
            const tierLabel = TIER_LABELS[step.tier]?.[L] ?? step.tier

            return (
              <Link
                key={step.id}
                href={step.href(iso)}
                className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-amber-500/15 border border-amber-500/40'
                    : 'border border-transparent hover:bg-white/5 hover:border-white/10'
                } ${!hasAccess ? 'opacity-50' : ''}`}
              >
                {/* Yellow vertical bar on right side for current step */}
                {isCurrent && (
                  <div className="absolute right-0 top-1 bottom-1 w-1 rounded-full bg-[#C9A84C]" />
                )}

                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent
                    ? 'bg-amber-500 text-gray-950'
                    : 'bg-white/5 text-gray-400 group-hover:bg-white/10'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{step.icon}</span>
                    <span className={`text-sm font-semibold truncate ${isCurrent ? 'text-amber-300' : 'text-gray-200'}`}>
                      {label}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <span>{desc}</span>
                    {!hasAccess && (
                      <span className="px-1.5 py-0.5 bg-white/5 text-gray-400 rounded text-[9px] font-bold">
                        🔒 {tierLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step counter on the right */}
                {isCurrent && (
                  <div className="shrink-0 self-center mr-2">
                    <span className="text-[10px] font-bold text-[#C9A84C]">
                      {idx + 1}/{totalSteps}
                    </span>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Step progress bar */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
            <span>{L === 'fr' ? 'Progression' : 'Progress'}</span>
            <span className="text-[#C9A84C] font-bold">
              {L === 'fr' ? `Étape ${currentIdx + 1}/${totalSteps}` : `Step ${currentIdx + 1}/${totalSteps}`}
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C9A84C] rounded-full transition-all duration-500"
              style={{ width: `${((currentIdx + 1) / totalSteps) * 100}%` }}
            />
          </div>
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
  )
}
