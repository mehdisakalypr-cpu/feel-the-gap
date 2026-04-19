'use client'

import { useState } from 'react'
import Link from 'next/link'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import { compareTiers, ctaLabelFor } from '@/lib/credits/tier-helpers'
import type { PlanTier } from '@/lib/credits/costs'

export type RecapSection = {
  id: string
  icon: string
  label: string
  href: string
  weight: number
  requiredTier: PlanTier
  description: string
  accessibleByTier: boolean
  consulted: boolean
}

type Props = {
  iso: string
  tier: PlanTier
  tierLabel: string
  sections: RecapSection[]
  consumedWeight: number
  leftOnTable: number
  archetype: { icon: string; title: string; tagline: string }
}

type SummaryCache = Record<string, { loading: boolean; bullets?: string[]; error?: string }>

export default function RecapClient({
  iso,
  tier,
  tierLabel,
  sections,
  consumedWeight,
  leftOnTable,
  archetype,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [summaries, setSummaries] = useState<SummaryCache>({})

  async function toggleSection(sectionId: string) {
    const next = new Set(expanded)
    if (next.has(sectionId)) {
      next.delete(sectionId)
      setExpanded(next)
      return
    }
    next.add(sectionId)
    setExpanded(next)

    if (summaries[sectionId]?.bullets) return // déjà chargé

    setSummaries((s) => ({ ...s, [sectionId]: { loading: true } }))
    try {
      const res = await fetch(
        `/api/recap/section?iso=${encodeURIComponent(iso)}&section=${encodeURIComponent(sectionId)}`,
        { cache: 'no-store' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'fetch failed')
      const bullets: string[] = Array.isArray(data?.bullets) ? data.bullets : []
      setSummaries((s) => ({ ...s, [sectionId]: { loading: false, bullets } }))
    } catch (e: unknown) {
      setSummaries((s) => ({
        ...s,
        [sectionId]: { loading: false, error: e instanceof Error ? e.message : 'erreur' },
      }))
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <JourneyChipsBar userTier={tier} className="mb-4" />
        <Link href={`/country/${iso}`} className="text-[#C9A84C] text-sm hover:underline mb-4 inline-block">
          ← Fiche pays
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎖️</span>
          <h1 className="text-3xl md:text-4xl font-bold">Synthèse — {iso.toUpperCase()}</h1>
        </div>
        <p className="text-gray-400 text-sm mb-8">
          Votre parcours sur cette opportunité. Plan actuel : <strong>{tierLabel}</strong>.
        </p>

        {/* Archétype */}
        <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-6 mb-10">
          <p className="text-xs uppercase tracking-wider text-[#C9A84C] mb-2">
            Votre archétype sur cette opportunité
          </p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-5xl">{archetype.icon}</span>
            <div>
              <p className="text-3xl font-bold leading-tight">{archetype.title}</p>
              <p className="text-sm text-gray-300">{archetype.tagline}</p>
            </div>
          </div>
          <p className="text-4xl font-bold mb-1">{consumedWeight}%</p>
          <p className="text-xs text-gray-400 mb-4">valeur FTG consommée sur cette opportunité</p>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C56E] transition-all"
              style={{ width: `${consumedWeight}%` }}
            />
          </div>
          {leftOnTable > 0 && (
            <p className="text-xs text-gray-400 mt-4">
              Il vous reste <strong className="text-[#C9A84C]">{leftOnTable}%</strong> de ressources à débloquer.
              {ctaLabelFor(tier, 'ultimate', true) && (
                <>
                  {' '}
                  <Link href="/pricing" className="text-[#C9A84C] underline">
                    Upgrader pour atteindre 100%
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>

        <h2 className="text-xl font-semibold mb-4">Les {sections.length} ressources</h2>
        <div className="space-y-3">
          {sections.map((s) => {
            const isExpanded = expanded.has(s.id)
            const summary = summaries[s.id]
            const status: 'consulted' | 'available' | 'locked' = s.consulted
              ? 'consulted'
              : s.accessibleByTier
                ? 'available'
                : 'locked'
            const badge =
              status === 'consulted'
                ? { bg: 'bg-[#10B981]/15', fg: 'text-[#10B981]', label: '✓ consulté' }
                : status === 'available'
                  ? { bg: 'bg-[#C9A84C]/15', fg: 'text-[#C9A84C]', label: 'disponible' }
                  : { bg: 'bg-white/5', fg: 'text-gray-500', label: `🔒 ${s.requiredTier}+ requis` }

            // CTA logic: si user a accès → "Ouvrir" / "Replier", sinon CTA upgrade vers le tier requis (et seulement si > tier courant)
            const canOpen = s.accessibleByTier
            const upgradeCta = !canOpen && compareTiers(s.requiredTier, tier) > 0
              ? ctaLabelFor(tier, s.requiredTier, true)
              : null

            return (
              <div
                key={s.id}
                className={`rounded-2xl border ${isExpanded ? 'border-[#C9A84C]/40 bg-[#C9A84C]/5' : 'border-white/10 bg-white/5'} transition-colors`}
              >
                <div className="flex items-center gap-4 p-4">
                  <span className="text-3xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <p className="font-semibold">{s.label}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.fg}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-500">poids {s.weight}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                  </div>

                  {canOpen && (
                    <button
                      type="button"
                      onClick={() => toggleSection(s.id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-[#C9A84C] text-black font-semibold whitespace-nowrap hover:bg-[#E8C56E] transition-colors"
                    >
                      {isExpanded ? '▲ Replier' : '▼ Ouvrir'}
                    </button>
                  )}
                  {!canOpen && upgradeCta && (
                    <Link
                      href="/pricing"
                      className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-gray-300 hover:border-[#C9A84C]/50 whitespace-nowrap"
                    >
                      {upgradeCta}
                    </Link>
                  )}
                </div>

                {/* Contenu déplié — top 10 infos résumées (chargées on-demand, cachées) */}
                {isExpanded && canOpen && (
                  <div className="border-t border-white/10 px-5 py-4">
                    {summary?.loading && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                        Génération du résumé…
                      </div>
                    )}
                    {summary?.error && (
                      <div className="text-xs text-red-400">
                        Erreur : {summary.error}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSummaries((m) => ({ ...m, [s.id]: { loading: false } }))
                            toggleSection(s.id) // close
                            toggleSection(s.id) // reopen
                          }}
                          className="ml-2 underline"
                        >
                          Réessayer
                        </button>
                      </div>
                    )}
                    {summary?.bullets && summary.bullets.length > 0 && (
                      <>
                        <p className="text-xs uppercase tracking-wider text-[#C9A84C] mb-2">
                          Top {summary.bullets.length} info{summary.bullets.length > 1 ? 's' : ''} clés
                        </p>
                        <ul className="space-y-1.5">
                          {summary.bullets.map((b, i) => (
                            <li key={i} className="text-sm text-gray-200 flex gap-2">
                              <span className="text-[#C9A84C] shrink-0 font-bold">{i + 1}.</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                        <Link
                          href={s.href}
                          className="mt-4 inline-block text-xs text-gray-400 hover:text-[#C9A84C] underline"
                        >
                          Voir la section complète →
                        </Link>
                      </>
                    )}
                    {summary?.bullets && summary.bullets.length === 0 && (
                      <div className="text-xs text-gray-500">
                        Aucun résumé disponible pour le moment.{' '}
                        <Link href={s.href} className="underline text-[#C9A84C]">
                          Ouvrir la section complète →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-10 p-5 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-sm font-semibold mb-1">Méthode de calcul</p>
          <p className="text-xs text-gray-400">
            Chaque ressource a un poids reflétant sa valeur commerciale : Fiche pays 5%, Rapport 10%, Études 5%, Business plan 20%, Clients potentiels 20%, Vidéos 5%, Site e-commerce 35%. Total 100%. Votre score = somme des poids des ressources effectivement consultées pour ce pays.
          </p>
        </div>
      </div>
    </div>
  )
}
