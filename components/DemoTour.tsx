'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// Guided tour bubbles (DemoTour)
// ─────────────────────────────────────────────────────────────
// Reads published steps from /api/demo/tour?parcours=… and overlays bubbles
// anchored to DOM elements via `target_id` (a CSS selector — usually
// `[data-tour="…"]` on the target component).
//
// Activation signals (any is enough):
//   1. Explicit: `?tour=1` or `?demo=1` query string.
//   2. Demo account email (demo.entrepreneur@… / demo.financeur@…).
//   3. Authenticated user whose active_role has never completed the tour
//      (localStorage `ftg_tour_{role}_completed`).
//
// The tour exposes Previous / Next / Skip / Reopen.
// Completing or skipping writes localStorage so we don't re-open at every nav.

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
  position: 'top' | 'right' | 'bottom' | 'left'
  published: boolean
}

type Parcours = 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'

const DEMO_EMAILS: Record<string, Parcours> = {
  'demo.entrepreneur@feelthegap.app': 'entrepreneur',
  'demo.financeur@feelthegap.app':    'financeur',
  'demo.investisseur@feelthegap.app': 'investisseur',
  'demo.influenceur@feelthegap.app':  'influenceur',
}

const ACCENT: Record<Parcours, string> = {
  entrepreneur: '#C9A84C',
  financeur:    '#34D399',
  investisseur: '#60A5FA',
  influenceur:  '#A78BFA',
}

function matchUrl(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true
  if (pattern.endsWith('/*')) return pathname.startsWith(pattern.slice(0, -2))
  return false
}

export default function DemoTour() {
  // Suspense boundary required because DemoTourInner uses useSearchParams(),
  // which would otherwise force the entire app into CSR on static-prerendered
  // pages like /_not-found (Next.js 16 prerender error).
  return (
    <Suspense fallback={null}>
      <DemoTourInner />
    </Suspense>
  )
}

function DemoTourInner() {
  const pathname = usePathname()
  const router = useRouter()
  const search = useSearchParams()
  const explicit = search.get('tour') === '1' || search.get('demo') === '1'

  const [parcours, setParcours] = useState<Parcours | null>(null)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [lang, setLang] = useState<'fr' | 'en'>('fr')

  // Determine which parcours tour to show.
  useEffect(() => {
    let cancelled = false

    async function resolve() {
      const sb = createSupabaseBrowser()
      const { data } = await sb.auth.getUser()
      if (cancelled) return

      let resolvedParcours: Parcours | null = null

      // Priority 1: demo account email
      const email = data.user?.email?.toLowerCase()
      if (email && DEMO_EMAILS[email]) resolvedParcours = DEMO_EMAILS[email]

      // Priority 2: explicit query
      if (!resolvedParcours && explicit) {
        // Infer from pathname
        if (pathname.startsWith('/finance')) resolvedParcours = 'financeur'
        else if (pathname.startsWith('/invest')) resolvedParcours = 'investisseur'
        else if (pathname.startsWith('/influencer')) resolvedParcours = 'influenceur'
        else resolvedParcours = 'entrepreneur'
      }

      // Priority 3: authenticated user's active_role, if not already completed
      if (!resolvedParcours && data.user) {
        const { data: profile } = await sb
          .from('profiles').select('active_role').eq('id', data.user.id).maybeSingle()
        const role = (profile?.active_role as Parcours | null) ?? 'entrepreneur'
        const done = typeof window !== 'undefined' && localStorage.getItem(`ftg_tour_${role}_completed`) === '1'
        if (!done) resolvedParcours = role
      }

      if (!cancelled) setParcours(resolvedParcours)

      // Also pick up the ambient language
      if (!cancelled && typeof document !== 'undefined') {
        const htmlLang = document.documentElement.lang
        if (htmlLang?.startsWith('en')) setLang('en')
        else setLang('fr')
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [explicit, pathname])

  // Fetch steps once parcours is known.
  useEffect(() => {
    if (!parcours) { setSteps([]); return }
    fetch(`/api/demo/tour?parcours=${parcours}`)
      .then((r) => r.json())
      .then((j) => { if (!j.error) setSteps((j.steps ?? []) as TourStep[]) })
      .catch(() => {})
  }, [parcours])

  // Pick the current step matching the current URL.
  const currentStep = useMemo(() => {
    if (!steps.length) return null
    const candidates = steps.filter((s) => matchUrl(s.target_url, pathname))
    if (!candidates.length) return null
    // currentIndex is an offset within the candidates list.
    return candidates[Math.min(currentIndex, candidates.length - 1)] ?? candidates[0]
  }, [steps, pathname, currentIndex])

  const stepsForPage = useMemo(
    () => steps.filter((s) => matchUrl(s.target_url, pathname)),
    [steps, pathname],
  )

  // Re-show when entering a new page that has steps.
  useEffect(() => {
    if (!stepsForPage.length) { setVisible(false); return }
    setCurrentIndex(0)
    setVisible(true)
  }, [stepsForPage])

  // Recompute anchor rect.
  const recompute = () => {
    if (!currentStep) { setAnchorRect(null); return }
    if (!currentStep.target_id) { setAnchorRect(null); return }
    const el = document.querySelector(currentStep.target_id) as HTMLElement | null
    if (el) {
      setAnchorRect(el.getBoundingClientRect())
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      setAnchorRect(null)
    }
  }
  useLayoutEffect(() => { recompute() }, [currentStep])
  useEffect(() => {
    const onResize = () => recompute()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // Handlers
  function complete() {
    if (parcours) localStorage.setItem(`ftg_tour_${parcours}_completed`, '1')
    setVisible(false)
  }
  function next() {
    // Move to the next step across ALL pages (not just currentPage).
    if (!steps.length || !parcours) return
    const flatIndex = steps.findIndex((s) => s.id === currentStep?.id)
    const nextStep = steps[flatIndex + 1]
    if (!nextStep) { complete(); return }
    if (nextStep.target_url === currentStep?.target_url || matchUrl(nextStep.target_url, pathname)) {
      setCurrentIndex((i) => i + 1)
    } else {
      // Navigate to next step's page; the useEffect on stepsForPage will reset index.
      const url = nextStep.target_url.endsWith('/*') ? nextStep.target_url.slice(0, -2) : nextStep.target_url
      router.push(url)
    }
  }
  function prev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  if (!visible || !currentStep) return null

  const accent = parcours ? ACCENT[parcours] : '#C9A84C'
  const title = lang === 'en' && currentStep.title_en ? currentStep.title_en : currentStep.title_fr
  const body  = lang === 'en' && currentStep.body_en  ? currentStep.body_en  : currentStep.body_fr

  // Resolve bubble position.
  let bubbleStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    maxWidth: 360,
  }
  if (anchorRect) {
    const BUBBLE_GAP = 12
    const W = 340, H = 160
    switch (currentStep.position) {
      case 'top':
        bubbleStyle.top = anchorRect.top - H - BUBBLE_GAP
        bubbleStyle.left = anchorRect.left + anchorRect.width / 2 - W / 2
        break
      case 'bottom':
        bubbleStyle.top = anchorRect.bottom + BUBBLE_GAP
        bubbleStyle.left = anchorRect.left + anchorRect.width / 2 - W / 2
        break
      case 'left':
        bubbleStyle.top = anchorRect.top + anchorRect.height / 2 - H / 2
        bubbleStyle.left = anchorRect.left - W - BUBBLE_GAP
        break
      case 'right':
        bubbleStyle.top = anchorRect.top + anchorRect.height / 2 - H / 2
        bubbleStyle.left = anchorRect.right + BUBBLE_GAP
        break
    }
    // Clamp to viewport.
    bubbleStyle.left = Math.max(12, Math.min(Number(bubbleStyle.left), window.innerWidth - W - 12))
    bubbleStyle.top  = Math.max(12, Math.min(Number(bubbleStyle.top),  window.innerHeight - H - 12))
  } else {
    // Fallback: centered modal at bottom of screen.
    bubbleStyle.bottom = 24
    bubbleStyle.left = '50%'
    bubbleStyle.transform = 'translateX(-50%)'
  }

  const totalSteps = steps.length
  const globalIndex = steps.findIndex((s) => s.id === currentStep.id) + 1

  return (
    <>
      {/* Highlight ring around the anchor */}
      {anchorRect && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: anchorRect.top - 6,
            left: anchorRect.left - 6,
            width: anchorRect.width + 12,
            height: anchorRect.height + 12,
            borderRadius: 12,
            boxShadow: `0 0 0 3px ${accent}, 0 0 0 9999px rgba(0,0,0,0.55)`,
            pointerEvents: 'none',
            zIndex: 9998,
            transition: 'all 0.2s ease',
          }}
        />
      )}

      {/* Bubble */}
      <div
        role="dialog"
        aria-labelledby="demo-tour-title"
        style={{
          ...bubbleStyle,
          width: 340,
          background: '#0D1117',
          border: `1px solid ${accent}60`,
          borderRadius: 18,
          padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {lang === 'en' ? `Step ${globalIndex} / ${totalSteps}` : `Étape ${globalIndex} / ${totalSteps}`}
          </span>
          <button
            onClick={complete}
            aria-label="Close tour"
            style={{ background: 'transparent', border: 0, color: '#6B7280', cursor: 'pointer', fontSize: 14 }}>
            ✕
          </button>
        </div>
        <h3 id="demo-tour-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
        <p style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.55, marginBottom: 14 }}>{body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={prev}
            disabled={globalIndex <= 1}
            style={{
              flex: '0 0 auto',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: globalIndex <= 1 ? '#4B5563' : '#E5E7EB',
              fontSize: 12,
              fontWeight: 600,
              cursor: globalIndex <= 1 ? 'default' : 'pointer',
            }}>
            ← {lang === 'en' ? 'Previous' : 'Précédent'}
          </button>
          <button
            onClick={complete}
            style={{
              flex: '0 0 auto',
              padding: '8px 10px',
              background: 'transparent',
              border: 0,
              color: '#6B7280',
              fontSize: 11,
              cursor: 'pointer',
            }}>
            {lang === 'en' ? 'Skip tour' : 'Passer'}
          </button>
          <button
            onClick={next}
            style={{
              flex: '1 1 auto',
              padding: '10px 12px',
              borderRadius: 10,
              background: accent,
              color: '#07090F',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: 0,
            }}>
            {globalIndex >= totalSteps
              ? (lang === 'en' ? 'Done ✓' : 'Terminer ✓')
              : (lang === 'en' ? 'Next →' : 'Suivant →')}
          </button>
        </div>
      </div>
    </>
  )
}
