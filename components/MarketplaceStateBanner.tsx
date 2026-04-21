'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Shown on /finance and /invest landing pages.
// Transparent counter of marketplace state — dossiers complete vs threshold,
// phase (sourcing/live/frozen/scale), waitlist count, founding-pioneer seats.

interface MarketplaceState {
  phase: 'sourcing' | 'live' | 'frozen' | 'scale'
  dossiers_complete_count: number
  dossiers_in_progress_count: number
  waitlist_count: number
  unlock_threshold: number
  freeze_floor: number
  founding_pioneer_limit: number
  founding_pioneer_used: number
  founding_pioneer_discount_pct: number
  force_open: boolean
  last_computed_at: string
}

interface Props {
  role: 'financeur' | 'investisseur'
  accentColor: string
  waitlistHref: string
  catalogHref: string
}

export default function MarketplaceStateBanner({ role, accentColor, waitlistHref, catalogHref }: Props) {
  const [state, setState] = useState<MarketplaceState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/funding/marketplace/state')
      .then((r) => r.json())
      .then((j) => { if (!j.error) setState(j as MarketplaceState) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl p-4 animate-pulse"
        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="h-4 w-2/3 bg-white/5 rounded mb-2" />
        <div className="h-3 w-1/2 bg-white/5 rounded" />
      </div>
    )
  }

  if (!state) return null

  const isOpen = state.force_open || state.phase === 'live' || state.phase === 'scale'
  const complete = state.dossiers_complete_count
  const threshold = state.unlock_threshold
  const progressPct = Math.min(100, Math.round((complete / threshold) * 100))
  const pioneerSeatsLeft = Math.max(0, state.founding_pioneer_limit - state.founding_pioneer_used)

  const roleLabel = role === 'financeur' ? 'financeurs' : 'investisseurs'

  return (
    <div className="rounded-3xl p-5 md:p-6"
      style={{ background: '#0D1117', border: `1px solid ${accentColor}25` }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: isOpen ? '#34D39920' : '#F59E0B20',
                color: isOpen ? '#34D399' : '#F59E0B',
              }}>
              {isOpen ? '🟢 Marketplace ouvert' : '🟡 Phase de sourcing'}
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">
              État en temps réel
            </span>
          </div>
          {isOpen ? (
            <div className="text-white font-semibold text-base mb-1">
              {complete} dossier{complete > 1 ? 's' : ''} complet{complete > 1 ? 's' : ''} dans le catalogue.
            </div>
          ) : (
            <div className="text-white font-semibold text-base mb-1">
              Nous ouvrons le catalogue aux {roleLabel} à {threshold} dossiers complets.
            </div>
          )}
          <div className="text-xs text-gray-400 mb-3">
            {complete} complet{complete > 1 ? 's' : ''} · {state.dossiers_in_progress_count} en construction · {state.waitlist_count} {roleLabel} inscrits sur la liste d'attente
          </div>

          {!isOpen && (
            <div className="w-full h-2 rounded-full overflow-hidden mb-2"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}aa)` }} />
            </div>
          )}
          {!isOpen && (
            <div className="text-[10px] text-gray-500">
              {complete}/{threshold} dossiers ({progressPct}%) avant ouverture
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-2 min-w-[200px]">
          {isOpen ? (
            <Link href={catalogHref}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-center"
              style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
              Voir le catalogue →
            </Link>
          ) : (
            <Link href={waitlistHref}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-center"
              style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
              Rejoindre la liste d'attente
            </Link>
          )}
          {pioneerSeatsLeft > 0 && (
            <div className="rounded-lg p-2 text-center"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <div className="text-[10px] text-[#C9A84C] font-bold mb-0.5">👑 {pioneerSeatsLeft} places Founding Pioneers</div>
              <div className="text-[9px] text-gray-500">-{state.founding_pioneer_discount_pct}% à vie</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
