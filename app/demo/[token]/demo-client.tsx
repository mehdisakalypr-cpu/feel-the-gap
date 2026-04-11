'use client'

import { useState } from 'react'
import Link from 'next/link'

type Scenario = {
  name: string
  investment: string
  monthly_revenue: string
  roi_months: number
  description: string
}

type Opportunity = {
  title: string
  country: string
  potential: string
  sector: string
}

type Investor = {
  name: string
  type: string
  ticket_range: string
  sectors: string[]
}

type Demo = {
  id: string
  token: string
  full_name: string
  company_name: string | null
  country_iso: string | null
  city: string | null
  sector: string | null
  product_focus: string[] | null
  hero_message: string | null
  business_plan: {
    scenarios?: Scenario[]
    executive_summary?: string
    market_size?: string
    competitive_advantage?: string
  } | null
  opportunities: Opportunity[]
  investors: Investor[]
  market_data: {
    population?: string
    gdp_growth?: string
    trade_volume?: string
    key_imports?: string[]
    key_exports?: string[]
  } | null
}

export default function DemoClient({ demo }: { demo: Demo }) {
  const [activeTab, setActiveTab] = useState<'plan' | 'opportunities' | 'investors' | 'market'>('plan')
  const [showCTA, setShowCTA] = useState(false)

  const scenarios = demo.business_plan?.scenarios || []
  const opportunities = demo.opportunities || []
  const investors = demo.investors || []

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/20 via-transparent to-[#07090F]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
          <p className="text-[#C9A84C] text-sm font-medium tracking-wider uppercase mb-4">
            Feel The Gap — Demo personnalisee
          </p>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {demo.hero_message || `${demo.full_name}, votre marche vous attend`}
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl">
            {demo.business_plan?.executive_summary ||
              `Nous avons analyse les opportunites dans le secteur ${demo.sector || 'commerce'} pour ${demo.company_name || 'votre entreprise'}.`}
          </p>
          {demo.company_name && (
            <div className="mt-6 flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-sm">{demo.sector}</span>
              {demo.country_iso && <span className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-sm">{demo.country_iso}</span>}
              {demo.city && <span className="px-3 py-1 rounded-full bg-white/10 text-gray-300 text-sm">{demo.city}</span>}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-0 z-20 bg-[#07090F]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 flex gap-1">
          {([
            ['plan', 'Business Plan'],
            ['opportunities', `Opportunites (${opportunities.length})`],
            ['investors', `Investisseurs (${investors.length})`],
            ['market', 'Donnees Marche'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-[#C9A84C] text-[#C9A84C]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {activeTab === 'plan' && (
          <div className="space-y-8">
            {/* 3 Scenarios */}
            {scenarios.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">3 Scenarios de lancement</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {scenarios.map((s, i) => (
                    <div
                      key={i}
                      className={`p-6 rounded-xl border ${
                        i === 1
                          ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <h3 className="font-bold text-lg mb-2">{s.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{s.description}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Investissement</span>
                          <span className="font-medium">{s.investment}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Revenu mensuel</span>
                          <span className="font-medium text-green-400">{s.monthly_revenue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ROI</span>
                          <span className="font-medium">{s.roi_months} mois</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Market size & competitive advantage */}
            {demo.business_plan?.market_size && (
              <section className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold mb-2">Taille du marche</h3>
                <p className="text-gray-300">{demo.business_plan.market_size}</p>
              </section>
            )}
            {demo.business_plan?.competitive_advantage && (
              <section className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold mb-2">Avantage competitif</h3>
                <p className="text-gray-300">{demo.business_plan.competitive_advantage}</p>
              </section>
            )}
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">Opportunites identifiees</h2>
            {opportunities.length === 0 ? (
              <p className="text-gray-400">Aucune opportunite identifiee pour le moment.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {opportunities.map((o, i) => (
                  <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="font-bold mb-1">{o.title}</h3>
                    <div className="flex gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-[#C9A84C]/20 text-[#C9A84C] text-xs">{o.sector}</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-xs">{o.country}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{o.potential}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'investors' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-6">Investisseurs potentiels</h2>
            {investors.length === 0 ? (
              <p className="text-gray-400">Aucun investisseur matche pour le moment.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {investors.map((inv, i) => (
                  <div key={i} className="p-5 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="font-bold mb-1">{inv.name}</h3>
                    <p className="text-sm text-[#C9A84C] mb-2">{inv.type} — {inv.ticket_range}</p>
                    <div className="flex flex-wrap gap-1">
                      {inv.sectors.map((s, j) => (
                        <span key={j} className="px-2 py-0.5 rounded bg-white/10 text-gray-300 text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'market' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">Donnees Marche</h2>
            {demo.market_data ? (
              <div className="grid md:grid-cols-3 gap-4">
                {demo.market_data.population && (
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-3xl font-bold text-[#C9A84C]">{demo.market_data.population}</p>
                    <p className="text-sm text-gray-400 mt-1">Population</p>
                  </div>
                )}
                {demo.market_data.gdp_growth && (
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-3xl font-bold text-green-400">{demo.market_data.gdp_growth}</p>
                    <p className="text-sm text-gray-400 mt-1">Croissance PIB</p>
                  </div>
                )}
                {demo.market_data.trade_volume && (
                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-3xl font-bold text-blue-400">{demo.market_data.trade_volume}</p>
                    <p className="text-sm text-gray-400 mt-1">Volume Commercial</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Donnees marche en cours de collecte...</p>
            )}
            {demo.product_focus && demo.product_focus.length > 0 && (
              <section className="p-6 rounded-xl bg-white/5 border border-white/10">
                <h3 className="font-bold mb-3">Produits cibles</h3>
                <div className="flex flex-wrap gap-2">
                  {demo.product_focus.map((p, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-[#C9A84C]/20 text-[#C9A84C]">{p}</span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* CTA Sticky */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-[#07090F] via-[#07090F]/95 to-transparent pt-8 pb-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-300 text-sm">
            Ces donnees sont generees pour <strong>{demo.full_name}</strong>. Rejoignez Feel The Gap pour acceder a tout.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/pricing?ref=demo_${demo.token}`}
              className="px-6 py-3 bg-[#C9A84C] text-black font-bold rounded-lg hover:bg-[#D4B65E] transition-colors"
              onClick={() => setShowCTA(true)}
            >
              Rejoindre Feel The Gap
            </Link>
            <Link
              href={`/map?country=${demo.country_iso || ''}`}
              className="px-6 py-3 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
            >
              Explorer la carte
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
