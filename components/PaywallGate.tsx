'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'

type Tier = 'free' | 'explorer' | 'basic' | 'data' | 'standard' | 'strategy' | 'premium' | 'enterprise'

// Ranks support both legacy tiers (free/basic/standard) and current DB tiers (explorer/data/strategy).
const TIER_RANK: Record<Tier, number> = {
  free: 0,
  explorer: 0,
  basic: 1,
  data: 1,
  standard: 2,
  strategy: 2,
  premium: 3,
  enterprise: 4,
}

const TIER_LABELS: Record<'basic' | 'standard' | 'premium', string> = {
  basic:    'Data',
  standard: 'Strategy',
  premium:  'Premium',
}

const TIER_PRICES: Record<'basic' | 'standard' | 'premium', string> = {
  basic:    '29 €/mois',
  standard: '99 €/mois',
  premium:  '149 €/mois',
}

interface PaywallGateProps {
  requiredTier: 'basic' | 'standard' | 'premium'
  children: React.ReactNode
  featureName: string
}

export default function PaywallGate({ requiredTier, children, featureName }: PaywallGateProps) {
  const [userTier, setUserTier] = useState<Tier | null>(null)
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
        setUserTier((data?.tier as Tier) ?? 'free')
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

  const hasAccess = userTier !== null && TIER_RANK[userTier] >= TIER_RANK[requiredTier]

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
            Fonctionnalité réservée
          </h3>
          <p className="text-gray-400 text-sm mb-2">
            {featureName} requiert le plan{' '}
            <span style={{ color: '#C9A84C' }} className="font-semibold">
              {TIER_LABELS[requiredTier]}
            </span>
          </p>
          <p className="text-gray-500 text-xs mb-6">
            À partir de{' '}
            <span className="text-white font-semibold">{TIER_PRICES[requiredTier]}</span>
          </p>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors"
            style={{ background: '#C9A84C', color: '#07090F' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E8C97A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
          >
            Upgrader mon plan →
          </Link>
        </div>
      </div>
    </div>
  )
}
