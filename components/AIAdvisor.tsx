'use client'

import { useState, useRef, useEffect } from 'react'
import { trackUpgradeClick } from '@/lib/tracking'
import StrategyIllustration from './StrategyIllustration'

type Strategy = 'trade' | 'production' | 'training'
type Category = 'energy' | 'agriculture' | 'manufactured' | 'technology' | 'all'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Props = {
  country: string
  iso: string
  product: string
  category: Category
  strategy: Strategy
  userBudget?: string
  userTimeline?: string
  userSector?: string
  isPro: boolean
  creditBalance?: number
}

const STRATEGY_META = {
  trade:      { icon: '🚢', label: 'Import & Sell',   color: '#60A5FA' },
  production: { icon: '🏭', label: 'Produce Locally', color: '#22C55E' },
  training:   { icon: '🤝', label: 'Train Locals',    color: '#C9A84C' },
}

export default function AIAdvisor({
  country, iso, product, category, strategy,
  userBudget, userTimeline, userSector,
  isPro, creditBalance = 0,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [credits, setCredits] = useState(creditBalance)
  const [sessionActive, setSessionActive] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const meta = STRATEGY_META[strategy]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startSession() {
    if (!isPro) { setShowPaywall(true); trackUpgradeClick('ai_advisor', 'advisor_start'); return }
    if (credits <= 0) { setShowPaywall(true); return }
    setSessionActive(true)
    // Send opening context message
    await ask(`Je souhaite explorer l'opportunité ${product} au ${country} via la stratégie "${meta.label}". Fais-moi une analyse initiale et pose-moi 2 questions clés pour personnaliser la stratégie.`)
  }

  async function ask(userText: string) {
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Deduct credit on first user message per session
    if (messages.length === 0) {
      setCredits(c => Math.max(0, c - 1))
    }

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          context: { country, iso, product, category, strategy, userBudget, userTimeline, userSector },
        }),
      })

      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Parse SSE chunks
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              assistantText += delta
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: assistantText },
              ])
            } catch { /* skip malformed chunk */ }
          }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: '❌ Erreur de connexion. Réessayez.' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    ask(text)
  }

  // ── Paywall ──────────────────────────────────────────────────────────────────

  if (showPaywall) {
    return (
      <div className="rounded-xl border border-[rgba(201,168,76,.2)] bg-[#0D1117] p-5">
        <div className="text-center py-4">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-base font-bold text-white mb-2">AI Business Advisor</h3>
          {!isPro ? (
            <>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                L'assistant IA est disponible pour les abonnés Pro. Il personnalise la stratégie selon votre budget, timeline et contexte.
              </p>
              <a href="/pricing"
                className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#C9A84C', color: '#000' }}>
                Passer à Pro — €99/mois
              </a>
              <p className="text-xs text-gray-600 mt-3">Inclut 5 sessions IA/mois · €15 par session supplémentaire</p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4">
                Vous n'avez plus de crédits IA. Rechargez pour continuer.
              </p>
              <a href="/account/credits"
                className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#C9A84C', color: '#000' }}>
                Acheter des crédits — €15/session
              </a>
            </>
          )}
          <button onClick={() => setShowPaywall(false)}
            className="block mx-auto mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Retour
          </button>
        </div>
      </div>
    )
  }

  // ── Pre-session ──────────────────────────────────────────────────────────────

  if (!sessionActive) {
    return (
      <div className="rounded-xl border border-[rgba(201,168,76,.2)] bg-[#0D1117] overflow-hidden">
        {/* Illustration */}
        <div className="relative">
          <StrategyIllustration strategy={strategy} category={category} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{meta.icon}</span>
              <span className="text-sm font-bold text-white">{meta.label}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                style={{ background: meta.color + '22', color: meta.color }}>
                {product}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-4">
          <p className="text-sm font-semibold text-white mb-1">AI Business Advisor</p>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            L'assistant analyse votre situation (budget, timeline, marché cible) et génère un plan d'action personnalisé pour {country}.
          </p>

          {isPro && credits > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              {credits} crédit{credits > 1 ? 's' : ''} disponible{credits > 1 ? 's' : ''}
            </p>
          )}

          <div className="space-y-2 mb-4">
            {[
              'Business plan adapté à votre budget',
              'Analyse concurrentielle locale',
              'Étapes de mise en œuvre',
              'Risques & mitigation',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-gray-400">
                <span style={{ color: meta.color }}>✓</span> {f}
              </div>
            ))}
          </div>

          <button onClick={startSession}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: meta.color, color: '#000' }}>
            {isPro && credits > 0 ? 'Démarrer la session IA →' : 'Débloquer l\'assistant IA →'}
          </button>
          {isPro && credits > 0 && (
            <p className="text-center text-xs text-gray-600 mt-2">1 crédit par session (€15)</p>
          )}
        </div>
      </div>
    )
  }

  // ── Chat interface ───────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-[rgba(201,168,76,.2)] bg-[#0D1117] flex flex-col" style={{ height: 440 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <span>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {meta.label} · {product} · {country}
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22C55E22] text-[#22C55E]">
          IA active
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
              style={{ background: m.role === 'user' ? '#C9A84C' : meta.color + '33', color: m.role === 'user' ? '#000' : meta.color }}>
              {m.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-[#1F2937] text-gray-200'
                : 'bg-[#0A1628] border border-white/5 text-gray-300'
            }`}>
              {m.content || <span className="animate-pulse">▌</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Posez votre question…"
            disabled={streaming}
            className="flex-1 bg-[#1F2937] text-white text-xs px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-[#C9A84C] placeholder-gray-600 disabled:opacity-50"
          />
          <button onClick={handleSend} disabled={streaming || !input.trim()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs disabled:opacity-30 transition-opacity hover:opacity-80"
            style={{ background: meta.color, color: '#000' }}>
            →
          </button>
        </div>
      </div>
    </div>
  )
}
