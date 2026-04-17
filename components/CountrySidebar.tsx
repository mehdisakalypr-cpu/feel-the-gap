'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PaywallModal } from './PaywallModal'
import type { Feature } from '@/lib/credits/tiers'
import type { PlanTier } from '@/lib/credits/costs'

type MenuItem = {
  id: string
  label: string
  icon: string
  href: string
  feature?: Feature
  minTier?: 'free' | 'starter' | 'premium'
  cost?: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'overview', label: 'Vue pays', icon: '🌍', href: '', minTier: 'free' },
  { id: 'opportunities', label: 'Opportunités', icon: '📊', href: '/opportunities', minTier: 'free' },
  { id: 'demo-bp', label: 'Demo business plan', icon: '👁️', href: '/demo-bp', feature: 'demo_bp', minTier: 'free' },
  { id: 'bp-full', label: 'Business plan complet', icon: '📄', href: '/bp', feature: 'bp_generate', minTier: 'starter', cost: '10 cr' },
  { id: 'training', label: 'Training YouTube', icon: '🎓', href: '/training', feature: 'training_youtube', minTier: 'starter' },
  { id: 'ecommerce', label: 'Créer ton site e-commerce', icon: '🛒', href: '/ecommerce', feature: 'ecommerce_site_propose', minTier: 'starter' },
  { id: 'clients', label: 'Clients potentiels', icon: '👥', href: '/clients', feature: 'client_list', minTier: 'premium', cost: '5 cr/contact' },
  { id: 'site-create', label: 'Lancer ton site', icon: '🚀', href: '/site-create', feature: 'site_creation', minTier: 'premium', cost: '30 cr' },
]

export function CountrySidebar({
  iso,
  userTier,
  userCredits,
}: {
  iso: string
  userTier: PlanTier
  userCredits: { subscription: number; topup: number; total: number }
}) {
  const pathname = usePathname()
  const [paywall, setPaywall] = useState<null | { feature: Feature; requiredTier: 'starter' | 'premium' }>(null)

  function handleClick(item: MenuItem, e: React.MouseEvent) {
    const rank = { free: 0, starter: 1, strategy: 2, premium: 3, custom: 4 }
    const userRank = rank[userTier] ?? 0
    const needRank = rank[item.minTier ?? 'free']
    if (needRank > userRank && item.feature) {
      e.preventDefault()
      setPaywall({ feature: item.feature, requiredTier: item.minTier as 'starter' | 'premium' })
    }
  }

  return (
    <>
      <aside className="w-64 shrink-0 border-r border-white/10 bg-zinc-950 text-white h-full overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <div className="text-xs uppercase tracking-widest text-white/50">Pays</div>
          <div className="text-lg font-semibold">{iso}</div>
        </div>
        <nav className="p-2 space-y-0.5">
          {MENU_ITEMS.map((item) => {
            const rank = { free: 0, starter: 1, strategy: 2, premium: 3, custom: 4 }
            const locked = (rank[item.minTier ?? 'free']) > (rank[userTier] ?? 0)
            const href = `/country/${iso}${item.href}`
            const active = pathname === href
            return (
              <Link
                key={item.id}
                href={href}
                onClick={(e) => handleClick(item, e)}
                className={`flex items-center gap-3 px-3 py-2 rounded transition text-sm ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'hover:bg-white/5 text-white/80'
                } ${locked ? 'opacity-60' : ''}`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {locked && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 uppercase tracking-wider"
                    title={`Requis: ${item.minTier}`}
                  >
                    🔒 {item.minTier}
                  </span>
                )}
                {!locked && item.cost && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300/90">
                    {item.cost}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 mt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/50 uppercase tracking-widest">Solde</span>
            <span className="text-xs text-white/50">{userTier}</span>
          </div>
          <div className="text-xl font-semibold">
            {userCredits.total} <span className="text-sm text-white/50 font-normal">crédits</span>
          </div>
          {userCredits.topup > 0 && (
            <div className="text-xs text-white/50 mt-0.5">
              {userCredits.subscription} abo · {userCredits.topup} pack
            </div>
          )}
          <a
            href="/credits/buy"
            className="mt-3 block text-center text-xs py-2 rounded border border-white/15 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-white/80"
          >
            + Acheter des crédits
          </a>
        </div>
      </aside>

      {paywall && (
        <PaywallModal
          open={true}
          onClose={() => setPaywall(null)}
          variant={{ kind: 'tier_locked', ...paywall }}
        />
      )}
    </>
  )
}
