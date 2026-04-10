'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Menu flottant droit qui apparaît quand le budget saisi par l'utilisateur
// est insuffisant pour couvrir l'investissement minimum cumulé des stratégies
// retenues dans son business plan.
//
// Props :
//  - userBudgetEur : budget saisi (null/undefined = pas encore saisi → on n'affiche rien)
//  - requiredMinEur : somme des investment_min_eur des stratégies cochées
//  - iso : code pays, pour passer à la page /funding/scenarios
//  - oppIds : IDs d'opportunités (cache key du business plan)
//
// Quand le budget est insuffisant, on ouvre un panneau droit "Budget insuffisant,
// pas de panique…" avec un bouton "Voir nos solutions" qui emmène vers
// /funding/scenarios?iso=...&opps=...&missing=... .

export interface BudgetShortfallNoticeProps {
  userBudgetEur: number | null | undefined
  requiredMinEur: number
  requiredMaxEur?: number
  iso: string
  oppIds: string[]
}

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

export default function BudgetShortfallNotice({
  userBudgetEur,
  requiredMinEur,
  requiredMaxEur,
  iso,
  oppIds,
}: BudgetShortfallNoticeProps) {
  const [dismissed, setDismissed] = useState(false)

  // Reset dismiss state when the shortfall context changes (new budget, new plan).
  useEffect(() => {
    setDismissed(false)
  }, [userBudgetEur, requiredMinEur])

  const shortfall = useMemo(() => {
    if (userBudgetEur == null || userBudgetEur <= 0) return null
    if (requiredMinEur <= 0) return null
    if (userBudgetEur >= requiredMinEur) return null
    return requiredMinEur - userBudgetEur
  }, [userBudgetEur, requiredMinEur])

  if (!shortfall || dismissed) return null

  const coveragePct = Math.max(0, Math.min(100, Math.round((userBudgetEur! / requiredMinEur) * 100)))
  const oppsParam = [...oppIds].sort().join(',')
  const href = `/funding/scenarios?iso=${iso}&opps=${encodeURIComponent(oppsParam)}&missing=${shortfall}&coverage=${coveragePct}`

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed top-24 right-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl p-5 shadow-2xl"
      style={{
        background: 'linear-gradient(180deg, #1A1210 0%, #0D1117 100%)',
        border: '1px solid rgba(249, 115, 22, 0.35)',
        boxShadow: '0 16px 40px rgba(249, 115, 22, 0.2), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.35)' }}
        >
          💸
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm mb-0.5">Budget insuffisant</div>
          <div className="text-[11px] text-gray-400">Pour couvrir 100 % de l'opportunité</div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fermer"
          className="text-gray-500 hover:text-gray-300 text-sm leading-none -mr-1 -mt-1"
        >
          ✕
        </button>
      </div>

      {/* Coverage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>Votre budget : <span className="text-white font-semibold">{fmt(userBudgetEur!)}</span></span>
          <span>{coveragePct}% couvert</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${coveragePct}%`,
              background: 'linear-gradient(90deg, #F97316, #FACC15)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5">
          <span>Requis min : <span className="text-[#F97316] font-semibold">{fmt(requiredMinEur)}</span></span>
          {requiredMaxEur && requiredMaxEur > requiredMinEur ? (
            <span>Max : {fmt(requiredMaxEur)}</span>
          ) : null}
        </div>
      </div>

      <p className="text-[12px] text-gray-300 leading-relaxed mb-4">
        <span className="text-white font-semibold">Pas de panique.</span> Il vous manque{' '}
        <span className="text-[#F97316] font-bold">{fmt(shortfall)}</span>. Nous avons plusieurs
        solutions pour combler ce manque ou adapter l'opportunité à votre budget.
      </p>

      <Link
        href={href}
        className="block w-full py-2.5 rounded-xl font-bold text-sm text-center transition-all"
        style={{
          background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
          color: '#07090F',
        }}
      >
        Voir nos solutions →
      </Link>
    </div>
  )
}
