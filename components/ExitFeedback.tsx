'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/components/LanguageProvider'
import { EXIT_REASONS, submitExitFeedback } from '@/lib/funnel'

/**
 * Non-intrusive exit feedback widget.
 *
 * Shows only to ENGAGED visitors (not cold traffic). Engagement is set in
 * localStorage by pages/actions that indicate real product interest:
 *   - /pricing page view → `ftg_engaged` = '1'
 *   - Full report view (e.g. /reports/[iso]/business-plan) → `ftg_engaged` = '1'
 *   - User saves/checks an opportunity (toggleFavorite, etc.) → `ftg_engaged` = '1'
 *
 * Triggers (only AFTER engagement):
 *   - Mouse leaves the viewport top (desktop)
 *   - User is idle for 90 seconds
 *
 * NOT a modal — sits at the bottom of the screen, easy to dismiss.
 * Only shows once per session.
 */
export default function ExitFeedback() {
  const [show, setShow] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const { lang } = useLang()
  const fr = lang === 'fr'

  const currentStep = typeof window !== 'undefined' ? window.location.pathname : ''

  const trigger = useCallback(() => {
    if (sessionStorage.getItem('ftg_exit_shown')) return
    // Only show to ENGAGED visitors — cold traffic on /, /map, /demo never sees this.
    if (localStorage.getItem('ftg_engaged') !== '1') return
    sessionStorage.setItem('ftg_exit_shown', '1')
    setShow(true)
  }, [])

  useEffect(() => {
    // Don't show on auth pages or admin
    if (currentStep.includes('/auth') || currentStep.includes('/admin')) return

    // Skip entirely if not engaged yet — no listeners, no timers.
    if (typeof window !== 'undefined' && localStorage.getItem('ftg_engaged') !== '1') return

    // Mouse leave viewport (desktop)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) trigger()
    }
    document.addEventListener('mouseleave', handleMouseLeave)

    // Idle timer — 90 seconds
    const idleTimer = setTimeout(trigger, 90000)

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      clearTimeout(idleTimer)
    }
  }, [trigger, currentStep])

  function handleSelect(reason: string) {
    setSelectedReason(reason)
    submitExitFeedback({
      exitStep: currentStep,
      reason,
    })
    setSubmitted(true)
    setTimeout(() => setShow(false), 2000)
  }

  function handleDismiss() {
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="max-w-lg mx-auto mb-4 mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.3)' }}>

        {submitted ? (
          <div className="p-4 text-center">
            <span className="text-[#34D399] text-lg">Merci !</span>
            <p className="text-gray-400 text-xs mt-1">
              {fr ? 'Votre avis nous aide à nous améliorer.' : 'Your feedback helps us improve.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-white text-sm font-medium">
                {fr ? 'Qu\'est-ce qui vous retient ?' : 'What\'s holding you back?'}
              </p>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-white text-xs p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {EXIT_REASONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => handleSelect(r.key)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    selectedReason === r.key
                      ? 'bg-[#C9A84C] text-black'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {fr ? r.labelFr : r.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-3 border-t border-white/5 pt-2">
              <p className="text-[10px] text-gray-600">
                {fr
                  ? '1 clic suffit. Aucun compte requis.'
                  : 'One click is enough. No account required.'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
