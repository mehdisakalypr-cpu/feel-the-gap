'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PARCOURS_META: Record<string, { label: string; icon: string; color: string; email: string }> = {
  entrepreneur:  { label: 'Entrepreneur',  icon: '🧭', color: '#C9A84C', email: 'demo.entrepreneur@feelthegap.app' },
  influenceur:   { label: 'Influenceur',   icon: '🎤', color: '#A78BFA', email: 'demo.influenceur@feelthegap.app' },
  financeur:     { label: 'Financeur',     icon: '🏦', color: '#34D399', email: 'demo.financeur@feelthegap.app' },
  investisseur:  { label: 'Investisseur',  icon: '📈', color: '#60A5FA', email: 'demo.investisseur@feelthegap.app' },
}

type TourStep = {
  id: string
  parcours: string
  step_order: number
  title_fr: string
  title_en: string
  body_fr: string
  body_en: string
  target_url: string
  target_id: string | null
  position: string
}

function TourContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parcours = searchParams.get('parcours') ?? ''
  const meta = PARCOURS_META[parcours]

  const [steps, setSteps] = useState<TourStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [highlightEl, setHighlightEl] = useState<HTMLElement | null>(null)

  // Clean up highlight ring on unmount or step change
  const clearHighlight = useCallback(() => {
    if (highlightEl) {
      highlightEl.style.outline = ''
      highlightEl.style.outlineOffset = ''
      highlightEl.style.transition = ''
      highlightEl.classList.remove('ftg-tour-highlight')
      setHighlightEl(null)
    }
  }, [highlightEl])

  // Highlight the target element for current step
  const highlightTarget = useCallback((targetId: string | null) => {
    clearHighlight()
    if (!targetId) return

    setTimeout(() => {
      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = `3px solid ${meta?.color ?? '#C9A84C'}`
        el.style.outlineOffset = '4px'
        el.style.transition = 'outline 0.3s ease'
        setHighlightEl(el)
      }
    }, 500)
  }, [clearHighlight, meta?.color])

  // Load tour steps
  useEffect(() => {
    if (!parcours || !meta) {
      setError('Parcours invalide.')
      setLoading(false)
      return
    }

    fetch(`/api/demo/tour?parcours=${encodeURIComponent(parcours)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.steps && j.steps.length > 0) {
          setSteps(j.steps)
          // Now impersonate
          impersonateDemo()
        } else {
          setError('Aucune étape configurée pour ce parcours.')
          setLoading(false)
        }
      })
      .catch(() => {
        setError('Impossible de charger le parcours.')
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcours])

  async function impersonateDemo() {
    if (!meta) return
    setImpersonating(true)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: meta.email }),
      })
      const j = await res.json()
      if (!res.ok) {
        // If impersonation fails (not admin), proceed anyway — the tour overlay
        // can still show steps, the user just won't be logged in
        console.warn('[tour] impersonation failed:', j.error)
      }
    } catch {
      console.warn('[tour] impersonation request failed')
    } finally {
      setImpersonating(false)
      setLoading(false)
    }
  }

  // Navigate to the step's target URL when step changes
  useEffect(() => {
    if (steps.length === 0 || loading || impersonating) return
    const step = steps[currentStep]
    if (!step) return

    // Navigate to the target URL
    if (step.target_url && window.location.pathname !== step.target_url) {
      router.push(step.target_url)
    }

    // Highlight target element after navigation settles
    highlightTarget(step.target_id)

    return () => clearHighlight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, steps, loading, impersonating])

  function goNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      setCompleted(true)
      clearHighlight()
    }
  }

  function goBack() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  function quitTour() {
    clearHighlight()
    router.push('/demo')
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Parcours inconnu.</p>
          <button onClick={() => router.push('/demo')} className="text-sm text-[#C9A84C] hover:underline">
            Retour aux parcours
          </button>
        </div>
      </div>
    )
  }

  if (loading || impersonating) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="text-center">
          <div
            className="w-12 h-12 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: `${meta.color} transparent transparent transparent` }}
          />
          <p className="text-gray-400 text-sm">
            {impersonating ? 'Connexion au compte démo...' : 'Chargement du parcours...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => router.push('/demo')} className="text-sm text-[#C9A84C] hover:underline">
            Retour aux parcours
          </button>
        </div>
      </div>
    )
  }

  // ── Completed state ──────────────────────────────────────────
  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,9,15,0.92)' }}>
        <div className="text-center max-w-md mx-auto px-6">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Bravo ! Parcours complété
          </h2>
          <p className="text-gray-400 mb-2">
            Vous avez terminé le parcours{' '}
            <span style={{ color: meta.color }}>{meta.label}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            {steps.length} étapes parcourues avec succès.
          </p>

          {/* Decorative dots */}
          <div className="flex justify-center gap-1.5 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: meta.color }}
              />
            ))}
          </div>

          <button
            onClick={() => router.push('/demo')}
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: meta.color, color: '#07090F' }}
          >
            Retour aux parcours
          </button>
        </div>
      </div>
    )
  }

  // ── Tour overlay ─────────────────────────────────────────────
  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ perspective: '1000px' }}
    >
      <div
        className="pointer-events-auto mx-auto max-w-2xl mb-4 mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(13,17,23,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${meta.color}30`,
        }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%`, background: meta.color }}
          />
        </div>

        <div className="p-5">
          {/* Step header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{meta.icon}</span>
                <h3 className="font-bold text-white text-base">{step.title_fr}</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{step.body_fr}</p>
            </div>
          </div>

          {/* Footer: progress info + navigation */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="text-xs text-gray-500">
              Étape {currentStep + 1}/{steps.length} — Parcours {meta.label}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={quitTour}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                Quitter
              </button>

              {currentStep > 0 && (
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Précédent
                </button>
              )}

              <button
                onClick={goNext}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: meta.color, color: '#07090F' }}
              >
                {currentStep < steps.length - 1 ? 'Suivant' : 'Terminer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TourPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TourContent />
    </Suspense>
  )
}
