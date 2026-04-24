'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'
import { TIER_RANK, compareTiers } from '@/lib/credits/tier-helpers'
import type { PlanTier } from '@/lib/credits/costs'
import { useLang } from '@/components/LanguageProvider'

// PaywallGate accepts both legacy aliases (basic/standard) and the current DB
// tier keys. Everything is normalized to PlanTier before comparing through the
// canonical TIER_RANK from tier-helpers.
type LegacyOrPlanTier =
  | PlanTier
  | 'explorer'
  | 'basic'
  | 'data'
  | 'standard'
  | 'enterprise'

function toPlanTier(t: string): PlanTier {
  const map: Record<string, PlanTier> = {
    free: 'free',
    explorer: 'free',
    solo_producer: 'solo_producer',
    basic: 'starter',
    data: 'starter',
    starter: 'starter',
    standard: 'strategy',
    strategy: 'strategy',
    premium: 'premium',
    ultimate: 'ultimate',
    enterprise: 'custom',
    custom: 'custom',
  }
  return map[t] ?? 'free'
}

const TIER_LABELS: Record<LegacyOrPlanTier, string> = {
  free:          'Free',
  explorer:      'Free',
  solo_producer: 'Solo Producer',
  basic:         'Data',
  data:          'Data',
  starter:       'Data',
  standard:      'Strategy',
  strategy:      'Strategy',
  premium:       'Premium',
  ultimate:      'Ultimate',
  enterprise:    'Enterprise',
  custom:        'Enterprise',
}

const TIER_PRICES: Record<LegacyOrPlanTier, string> = {
  free:          '0 €',
  explorer:      '0 €',
  solo_producer: '19,99 €/mois',
  basic:         '29 €/mois',
  data:          '29 €/mois',
  starter:       '29 €/mois',
  standard:      '99 €/mois',
  strategy:      '99 €/mois',
  premium:       '149 €/mois',
  ultimate:      '299 €/mois',
  enterprise:    'Sur devis',
  custom:        'Sur devis',
}

interface PaywallGateProps {
  requiredTier: LegacyOrPlanTier
  children: React.ReactNode
  featureName: string
}

export default function PaywallGate({ requiredTier, children, featureName }: PaywallGateProps) {
  const { t } = useLang()
  const [userTier, setUserTier] = useState<LegacyOrPlanTier | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTier() {
      try {
        const supabase = createSupabaseBrowser()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setUserTier('free')
          setLoading(false)
          return
        }
        const { data } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .single()
        setUserTier((data?.tier as LegacyOrPlanTier) ?? 'free')
      } catch {
        setUserTier('free')
      } finally {
        setLoading(false)
      }
    }
    fetchTier()
  }, [])

  if (loading) {
    return (
      <div className="relative">
        <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
      </div>
    )
  }

  // Normalize both sides to PlanTier and use the canonical comparator so this
  // gate stays in sync with tier-helpers (single source of truth).
  const userPlan = toPlanTier(userTier ?? 'free')
  const requiredPlan = toPlanTier(requiredTier)
  const hasAccess = userTier !== null && compareTiers(userPlan, requiredPlan) >= 0
  // Reference TIER_RANK to keep the canonical map imported as required.
  void TIER_RANK

  if (hasAccess) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Blurred background content */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl"
        style={{ background: 'rgba(7, 9, 15, 0.75)', backdropFilter: 'blur(2px)' }}
      >
        <div className="flex flex-col items-center text-center px-6 py-8 max-w-sm">
          {/* Lock icon */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(201, 168, 76, 0.12)', border: '1.5px solid rgba(201, 168, 76, 0.35)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>

          <h3 className="text-white font-bold text-lg mb-1">
            {t('common.locked_feature')}
          </h3>
          <p className="text-gray-400 text-sm mb-2">
            {t('common.locked_desc', { feature: featureName, plan: TIER_LABELS[requiredTier] })}
          </p>
          <p className="text-gray-500 text-xs mb-6">
            {t('common.from')}{' '}
            <span className="text-white font-semibold">{TIER_PRICES[requiredTier]}</span>
          </p>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors"
            style={{ background: '#C9A84C', color: '#07090F' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E8C97A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
          >
            {t('common.upgrade')}
          </Link>
        </div>
      </div>
    </div>
  )
}
