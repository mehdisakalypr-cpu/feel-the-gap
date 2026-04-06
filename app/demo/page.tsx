'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { trackPageView } from '@/lib/tracking'
import TutorialOverlay from '@/components/tutorial/TutorialOverlay'

// Load the full map in client-only mode
const MapLoader = dynamic(() => import('@/components/MapLoader'), { ssr: false })

// Demo seed data — 3 countries, pre-selected for the walkthrough
const DEMO_COUNTRIES = [
  {
    iso: 'NG',
    name: 'Nigeria',
    top_import_category: 'energy',
    top_opportunity_score: 82,
    gdp_usd: 477e9,
    population: 220e6,
    opportunities: [
      { product: 'Solar panels', import_value_m: 1200, score: 82, tariff: 5 },
      { product: 'Refined petroleum', import_value_m: 8400, score: 78, tariff: 0 },
    ],
  },
  {
    iso: 'BD',
    name: 'Bangladesh',
    top_import_category: 'textiles',
    top_opportunity_score: 75,
    gdp_usd: 460e9,
    population: 170e6,
    opportunities: [
      { product: 'Cotton yarn', import_value_m: 950, score: 75, tariff: 12 },
      { product: 'Industrial machinery', import_value_m: 2100, score: 70, tariff: 8 },
    ],
  },
  {
    iso: 'ET',
    name: 'Ethiopia',
    top_import_category: 'agriculture',
    top_opportunity_score: 68,
    gdp_usd: 126e9,
    population: 120e6,
    opportunities: [
      { product: 'Wheat & cereals', import_value_m: 780, score: 68, tariff: 10 },
      { product: 'Fertilisers', import_value_m: 430, score: 64, tariff: 5 },
    ],
  },
]

const PLAN_META = {
  trade:      { icon: '🚢', color: '#60A5FA', label: 'Import & Sell',   capex: 'Low',    margin: '15–25%', time: '3–6 mo' },
  production: { icon: '🏭', color: '#22C55E', label: 'Produce Locally', capex: 'High',   margin: '35–55%', time: '12–24 mo' },
  training:   { icon: '🤝', color: '#C9A84C', label: 'Train Locals',    capex: 'Medium', margin: '25–40%', time: '6–12 mo' },
} as const

type PlanKey = keyof typeof PLAN_META

export default function DemoPage() {
  const [selectedCountry, setSelectedCountry] = useState(DEMO_COUNTRIES[0])
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('trade')
  const [showPlan, setShowPlan] = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)

  useEffect(() => {
    trackPageView('/demo')
  }, [])

  const plan = PLAN_META[selectedPlan]

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col">
      {/* Demo banner */}
      <div className="bg-[#C9A84C] text-black text-center text-xs font-semibold py-1.5 px-4">
        🎬 Demo mode — exploring real trade data with guided tour
        <a href="/map" className="ml-3 underline hover:no-underline">Go to live platform →</a>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C9A84C] flex items-center justify-center text-xs font-bold text-black">G</div>
          <span className="text-white font-bold">Feel The Gap</span>
          <span className="text-xs text-gray-600 ml-2">Demo</span>
        </div>
        <a href="/pricing"
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{ background: '#C9A84C', color: '#000' }}>
          Get full access →
        </a>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: demo map placeholder */}
        <div id="ftg-map" className="flex-1 relative min-h-[400px] bg-[#0D1117] border-r border-white/5">
          <div className="absolute inset-0 flex flex-col">
            {/* Category filter row */}
            <div id="ftg-category-filter"
              className="flex gap-2 p-3 border-b border-white/5 overflow-x-auto">
              {['All', 'Energy', 'Agriculture', 'Manufacturing', 'Technology', 'Textiles'].map(cat => (
                <button key={cat}
                  className="shrink-0 px-3 py-1 text-xs rounded-full border border-white/10 text-gray-400 hover:text-white hover:border-[#C9A84C] transition-colors">
                  {cat}
                </button>
              ))}
            </div>

            {/* Demo map visual */}
            <div className="flex-1 relative overflow-hidden">
              {/* Gradient world map bg */}
              <div className="absolute inset-0 opacity-20"
                style={{ background: 'radial-gradient(ellipse at 50% 40%, #1F2937 0%, #07090F 70%)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-700 text-sm">Interactive map · full version</p>
              </div>

              {/* Country dots */}
              {DEMO_COUNTRIES.map((c, i) => (
                <button
                  key={c.iso}
                  onClick={() => { setSelectedCountry(c); setShowPlan(false) }}
                  className="absolute rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    width: 40 + c.top_opportunity_score / 5,
                    height: 40 + c.top_opportunity_score / 5,
                    top: `${30 + i * 20}%`,
                    left: `${25 + i * 22}%`,
                    background: selectedCountry.iso === c.iso ? '#C9A84C33' : '#1F293788',
                    borderColor: selectedCountry.iso === c.iso ? '#C9A84C' : '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}>
                  {c.top_import_category === 'energy' ? '⚡' :
                   c.top_import_category === 'textiles' ? '👕' : '🌾'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: country panel */}
        <div id="ftg-country-panel" className="w-80 shrink-0 flex flex-col bg-[#0D1117] overflow-y-auto">
          {/* Country header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedCountry.name}</h2>
                <p className="text-xs text-gray-500">{selectedCountry.iso}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Opportunity score</p>
                <p className="text-2xl font-bold text-[#C9A84C]">{selectedCountry.top_opportunity_score}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span>GDP ${(selectedCountry.gdp_usd / 1e9).toFixed(0)}B</span>
              <span>·</span>
              <span>Pop {(selectedCountry.population / 1e6).toFixed(0)}M</span>
            </div>
          </div>

          {/* Opportunities */}
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Top Opportunities</p>
            {selectedCountry.opportunities.map((opp, i) => (
              <div key={i}
                onClick={() => { setShowPlan(true) }}
                className="bg-[#1F2937] rounded-xl p-3 cursor-pointer hover:bg-[#252D3D] transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm text-white font-medium">{opp.product}</p>
                  <span className="text-xs font-bold text-[#C9A84C]">{opp.score}</span>
                </div>
                <p className="text-xs text-gray-500">
                  Import value ${opp.import_value_m.toLocaleString()}M/yr · Tariff {opp.tariff}%
                </p>

                {/* Strategy selector — shown when expanded */}
                {showPlan && i === 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider">Entry strategy</p>
                    {(Object.keys(PLAN_META) as PlanKey[]).map(pk => (
                      <button key={pk} onClick={e => { e.stopPropagation(); setSelectedPlan(pk) }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-xs transition-colors text-left"
                        style={{
                          background: selectedPlan === pk ? PLAN_META[pk].color + '18' : 'transparent',
                          border: `1px solid ${selectedPlan === pk ? PLAN_META[pk].color + '44' : 'rgba(255,255,255,.05)'}`,
                          color: selectedPlan === pk ? PLAN_META[pk].color : '#9CA3AF',
                        }}>
                        <span>{PLAN_META[pk].icon}</span>
                        <span className="flex-1 font-medium">{PLAN_META[pk].label}</span>
                        {selectedPlan === pk && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected strategy card */}
          {showPlan && (
            <div className="m-4 mt-0 p-4 rounded-xl border"
              style={{ borderColor: plan.color + '44', background: plan.color + '08' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{plan.icon}</span>
                <p className="text-sm font-bold" style={{ color: plan.color }}>{plan.label}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                {[
                  { label: 'Capex', value: plan.capex },
                  { label: 'Margin', value: plan.margin },
                  { label: 'Timeline', value: plan.time },
                ].map(s => (
                  <div key={s.label} className="bg-[#1F2937] rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 mb-1">{s.label}</p>
                    <p className="text-xs font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-dashed border-white/10 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-2">Full AI business plan unlocked with Pro</p>
                <a href="/pricing"
                  className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{ background: plan.color, color: '#000' }}>
                  Unlock full plan →
                </a>
              </div>
            </div>
          )}

          {/* Country switcher */}
          <div className="p-4 border-t border-white/5 mt-auto">
            <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Try another country</p>
            <div className="flex gap-2">
              {DEMO_COUNTRIES.map(c => (
                <button key={c.iso} onClick={() => { setSelectedCountry(c); setShowPlan(false) }}
                  className="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                  style={{
                    borderColor: selectedCountry.iso === c.iso ? '#C9A84C' : 'rgba(255,255,255,.07)',
                    color: selectedCountry.iso === c.iso ? '#C9A84C' : '#6B7280',
                    background: selectedCountry.iso === c.iso ? '#C9A84C11' : 'transparent',
                  }}>
                  {c.iso}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tutorial overlay — auto-starts on demo page */}
      <TutorialOverlay autoStart={!tutorialDone} onComplete={() => setTutorialDone(true)} />
    </div>
  )
}
