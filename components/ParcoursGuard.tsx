'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ParcoursRole } from '@/lib/funding/parcours'

interface Props {
  role: ParcoursRole
  children: React.ReactNode
  /** Accent color for the "coming soon" fallback. */
  accentColor?: string
}

// Client gate wrapping a parcours page (e.g. /finance, /invest, /influencer).
// If parcours_state[role].enabled === false, renders a "coming soon" fallback
// with the unlock threshold + current counter for transparency. Otherwise
// renders children.

export default function ParcoursGuard({ role, children, accentColor = '#C9A84C' }: Props) {
  const [state, setState] = useState<{ enabled: boolean; auto_enable_threshold: number | null } | null>(null)
  const [complete, setComplete] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/parcours-state').then(r => r.json()),
      fetch('/api/funding/marketplace/state').then(r => r.json()).catch(() => null),
    ]).then(([p, mp]) => {
      const row = p?.parcours?.[role]
      if (row) setState(row)
      if (mp?.dossiers_complete_count != null) setComplete(mp.dossiers_complete_count)
    }).finally(() => setLoading(false))
  }, [role])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="text-sm text-gray-500">Chargement…</div>
      </div>
    )
  }

  if (state && state.enabled === false) {
    const threshold = state.auto_enable_threshold
    const pct = threshold && complete != null
      ? Math.min(100, Math.round((complete / threshold) * 100))
      : null
    return (
      <div className="min-h-screen bg-[#07090F] text-white">
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="text-4xl mb-4">🚧</div>
          <h1 className="text-3xl font-bold mb-3">Parcours en préparation</h1>
          <p className="text-gray-400 mb-6">
            Ce parcours sera ouvert une fois que la plateforme aura une masse critique de dossiers
            à proposer. Inscrivez-vous à la liste d'attente pour être prévenu dès l'ouverture.
          </p>
          {threshold && complete != null && (
            <div className="mb-6">
              <div className="text-xs text-gray-500 mb-2">
                {complete}/{threshold} dossiers complets ({pct}%)
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: accentColor }} />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
              Retour à l'accueil
            </Link>
            <Link href={`/${role === 'financeur' ? 'finance' : role === 'investisseur' ? 'invest' : 'influencer'}/waitlist`}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: accentColor, color: '#07090F' }}>
              Rejoindre la liste d'attente →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
