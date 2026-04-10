'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Topbar from '@/components/Topbar'

// Page de résolution "budget insuffisant".
// Query params attendus :
//  - iso       : code pays (cache key du business plan)
//  - opps      : csv des IDs d'opportunités (cache key)
//  - missing   : montant manquant en euros
//  - coverage  : pourcentage couvert par le budget user (0-100)
//
// L'utilisateur voit 3 options combinables :
//  1. Réduire l'ampleur → PATCH /api/reports/business-plan pour appliquer le prorata
//  2. Financement → création d'un dossier type='financement'
//  3. Investissement → création d'un dossier type='investissement'
//
// Clic "Continuer" :
//  - Si option 1 cochée, on applique le scope_reduction_pct = (1 - coverage/100)*100
//  - Pour chaque dossier à créer, on POST /api/funding/dossier → redirige vers le premier dossier créé
//  - Si option 1 seule cochée, on revient vers le business plan (qui se rafraîchit avec le prorata)

function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

type OptionId = 'reduce_scope' | 'financement' | 'investissement'

const OPTIONS: Array<{
  id: OptionId
  title: string
  icon: string
  color: string
  summary: string
  details: string[]
}> = [
  {
    id: 'reduce_scope',
    title: 'Réduire l\'ampleur de l\'opportunité',
    icon: '📉',
    color: '#60A5FA',
    summary: 'Adresser un prorata de l\'opportunité à la hauteur de votre budget.',
    details: [
      'Vous adresserez une part du marché proportionnelle à votre investissement',
      'Revenus, capex et projections sont recalculés automatiquement',
      'Vous pourrez toujours étendre l\'opportunité plus tard',
    ],
  },
  {
    id: 'financement',
    title: 'Obtenir un financement',
    icon: '🏦',
    color: '#34D399',
    summary: 'Combler le manque de trésorerie via une dette adaptée.',
    details: [
      'Financement bancaire classique',
      'Crowdlending et prêts participatifs',
      'Prêts privés et prêts d\'honneur',
      'Subventions et dispositifs publics (BPI, Europe…)',
    ],
  },
  {
    id: 'investissement',
    title: 'Ouvrir votre capital',
    icon: '📈',
    color: '#C9A84C',
    summary: 'Accueillir des investisseurs en minoritaire (jusqu\'à 33 % du capital).',
    details: [
      'Business angels et investisseurs privés',
      'Fonds d\'amorçage et Séries A',
      'Family offices',
      'Valorisation proposée par la plateforme, négociable',
    ],
  },
]

function ScenariosInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const iso = (searchParams.get('iso') ?? '').toUpperCase()
  const oppsParam = searchParams.get('opps') ?? ''
  const missing = Number(searchParams.get('missing') ?? '0')
  const coverage = Number(searchParams.get('coverage') ?? '100')

  const oppIds = useMemo(() => oppsParam.split(',').filter(Boolean), [oppsParam])

  const [selected, setSelected] = useState<Set<OptionId>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: OptionId) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // scope_reduction_pct : le % dont on réduit (100 - coverage). Ex: 40% couvert → on réduit de 60%.
  const scopeReductionPct = Math.max(0, Math.min(100, 100 - coverage))

  async function handleContinue() {
    if (selected.size === 0) return
    setSubmitting(true)
    setError('')
    try {
      // Step 1: scope reduction
      if (selected.has('reduce_scope') && iso && oppIds.length && scopeReductionPct > 0) {
        const res = await fetch(
          `/api/reports/business-plan?iso=${iso}&opps=${encodeURIComponent([...oppIds].sort().join(','))}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope_reduction_pct: scopeReductionPct }),
          },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(`Réduction d'ampleur : ${j.error ?? res.status}`)
        }
      }

      // Step 2: create funding dossier(s)
      const dossierIds: string[] = []
      for (const type of ['financement', 'investissement'] as const) {
        if (!selected.has(type)) continue
        const res = await fetch('/api/funding/dossier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            amount_eur: missing || 100000,
            country_iso: iso || undefined,
          }),
        })
        const j = await res.json()
        if (!res.ok || !j.id) throw new Error(`Création dossier ${type} : ${j.error ?? res.status}`)
        dossierIds.push(j.id)
      }

      // Redirect
      if (dossierIds.length > 0) {
        router.push(`/funding/dossier/${dossierIds[0]}`)
      } else if (iso && oppIds.length) {
        // Only option 1 was selected → back to the business plan which now reflects the reduction
        router.push(`/reports/${iso}/business-plan?opps=${encodeURIComponent(oppIds.join(','))}`)
      } else {
        router.push('/account')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-gray-500 mb-2">
            <Link href={iso ? `/reports/${iso}/business-plan?opps=${encodeURIComponent(oppIds.join(','))}` : '/reports'} className="hover:text-gray-300">
              ← Retour au business plan
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Récapitulatif des solutions à : <span className="text-[#F97316]">budget insuffisant</span>
          </h1>
          <p className="text-sm text-gray-400">
            {missing > 0 ? (
              <>Il vous manque <span className="text-[#F97316] font-semibold">{fmt(missing)}</span> pour adresser 100 % de l'opportunité ({coverage}% couvert par votre budget).</>
            ) : (
              <>Choisissez les solutions qui vous conviennent parmi les 3 options ci-dessous. Elles sont combinables.</>
            )}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          {OPTIONS.map((opt) => {
            const active = selected.has(opt.id)
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className="w-full text-left rounded-2xl p-5 transition-all"
                style={{
                  background: active ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                  border: active ? `1.5px solid ${opt.color}80` : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: active ? `0 8px 24px ${opt.color}20` : 'none',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30` }}
                  >
                    {opt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-base" style={{ color: active ? opt.color : 'white' }}>
                        {opt.title}
                      </h3>
                      {opt.id === 'reduce_scope' && scopeReductionPct > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${opt.color}20`, color: opt.color }}>
                          −{scopeReductionPct}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{opt.summary}</p>
                    <ul className="space-y-1">
                      {opt.details.map((d) => (
                        <li key={d} className="text-xs text-gray-500 flex items-start gap-1.5">
                          <span className="mt-0.5" style={{ color: opt.color }}>•</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: active ? opt.color : 'transparent',
                      border: active ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    {active && <span className="text-[#07090F] text-xs font-bold">✓</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 flex-1">
            {selected.size === 0 ? (
              'Sélectionnez au moins une solution pour continuer'
            ) : (
              <>{selected.size} solution{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</>
            )}
          </div>
          <button
            onClick={handleContinue}
            disabled={selected.size === 0 || submitting}
            className="px-6 py-3 rounded-xl font-bold text-sm disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#07090F',
              opacity: selected.size === 0 || submitting ? 0.4 : 1,
            }}
          >
            {submitting ? 'Traitement…' : 'Continuer →'}
          </button>
        </div>

        {/* Help */}
        <p className="text-[11px] text-gray-600 mt-6 text-center">
          Options 2 et 3 : vous serez amené à remplir un dossier d'analyse pour que les financeurs
          ou investisseurs puissent évaluer votre projet. Les données sont sauvegardées au fil de l'eau.
        </p>
      </div>
    </div>
  )
}

export default function FundingScenariosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F]" />}>
      <ScenariosInner />
    </Suspense>
  )
}
