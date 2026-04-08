'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { CountryMapData } from '@/types/database'
import { useLang } from '@/components/LanguageProvider'

interface Props {
  country: CountryMapData
  onClose: () => void
}

const CATEGORY_ICONS: Record<string, string> = {
  agriculture: '🌾', energy: '⚡', materials: '🪨',
  manufactured: '🏭', resources: '💧',
}

function fmtUsd(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(1) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(1) + 'M'
  return sign + '$' + abs.toLocaleString()
}

// Placeholder opportunities — fetched from API once Supabase is populated
const DEMO_OPPORTUNITIES = [
  {
    product: 'Onions & Shallots', score: 91, market_value: '$48M/yr',
    volume: '38,000 t/yr', avg_price: '$1,260/t',
    plans: {
      trade:      { label: 'Import & Distribute', margin: '28%', capex: '$180K', time: '3 months' },
      production: { label: 'Local Farm Unit',     margin: '61%', capex: '$1.2M', time: '18 months' },
      training:   { label: 'Franchise to Locals', margin: '12%', capex: '$80K',  time: '6 months' },
    },
  },
  {
    product: 'Wheat Flour', score: 85, market_value: '$120M/yr',
    volume: '1.2M t/yr', avg_price: '$320/t',
    plans: {
      trade:      { label: 'Bulk Import & Mill', margin: '22%', capex: '$4.2M', time: '6 months' },
      production: { label: 'Local Mill',          margin: '44%', capex: '$8.5M', time: '24 months' },
      training:   { label: 'Co-op Model',         margin: '8%',  capex: '$500K', time: '12 months' },
    },
  },
  {
    product: 'Crude Sunflower Oil', score: 74, market_value: '$31M/yr',
    volume: '28,000 t/yr', avg_price: '$1,100/t',
    plans: {
      trade:      { label: 'FOB Trading',         margin: '38%', capex: '$220K', time: '2 months' },
      production: { label: 'Sunflower Plantation', margin: '55%', capex: '$3.8M', time: '20 months' },
      training:   { label: 'Farmer Network',       margin: '15%', capex: '$300K', time: '9 months' },
    },
  },
]

type PlanKey = 'trade' | 'production' | 'training'

const PLAN_META: Record<PlanKey, { icon: string; color: string; label: string; label_fr: string }> = {
  trade:      { icon: '🚢', color: '#60A5FA', label: 'Import & Sell',    label_fr: 'Import & Revente' },
  production: { icon: '🏭', color: '#22C55E', label: 'Produce Locally',  label_fr: 'Production locale' },
  training:   { icon: '🤝', color: '#C9A84C', label: 'Train Locals',     label_fr: 'Former localement' },
}

// ── AI Advisor Chat ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_EXCHANGES = 5

function AIAdvisorChat({ country }: { country: CountryMapData }) {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const exchangeCount = messages.filter(m => m.role === 'user').length
  const limitReached = exchangeCount >= MAX_EXCHANGES

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming || limitReached) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Append a placeholder for the assistant reply
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            country: country.name_fr,
            iso: country.iso ?? '',
            product: country.top_import_category ?? 'général',
            category: country.top_import_category ?? 'général',
            strategy: 'trade',
          },
        }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
          }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const json = JSON.parse(payload)
            const chunk: string = json?.choices?.[0]?.delta?.content ?? ''
            if (chunk) {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + chunk,
                }
                return updated
              })
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: "Connexion interrompue. Vérifiez votre réseau et réessayez.",
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!open) {
    return (
      <div className="p-3 border-t border-[rgba(201,168,76,.1)]">
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="w-full py-2 flex items-center justify-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold rounded-xl hover:bg-[#C9A84C]/20 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.84 8.84 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
          </svg>
          {fr ? 'Demander à l\'IA sur ce marché' : 'Ask AI about this market'}
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-[rgba(201,168,76,.1)] flex flex-col" style={{ maxHeight: 300 }}>
      {/* Chat header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0D1117]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#C9A84C]">{fr ? 'Conseiller IA' : 'AI Advisor'} — {country.name_fr}</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-600 hover:text-gray-400 transition-colors text-xs"
          aria-label="Close AI chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0" style={{ maxHeight: 200 }}>
        {messages.length === 0 && (
          <p className="text-[11px] text-gray-500 text-center py-3">
            Posez une question sur le marché de {country.name_fr}...
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#C9A84C]/20 text-[#E8C97A] rounded-br-sm'
                  : 'bg-[#1F2937] text-gray-300 rounded-bl-sm'
              }`}
            >
              {msg.content || (
                <span className="inline-flex gap-0.5 items-center">
                  <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Limit reached CTA */}
      {limitReached && (
        <div className="px-3 py-2 bg-[#C9A84C]/5 border-t border-[rgba(201,168,76,.1)] text-center">
          <p className="text-[10px] text-gray-500 mb-1">Limite de 5 échanges atteinte (plan gratuit)</p>
          <a
            href="/pricing"
            className="text-[11px] font-semibold text-[#C9A84C] hover:underline"
          >
            {fr ? 'Upgrade pour illimité →' : 'Upgrade for unlimited →'}
          </a>
        </div>
      )}

      {/* Input */}
      {!limitReached && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[rgba(201,168,76,.1)]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Votre question..."
            className="flex-1 bg-[#1F2937] text-white text-[11px] rounded-lg px-2.5 py-1.5 outline-none placeholder-gray-600 border border-transparent focus:border-[rgba(201,168,76,.3)] disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="shrink-0 px-2.5 py-1.5 bg-[#C9A84C] text-[#07090F] text-[11px] font-bold rounded-lg hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? '…' : '→'}
          </button>
        </div>
      )}

      <div className="px-3 pb-1.5 text-right">
        <span className="text-[9px] text-gray-600">{exchangeCount}/{MAX_EXCHANGES} échanges</span>
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, Record<string, string>> = {
  overview:      { en: 'Overview',      fr: 'Aperçu' },
  opportunities: { en: 'Opportunities', fr: 'Opportunités' },
  reports:       { en: 'Reports',       fr: 'Rapports' },
}

export default function CountryPanel({ country, onClose }: Props) {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [tab, setTab] = useState<'overview' | 'opportunities' | 'reports'>('overview')
  const balance = country.trade_balance_usd ?? 0
  const balancePositive = balance >= 0

  return (
    <div className="fixed md:absolute inset-0 md:inset-auto md:top-0 md:right-0 md:h-full w-full md:max-w-96 bg-[#0D1117] md:border-l border-[rgba(201,168,76,.15)] flex flex-col z-[1100] shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[rgba(201,168,76,.1)]">
        <span className="text-3xl">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white text-base truncate">{country.name_fr}</h2>
          <p className="text-xs text-gray-500">{country.region} · {fr ? 'Données' : 'Data'} {country.data_year ?? '2023'}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(201,168,76,.1)]">
        {(['overview', 'opportunities', 'reports'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {TAB_LABELS[t][lang]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'overview' && (
          <>
            {/* Trade balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fr ? 'Importations' : 'Imports'}</p>
                <p className="text-lg font-bold text-red-400">{fmtUsd(country.total_imports_usd)}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{fr ? 'Exportations' : 'Exports'}</p>
                <p className="text-lg font-bold text-green-400">{fmtUsd(country.total_exports_usd)}</p>
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{fr ? 'Balance commerciale' : 'Trade Balance'}</span>
                <span className={`text-sm font-bold ${balancePositive ? 'text-green-400' : 'text-red-400'}`}>
                  {balancePositive ? '+' : ''}{fmtUsd(balance)}
                </span>
              </div>
              {/* Balance bar */}
              <div className="mt-2 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${balancePositive ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(balance) / (Math.max(country.total_imports_usd ?? 1, country.total_exports_usd ?? 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Top category */}
            {country.top_import_category && (
              <div className="bg-[#111827] rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{CATEGORY_ICONS[country.top_import_category]}</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{fr ? 'Catégorie principale' : 'Top Import Category'}</p>
                  <p className="text-sm font-medium text-white capitalize mt-0.5">{country.top_import_category}</p>
                </div>
              </div>
            )}

            {/* Opportunity score */}
            {country.top_opportunity_score && (
              <div className="bg-gradient-to-br from-[#C9A84C]/10 to-transparent border border-[rgba(201,168,76,.2)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[#C9A84C]">⚡ {fr ? 'Score d\'opportunité' : 'Opportunity Score'}</p>
                  <span className="text-lg font-bold text-[#C9A84C]">{country.top_opportunity_score}/100</span>
                </div>
                <div className="h-1.5 bg-[#1F2937] rounded-full">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]"
                    style={{ width: `${country.top_opportunity_score}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {country.opportunity_count} {fr ? 'opportunités identifiées' : 'business opportunities identified'}
                </p>
              </div>
            )}
          </>
        )}

        {tab === 'opportunities' && (
          <>
            <p className="text-xs text-gray-500">{fr ? 'Gaps de marché identifiés par l\'IA — choisissez votre stratégie d\'entrée' : 'Market gaps identified by AI — choose your entry strategy'}</p>
            {DEMO_OPPORTUNITIES.map((opp, i) => (
              <OpportunityCard key={i} opp={opp} />
            ))}

            {/* Paywall */}
            <div className="bg-[#111827] border border-[rgba(201,168,76,.2)] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1 font-medium">
                +{Math.max(0, country.opportunity_count - 3)} {fr ? 'opportunités supplémentaires' : 'more opportunities'}
              </p>
              <p className="text-[10px] text-gray-500 mb-3">{fr ? 'Valeurs marché et plans détaillés — Plan Pro requis' : 'Full market values & detailed plans require Pro'}</p>
              <button className="px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold rounded-lg hover:bg-[#C9A84C]/20 transition-colors">
                {fr ? 'Passer au plan Strategy — 99 €/mois' : 'Upgrade to Strategist — €99/mo'}
              </button>
            </div>
          </>
        )}

        {tab === 'reports' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{fr ? 'Rapports d\'intelligence pays' : 'Country intelligence reports'}</p>
            {[
              { title: fr ? `${country.name_fr} — Vue d'ensemble commerciale 2023` : `${country.name_fr} — Trade Overview 2023`, tier: 'free', updated: '2024-03-01' },
              { title: fr ? `Analyse des gaps agricoles — ${country.name_fr}` : `Agriculture Gap Analysis — ${country.name_fr}`, tier: 'basic', updated: '2024-02-15' },
              { title: fr ? `Top 10 des opportunités d'import` : `Top 10 Import Opportunities Report`, tier: 'pro', updated: '2024-03-10' },
            ].map((r, i) => (
              <div key={i} className="bg-[#111827] rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{r.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{fr ? 'Mis à jour' : 'Updated'} {r.updated}</p>
                </div>
                {r.tier === 'free' ? (
                  <button className="shrink-0 text-xs text-[#C9A84C] hover:underline">{fr ? 'Lire →' : 'Read →'}</button>
                ) : (
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    r.tier === 'basic' ? 'bg-blue-500/15 text-blue-400' : 'bg-[#C9A84C]/15 text-[#C9A84C]'
                  }`}>
                    {r.tier === 'basic' ? 'Basic' : 'Pro'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Advisor Chat */}
      <AIAdvisorChat country={country} />

      {/* Footer CTA */}
      <div className="p-4 border-t border-[rgba(201,168,76,.1)] flex gap-2">
        <Link
          href={`/reports/${country.iso}`}
          target="_blank"
          className="flex-1 py-2.5 bg-[#C9A84C] text-[#07090F] font-semibold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors text-center"
        >
          📊 {fr ? 'Rapport complet' : 'Full report'}
        </Link>
        <Link
          href={`/country/${country.iso}/plan`}
          target="_blank"
          className="flex-1 py-2.5 bg-white/5 text-gray-300 border border-white/10 font-semibold text-sm rounded-xl hover:bg-white/10 transition-colors text-center"
        >
          📝 {fr ? 'Plan d\'affaires' : 'Business plan'}
        </Link>
      </div>
    </div>
  )
}

// ── Opportunity card with 3-plan selector ────────────────────────────────────

type OppData = typeof DEMO_OPPORTUNITIES[0]

function OpportunityCard({ opp }: { opp: OppData }) {
  const { lang } = useLang()
  const fr = lang === 'fr'
  const [plan, setPlan] = useState<PlanKey>('trade')
  const selected = opp.plans[plan]
  const meta = PLAN_META[plan]

  return (
    <div className="bg-[#111827] rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{opp.product}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{opp.volume} · {fr ? 'moy.' : 'avg'} {opp.avg_price}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[#C9A84C] font-bold text-sm">{opp.market_value}</div>
          <div className="text-[10px] text-gray-500">{fr ? 'marché/an' : 'market/year'}</div>
        </div>
      </div>

      {/* Plan tabs */}
      <div className="flex gap-1">
        {(Object.keys(PLAN_META) as PlanKey[]).map(k => (
          <button
            key={k}
            onClick={() => setPlan(k)}
            className="flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all"
            style={plan === k
              ? { background: PLAN_META[k].color + '22', color: PLAN_META[k].color, border: `1px solid ${PLAN_META[k].color}44` }
              : { background: 'transparent', color: '#6B7280', border: '1px solid #1F2937' }}
          >
            {PLAN_META[k].icon} {fr ? PLAN_META[k].label_fr : PLAN_META[k].label}
          </button>
        ))}
      </div>

      {/* Selected plan summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: fr ? 'Stratégie' : 'Strategy', value: selected.label },
          { label: 'Capex',    value: selected.capex },
          { label: fr ? 'Marge' : 'Margin',   value: selected.margin },
        ].map(item => (
          <div key={item.label} className="bg-[#1F2937] rounded-lg p-2 text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-wide">{item.label}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>⏱ {fr ? 'Délai' : 'Time to market'}: <strong className="text-gray-300">{selected.time}</strong></span>
        <span className="text-[#C9A84C] font-medium cursor-pointer hover:underline">{fr ? 'Plan complet →' : 'Full plan →'}</span>
      </div>
    </div>
  )
}
