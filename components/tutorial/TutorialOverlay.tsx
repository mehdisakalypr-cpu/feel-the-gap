'use client'

import { useState, useEffect } from 'react'
import { trackDemoStep } from '@/lib/tracking'

export type TutorialStep = {
  id: string
  title: string
  description: string
  targetId?: string      // DOM element id to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  icon?: string
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Feel The Gap',
    description: 'Discover the world\'s most promising import/export opportunities — scored and ready for action. Let\'s take a quick tour.',
    position: 'center',
    icon: '🌍',
  },
  {
    id: 'map',
    title: 'Interactive World Map',
    description: 'Each icon on the map represents a country with trade opportunities. Icon size reflects opportunity score. Click any country to explore its data.',
    targetId: 'ftg-map',
    position: 'center',
    icon: '🗺️',
  },
  {
    id: 'categories',
    title: 'Filter by Category',
    description: 'Use the category buttons to filter by sector: energy, agriculture, manufacturing, technology, and more. Icons animate to reflect each sector.',
    targetId: 'ftg-category-filter',
    position: 'bottom',
    icon: '🔍',
  },
  {
    id: 'country-panel',
    title: 'Country Detail Panel',
    description: 'Clicking a country opens a detailed panel showing top import gaps, opportunity scores, and key indicators like GDP, population, and tariff rates.',
    targetId: 'ftg-country-panel',
    position: 'left',
    icon: '📊',
  },
  {
    id: 'opportunities',
    title: 'Opportunity Cards',
    description: 'Each opportunity is scored on market size, accessibility, and competition. See exactly what products are imported, their volume, and your potential entry margin.',
    position: 'center',
    icon: '💡',
  },
  {
    id: 'strategies',
    title: '3 Entry Strategies Per Opportunity',
    description: 'Every gap comes with three ready-made strategies:\n🚢 Import & Sell — low capex, fast start\n🏭 Produce Locally — higher margins, long-term\n🤝 Train Locals — services play, recurring revenue',
    position: 'center',
    icon: '🎯',
  },
  {
    id: 'plans',
    title: 'AI Business Plans',
    description: 'Upgrade to unlock AI-generated business plans: market sizing, competitor analysis, pricing strategy, and a step-by-step launch roadmap.',
    position: 'center',
    icon: '🤖',
  },
  {
    id: 'saved',
    title: 'Save Your Searches',
    description: 'Pro subscribers can save filter combinations and country shortlists. Come back any time — your analysis is waiting.',
    position: 'center',
    icon: '🔖',
  },
  {
    id: 'done',
    title: 'You\'re ready to explore!',
    description: 'Start by clicking any country on the map, or use the category filters to narrow down opportunities. The world\'s trade gaps are waiting.',
    position: 'center',
    icon: '🚀',
  },
]

type Props = {
  onComplete?: () => void
  autoStart?: boolean
}

export default function TutorialOverlay({ onComplete, autoStart = false }: Props) {
  const [active, setActive] = useState(autoStart)
  const [step, setStep] = useState(0)
  const [highlight, setHighlight] = useState<DOMRect | null>(null)

  const current = STEPS[step]

  useEffect(() => {
    if (!active || !current?.targetId) {
      setHighlight(null)
      return
    }
    const el = document.getElementById(current.targetId)
    if (el) {
      setHighlight(el.getBoundingClientRect())
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active, step, current?.targetId])

  useEffect(() => {
    if (active && current) {
      trackDemoStep(step + 1, current.id)
    }
  }, [active, step, current])

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      setActive(false)
      setStep(0)
      onComplete?.()
    }
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  function skip() {
    setActive(false)
    setStep(0)
    onComplete?.()
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-transform hover:scale-105"
        style={{ background: '#C9A84C', color: '#000' }}
      >
        🎬 Take the tour
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={skip} />

      {/* Highlight ring around target element */}
      {highlight && (
        <div
          className="fixed z-41 pointer-events-none rounded-xl ring-2 ring-[#C9A84C] ring-offset-4 ring-offset-transparent transition-all duration-300"
          style={{
            top: highlight.top - 8,
            left: highlight.left - 8,
            width: highlight.width + 16,
            height: highlight.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      <div className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none p-4">
        <div
          className="pointer-events-auto w-full max-w-sm bg-[#0D1117] border border-[rgba(201,168,76,.3)] rounded-2xl p-6 shadow-2xl"
          style={{ boxShadow: '0 0 60px rgba(201,168,76,.15)' }}
        >
          {/* Icon + step counter */}
          <div className="flex items-start justify-between mb-4">
            <span className="text-3xl">{current.icon}</span>
            <span className="text-xs text-gray-500">{step + 1} / {STEPS.length}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-[#1F2937] rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <h3 className="text-base font-bold text-white mb-2">{current.title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{current.description}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
            <button onClick={skip} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Skip tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={prev}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors">
                  ← Back
                </button>
              )}
              <button onClick={next}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                style={{ background: '#C9A84C', color: '#000' }}>
                {step === STEPS.length - 1 ? 'Start exploring →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
