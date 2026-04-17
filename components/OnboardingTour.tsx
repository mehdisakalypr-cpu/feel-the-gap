'use client'

import { useEffect, useState, useRef } from 'react'
import { useLang } from '@/components/LanguageProvider'

const STORAGE_KEY = 'ftg_map_tour_seen_v1'

type Step = 'welcome' | 'hints' | 'done'

interface BubbleRect {
  top: number
  left: number
  width: number
  height: number
}

function useElementRect(selector: string, enabled: boolean): BubbleRect | null {
  const [rect, setRect] = useState<BubbleRect | null>(null)
  useEffect(() => {
    if (!enabled) return
    function update() {
      const el = document.querySelector(selector)
      if (!el) return setRect(null)
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    const el = document.querySelector(selector)
    if (el) ro.observe(el)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const t = setInterval(update, 400)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      clearInterval(t)
    }
  }, [selector, enabled])
  return rect
}

export default function OnboardingTour() {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [step, setStep] = useState<Step>('done')
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    if (typeof window === 'undefined') return
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY)
      if (!seen) setStep('welcome')
    } catch {
      setStep('welcome')
    }
  }, [])

  useEffect(() => {
    if (step === 'done') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        advance()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function persistSeen() {
    try { window.localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  function advance() {
    if (step === 'welcome') setStep('hints')
    else finish()
  }

  function finish() {
    setStep('done')
    persistSeen()
  }

  const searchRect = useElementRect('[data-tour="category-search"]', step === 'hints')

  if (step === 'done') return null

  return (
    <div className="ftg-tour-overlay" onClick={advance}>
      {step === 'welcome' && (
        <div
          className="ftg-tour-bubble ftg-tour-bubble-center"
          role="dialog"
          aria-label={fr ? 'Bienvenue' : 'Welcome'}
          onClick={e => e.stopPropagation()}
        >
          <button className="ftg-tour-close" onClick={finish} aria-label="Close">×</button>
          <p className="ftg-tour-bubble-title">{fr ? '👋 Bienvenue' : '👋 Welcome'}</p>
          <p className="ftg-tour-bubble-text">
            {fr
              ? 'Bienvenue sur le moteur d\'opportunités. Vous pouvez maintenant visualiser et filtrer les marchés de chaque pays.'
              : 'Welcome to the opportunity engine. You can now explore and filter the markets of each country.'}
          </p>
          <p className="ftg-tour-bubble-hint">
            {fr ? 'Appuyez sur Entrée ou cliquez pour continuer' : 'Press Enter or click to continue'}
          </p>
        </div>
      )}

      {step === 'hints' && (
        <>
          {searchRect && (
            <>
              <div
                className="ftg-tour-spotlight"
                style={{
                  top: searchRect.top - 6,
                  left: searchRect.left - 6,
                  width: searchRect.width + 12,
                  height: searchRect.height + 12,
                }}
              />
              <div
                className="ftg-tour-bubble"
                role="dialog"
                aria-label={fr ? 'Recherche précise' : 'Precise search'}
                onClick={e => e.stopPropagation()}
                style={{
                  top: searchRect.top + searchRect.height / 2 - 50,
                  left: searchRect.left + searchRect.width + 20,
                  maxWidth: 280,
                }}
              >
                <span className="ftg-tour-bubble-arrow ftg-tour-bubble-arrow-left" aria-hidden />
                <p className="ftg-tour-bubble-title">{fr ? '🔍 Recherche précise' : '🔍 Precise search'}</p>
                <p className="ftg-tour-bubble-text">
                  {fr
                    ? 'Recherchez précisément une denrée, une ressource, un produit.'
                    : 'Search precisely for a commodity, resource or product.'}
                </p>
              </div>
            </>
          )}

          <div
            className="ftg-tour-bubble"
            role="dialog"
            aria-label={fr ? 'Cliquez sur un pays' : 'Click on a country'}
            onClick={e => e.stopPropagation()}
            style={{
              top: '50%',
              right: 24,
              transform: 'translateY(-50%)',
              maxWidth: 300,
            }}
          >
            <button className="ftg-tour-close" onClick={finish} aria-label="Close">×</button>
            <p className="ftg-tour-bubble-title">{fr ? '🌍 Exploration libre' : '🌍 Free exploration'}</p>
            <p className="ftg-tour-bubble-text">
              {fr
                ? 'Vous pouvez aussi rechercher directement en cliquant sur le pays qui vous intéresse, ou le rechercher par son nom.'
                : 'You can also explore directly by clicking a country on the map, or searching by name.'}
            </p>
            <p className="ftg-tour-bubble-hint">
              {fr ? 'Entrée ou Échap pour fermer' : 'Enter or Esc to close'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
