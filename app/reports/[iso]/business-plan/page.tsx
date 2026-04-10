'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import BudgetShortfallNotice from '@/components/BudgetShortfallNotice'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OppRow {
  id: string; type: string; opportunity_score: number
  gap_value_usd: number | null; summary: string | null
  products: { name: string; category: string } | null
}

interface UserContext {
  qty_tons: string; price_eur_kg: string; budget_eur: string
  timeline: string; sector: string; notes: string
}

interface ActionPhase {
  phase: number; title: string; duration: string
  actions: string[]; milestones: string[]; budget_eur: number; icon: string
}

interface Financials {
  initial_investment_min: number; initial_investment_max: number
  monthly_revenue_y1: number; monthly_revenue_y3: number
  monthly_costs_y1: number; monthly_costs_y3: number
  margin_pct: number; breakeven_months: number; roi_3y_pct: number; notes: string
}

interface B2BTarget {
  segment: string; description: string; potential: string
  examples: string[]; approach: string; decision_cycle: string; volume_per_client: string
}

interface Strategy {
  model: string; title: string; description: string
  pros: string[]; cons: string[]
  investment_min_eur: number; investment_max_eur: number
  timeline_months: number; margin_pct_min: number; margin_pct_max: number
  breakeven_months: number
  // Mode-specific sub-plan (new schema since 3-modes generation).
  // Optional for backwards compat with older cached plans.
  action_plan?: ActionPhase[]
  financials?: Financials
  b2b_targets?: B2BTarget[]
}

interface Risk {
  title: string; description: string
  impact: 'high' | 'medium' | 'low'; probability: 'high' | 'medium' | 'low'; mitigation: string
}

interface Resource {
  name: string; description: string; url: string | null; type: string
}

interface Plan {
  title: string; tagline: string; hero_image_query: string
  executive_summary: string; market_context: string; opportunity_rationale: string
  strategies: Strategy[]; action_plan: ActionPhase[]; financials: Financials
  b2b_targets: B2BTarget[]; risks: Risk[]
  key_success_factors: string[]; quick_wins: string[]
  useful_resources: Resource[]; products_focus: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtEur(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M €'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K €'
  return v.toLocaleString() + ' €'
}

// Filter plan.strategies by checked modes + apply scope reduction (prorata).
// We keep the other sections (executive_summary, market_context, risks…) intact.
// The aggregated top-level sections (action_plan, financials, b2b_targets) used by
// PlanDisplay are sourced from the first selected strategy's mode-specific data.
// If no modes are checked, we show all 3 as a safety fallback.
function filterPlanByModes(plan: Plan, selectedModels: string[], scopePct: number): Plan {
  const modes = selectedModels.length ? selectedModels : ['import_sell', 'produce_locally', 'train_locals']
  const factor = 1 - Math.min(Math.max(scopePct, 0), 100) / 100

  const filteredStrategies = (plan.strategies ?? []).filter((s) => modes.includes(s.model))

  // Apply factor to the investment fields of each filtered strategy
  const adjustedStrategies: Strategy[] = filteredStrategies.map((s) => ({
    ...s,
    investment_min_eur: Math.round(s.investment_min_eur * factor),
    investment_max_eur: Math.round(s.investment_max_eur * factor),
  }))

  const lead = adjustedStrategies[0]

  // Aggregated sections come from the lead strategy (new schema) or plan top-level (legacy cache).
  const baseActionPlan = lead?.action_plan ?? plan.action_plan ?? []
  const baseFinancials: Financials | undefined = lead?.financials ?? plan.financials
  const baseB2B = lead?.b2b_targets ?? plan.b2b_targets ?? []

  const scaledFinancials: Financials | undefined = baseFinancials && factor !== 1 ? {
    ...baseFinancials,
    initial_investment_min: Math.round(baseFinancials.initial_investment_min * factor),
    initial_investment_max: Math.round(baseFinancials.initial_investment_max * factor),
    monthly_revenue_y1: Math.round(baseFinancials.monthly_revenue_y1 * factor),
    monthly_revenue_y3: Math.round(baseFinancials.monthly_revenue_y3 * factor),
    monthly_costs_y1: Math.round(baseFinancials.monthly_costs_y1 * factor),
    monthly_costs_y3: Math.round(baseFinancials.monthly_costs_y3 * factor),
  } : baseFinancials

  const scaledActionPlan: ActionPhase[] = baseActionPlan.map((p) => ({
    ...p,
    budget_eur: Math.round(p.budget_eur * factor),
  }))

  return {
    ...plan,
    strategies: adjustedStrategies,
    action_plan: scaledActionPlan,
    financials: scaledFinancials ?? plan.financials,
    b2b_targets: baseB2B,
  }
}

const MODEL_META: Record<string, { label: string; icon: string; color: string }> = {
  import_sell:     { label: 'Import & Revente',    icon: '🚢', color: '#60A5FA' },
  produce_locally: { label: 'Production locale',   icon: '🏭', color: '#34D399' },
  train_locals:    { label: 'Former les locaux',   icon: '🎓', color: '#C9A84C' },
}

const RISK_COLOR: Record<string, string> = {
  high: '#EF4444', medium: '#F97316', low: '#34D399'
}
const RISK_BG: Record<string, string> = {
  high: '#EF444420', medium: '#F9741620', low: '#34D39920'
}
const RISK_LABEL: Record<string, string> = {
  high: 'Élevé', medium: 'Moyen', low: 'Faible'
}

const CAT_ICON: Record<string, string> = {
  agriculture: '🌾', energy: '⚡', materials: '🪨', manufactured: '🏭', resources: '💧',
}

// Financial chart: monthly revenue/cost bars for Y1→Y3
function FinancialChart({ fin }: { fin: Financials }) {
  const max = fin.monthly_revenue_y3 * 1.1
  const bars = [
    { label: 'An 1 (moy.)', rev: fin.monthly_revenue_y1, cost: fin.monthly_costs_y1 },
    { label: 'An 2 (est.)', rev: Math.round((fin.monthly_revenue_y1 + fin.monthly_revenue_y3) / 2), cost: Math.round((fin.monthly_costs_y1 + fin.monthly_costs_y3) / 2) },
    { label: 'An 3 (cible)', rev: fin.monthly_revenue_y3, cost: fin.monthly_costs_y3 },
  ]
  return (
    <div className="space-y-3">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{b.label}</span>
            <span className="text-xs text-gray-500">Rev: <span className="text-[#34D399] font-bold">{fmtEur(b.rev)}</span> / Coûts: <span className="text-[#F97316] font-bold">{fmtEur(b.cost)}</span></span>
          </div>
          <div className="relative h-6 bg-white/5 rounded-lg overflow-hidden">
            <div className="absolute left-0 top-0 h-full rounded-lg transition-all" style={{ width: `${(b.rev / max) * 100}%`, background: 'linear-gradient(90deg,#34D399,#059669)' }} />
            <div className="absolute left-0 top-0 h-full rounded-lg opacity-70 transition-all" style={{ width: `${(b.cost / max) * 100}%`, background: 'linear-gradient(90deg,#F97316,#dc2626)' }} />
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-gray-500 mt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#34D399] inline-block" />Revenus</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#F97316] inline-block" />Coûts</span>
      </div>
    </div>
  )
}

// Gauge SVG
function Gauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(value / max, 1)
  const r = 28, cx = 36, cy = 36
  const circ = 2 * Math.PI * r
  const dash = circ * 0.75 // 3/4 of circle
  const offset = dash * (1 - pct)
  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff10" strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ * 0.125}
          strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash * pct} ${circ - dash * pct}`} strokeDashoffset={circ * 0.125}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">{value}%</text>
      </svg>
      <span className="text-xs text-gray-500 mt-1 text-center">{label}</span>
    </div>
  )
}

// ── Generating screen ─────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  { icon: '🔍', label: 'Analyse des opportunités sélectionnées…' },
  { icon: '📊', label: 'Étude du marché local et des données sectorielles…' },
  { icon: '🎯', label: 'Définition des stratégies d\'entrée de marché…' },
  { icon: '📋', label: 'Construction du plan d\'action étape par étape…' },
  { icon: '💰', label: 'Calcul des projections financières…' },
  { icon: '🤝', label: 'Identification des clients B2B cibles…' },
  { icon: '⚠️', label: 'Évaluation des risques et facteurs de succès…' },
  { icon: '✨', label: 'Finalisation du business plan…' },
]

function GeneratingScreen({ opps, models, country }: { opps: OppRow[]; models: string[]; country: string }) {
  const [step, setStep] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStep(s => (s < GENERATION_STEPS.length - 1 ? s + 1 : s))
    }, 4500)
    const dotsTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => { clearInterval(stepTimer); clearInterval(dotsTimer) }
  }, [])

  const products = opps.map(o => o.products?.name).filter(Boolean).join(', ')
  const modelLabels = models.map(m => MODEL_META[m]?.label ?? m).join(' · ')

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Central animation */}
      <div className="flex flex-col items-center text-center mb-10">
        {/* Orbiting rings */}
        <div className="relative w-28 h-28 mb-6">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/20 animate-spin" style={{ animationDuration: '8s' }} />
          {/* Middle ring */}
          <div className="absolute inset-3 rounded-full border-2 border-[#C9A84C]/40 animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
          {/* Inner ring with gap */}
          <div className="absolute inset-6 rounded-full border-2 border-t-[#C9A84C] border-r-[#C9A84C] border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '2s' }} />
          {/* Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#C9A84C20,#C9A84C40)', border: '1px solid #C9A84C50' }}>
              ✨
            </div>
          </div>
          {/* Orbiting dot */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 rounded-full bg-[#C9A84C]" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Génération en cours{dots}
        </h2>
        <p className="text-gray-400 text-sm max-w-sm">
          Notre IA analyse les données de marché et rédige votre business plan personnalisé pour <span className="text-white font-medium">{country}</span>
        </p>
      </div>

      {/* Context recap */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {opps.map(o => (
            <span key={o.id} className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"
              style={{ background: '#C9A84C12', border: '1px solid #C9A84C30', color: '#C9A84C' }}>
              {CAT_ICON[o.products?.category ?? ''] ?? '📦'} {o.products?.name}
            </span>
          ))}
          {models.map(m => {
            const meta = MODEL_META[m]
            return meta ? (
              <span key={m} className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                style={{ background: meta.color + '12', border: `1px solid ${meta.color}30`, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
            ) : null
          })}
        </div>
      </div>

      {/* Steps progress */}
      <div className="space-y-2">
        {GENERATION_STEPS.map((s, i) => {
          const isDone = i < step
          const isCurrent = i === step
          return (
            <div key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500"
              style={{
                background: isCurrent ? 'rgba(201,168,76,0.08)' : isDone ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                border: isCurrent ? '1px solid rgba(201,168,76,0.25)' : isDone ? '1px solid rgba(52,211,153,0.15)' : '1px solid transparent',
                opacity: i > step + 2 ? 0.3 : 1,
              }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                style={{
                  background: isDone ? '#34D39920' : isCurrent ? '#C9A84C20' : '#ffffff08',
                  border: isDone ? '1px solid #34D39940' : isCurrent ? '1px solid #C9A84C40' : '1px solid #ffffff10',
                }}>
                {isDone ? '✓' : isCurrent ? (
                  <div className="w-3 h-3 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                ) : s.icon}
              </div>
              <span className="text-sm"
                style={{ color: isDone ? '#34D399' : isCurrent ? 'white' : '#4b5563' }}>
                {s.label}
              </span>
              {isCurrent && (
                <div className="ml-auto flex gap-0.5">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="w-1 h-3 rounded-full bg-[#C9A84C] animate-bounce"
                      style={{ animationDelay: `${j * 150}ms`, animationDuration: '0.8s' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-600 mt-6">
        ⏱ Temps estimé : 30–60 secondes · Propulsé par Gemini 2.0 Flash
      </p>
    </div>
  )
}

// ── Context form step ──────────────────────────────────────────────────────────

function ContextForm({
  opps, models, onSubmit, loading, countryName,
}: {
  opps: OppRow[]; models: string[]; onSubmit: (ctx: UserContext) => void; loading: boolean; countryName: string
}) {
  const [ctx, setCtx] = useState<UserContext>({
    qty_tons: '', price_eur_kg: '', budget_eur: '', timeline: '12-24 mois', sector: '', notes: '',
  })
  const up = (k: keyof UserContext) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setCtx(c => ({ ...c, [k]: e.target.value }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Personnalisez votre business plan</h2>
        <p className="text-gray-400 text-sm">Ces informations permettent à l'IA d'adapter les projections financières à votre situation.</p>
      </div>

      {/* Selected opportunities recap */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-5 mb-6">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Opportunités sélectionnées</div>
        <div className="flex flex-wrap gap-2">
          {opps.map(o => (
            <span key={o.id} className="px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5"
              style={{ background: '#C9A84C15', border: '1px solid #C9A84C40', color: '#C9A84C' }}>
              {CAT_ICON[o.products?.category ?? ''] ?? '📦'} {o.products?.name ?? 'Produit'}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {models.map(m => {
            const meta = MODEL_META[m]
            return meta ? (
              <span key={m} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1"
                style={{ background: meta.color + '15', border: `1px solid ${meta.color}40`, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
            ) : null
          })}
        </div>
      </div>

      {/* Context form */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6 space-y-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Votre contexte (optionnel mais recommandé)</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Volume visé (tonnes/mois)</label>
            <input value={ctx.qty_tons} onChange={up('qty_tons')} type="text" placeholder="ex: 10"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Prix de vente cible (€/kg)</label>
            <input value={ctx.price_eur_kg} onChange={up('price_eur_kg')} type="text" placeholder="ex: 1.20"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Budget disponible (€)</label>
            <input value={ctx.budget_eur} onChange={up('budget_eur')} type="text" placeholder="ex: 150000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Horizon de temps</label>
            <select value={ctx.timeline} onChange={up('timeline')}
              className="w-full bg-[#0D1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/40">
              <option>6-12 mois</option>
              <option>12-24 mois</option>
              <option>24-36 mois</option>
              <option>3-5 ans</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Votre secteur d'activité actuel</label>
          <input value={ctx.sector} onChange={up('sector')} type="text" placeholder="ex: Distribution alimentaire, Import-export, Industrie..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Informations complémentaires</label>
          <textarea value={ctx.notes} onChange={up('notes')} rows={3}
            placeholder={`Ex: J'ai déjà des contacts en ${countryName}, je cherche un produit alimentaire à fort volume, j'ai une expérience dans la logistique froide…`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40 resize-none" />
        </div>
      </div>

      <button
        onClick={() => onSubmit(ctx)}
        disabled={loading}
        className="w-full mt-6 py-4 rounded-2xl font-bold text-[#07090F] text-base transition-all flex items-center justify-center gap-3"
        style={{ background: loading ? '#8B7A3A' : 'linear-gradient(135deg,#C9A84C,#E8C97A)' }}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-[#07090F] border-t-transparent rounded-full animate-spin" />
            Génération en cours… (30-60 sec)
          </>
        ) : (
          <>✨ Générer mon Business Plan IA →</>
        )}
      </button>
    </div>
  )
}

// ── Chat context sidebar ───────────────────────────────────────────────────────

function ContextChat({ plan, country, iso, opps }: { plan: Plan; country: string; iso: string; opps: OppRow[] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Bonjour ! Je suis votre conseiller IA pour ce business plan sur ${country}. Posez-moi vos questions : volumes, investissements, partenaires locaux, réglementation, financement...` },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    if (!input.trim() || loading) return
    const q = input.trim()
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)

    try {
      const context = {
        country, iso,
        product: opps.map(o => o.products?.name).join(', '),
        category: opps[0]?.products?.category ?? '',
        strategy: plan.strategies?.[0]?.model ?? 'import_sell',
      }
      // Build full message history (exclude the greeting AI message)
      const history = messages
        .filter(m => m.role !== 'ai' || m.text !== messages[0].text) // skip initial greeting
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))
        .filter(m => m.content.trim())
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: q }],
          context,
        }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ''
      setMessages(m => [...m, { role: 'ai', text: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value)
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'ai', text: full }
          return copy
        })
      }
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Désolé, une erreur s\'est produite.' }])
    } finally {
      setLoading(false)
    }

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-50 transition-all"
        style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F' }}
        title="Conseiller IA"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-2 md:right-6 w-[calc(100vw-16px)] md:w-80 max-w-80 h-[480px] rounded-2xl flex flex-col overflow-hidden z-50 shadow-2xl"
          style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,.2)' }}>
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <span className="text-lg">💬</span>
            <div>
              <div className="text-sm font-bold text-white">Conseiller IA</div>
              <div className="text-xs text-gray-500">Posez vos questions sur ce plan</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                  style={{
                    background: m.role === 'user' ? '#C9A84C20' : '#ffffff08',
                    border: m.role === 'user' ? '1px solid #C9A84C40' : '1px solid #ffffff10',
                    color: m.role === 'user' ? '#E8C97A' : '#d1d5db',
                  }}>
                  {m.text || <span className="opacity-50">…</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-white/5 flex gap-2">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Votre question…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/40"
            />
            <button onClick={send} disabled={loading}
              className="px-3 py-2 rounded-xl text-sm font-bold transition-colors"
              style={{ background: '#C9A84C', color: '#07090F' }}>
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Hero image mapping ─────────────────────────────────────────────────────────

const CATEGORY_PHOTOS: Record<string, string> = {
  agriculture:  'photo-1574943320219-553eb213f72d', // wheat field
  energy:       'photo-1466611653911-95081537e5b7', // solar panels
  materials:    'photo-1611974789855-9c2a0a7236a3', // metals/mining
  manufactured: 'photo-1565043589221-1a6fd9ae45c7', // factory
  resources:    'photo-1441974231531-c6227db76b6e', // nature/water
}

// Keyword → curated Unsplash photo IDs
const KEYWORD_PHOTOS: Record<string, string> = {
  guinea:       'photo-1547471080-7cc2caa01a7e', // African market
  africa:       'photo-1547471080-7cc2caa01a7e',
  market:       'photo-1534533983688-98e09e8d71e9',
  trade:        'photo-1526304640581-d334cdbbf45e', // globe trade
  rice:         'photo-1536304929831-ee1ca9d44906',
  wheat:        'photo-1574943320219-553eb213f72d',
  fish:         'photo-1498654200943-1088dd4438ae',
  mining:       'photo-1611974789855-9c2a0a7236a3',
  solar:        'photo-1466611653911-95081537e5b7',
  construction: 'photo-1504307651254-35680f356dfd',
  food:         'photo-1534533983688-98e09e8d71e9',
  import:       'photo-1521791136064-7986c2920216', // shipping containers
  export:       'photo-1521791136064-7986c2920216',
}

function heroImageUrl(query: string | undefined, category: string | undefined): string {
  const base = 'https://images.unsplash.com'
  const params = 'w=1200&auto=format&fit=crop&q=80'

  // Try keyword match first
  if (query) {
    const q = query.toLowerCase()
    for (const [kw, id] of Object.entries(KEYWORD_PHOTOS)) {
      if (q.includes(kw)) return `${base}/${id}?${params}`
    }
  }

  // Fall back to category
  const catId = CATEGORY_PHOTOS[category ?? '']
  if (catId) return `${base}/${catId}?${params}`

  // Default
  return `${base}/photo-1526304640581-d334cdbbf45e?${params}`
}

// ── Plan display ──────────────────────────────────────────────────────────────

function PlanDisplay({ plan, opps, country, iso, userTier, userBudgetEur, onChangeBudget, scopePct }: {
  plan: Plan; opps: OppRow[]; country: string; iso: string; userTier: string
  userBudgetEur: number | null
  onChangeBudget: (v: number | null) => void
  scopePct: number
}) {
  const isPremium = ['premium', 'enterprise'].includes(userTier)

  // Deduplicate b2b_targets if empty
  const b2bTargets = plan.b2b_targets?.length ? plan.b2b_targets : []

  return (
    <div className="space-y-8 overflow-hidden break-words">

      {/* ── Scope reduction banner ── */}
      {scopePct > 0 && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}
        >
          <span className="text-lg">📉</span>
          <div className="flex-1">
            <span className="text-white font-semibold">Plan adapté à votre budget : </span>
            <span className="text-[#60A5FA]">
              ampleur réduite de {scopePct} % — vous adresserez {100 - scopePct} % de l'opportunité initiale.
            </span>
          </div>
        </div>
      )}

      {/* ── Complementary info: budget input ── */}
      <div
        className="flex flex-col md:flex-row md:items-center gap-3 rounded-2xl px-4 py-3 text-sm"
        style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.15)' }}
      >
        <span className="text-lg">💼</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold">Votre budget disponible</div>
          <div className="text-[11px] text-gray-500">
            Indiquez combien vous pouvez investir — nous vérifions si c'est suffisant pour couvrir 100 % de l'opportunité.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            value={userBudgetEur ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              onChangeBudget(v)
            }}
            placeholder="ex : 150000"
            className="w-36 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50"
          />
          <span className="text-sm text-gray-400">€</span>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ height: 280 }}>
        <img
          src={heroImageUrl(plan.hero_image_query, opps[0]?.products?.category)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={e => {
            (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&auto=format&fit=crop&q=80`
          }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(7,9,15,0.85) 0%, rgba(7,9,15,0.5) 100%)' }} />
        <div className="absolute inset-0 p-4 md:p-8 flex flex-col justify-end">
          <div className="flex flex-wrap gap-2 mb-3">
            {plan.products_focus?.map(p => (
              <span key={p} className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: '#C9A84C20', border: '1px solid #C9A84C50', color: '#C9A84C' }}>{p}</span>
            ))}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{plan.title}</h1>
          <p className="text-gray-300 text-sm max-w-2xl">{plan.tagline}</p>
        </div>
        {/* KPI strip overlay */}
        <div className="absolute top-5 right-5 flex gap-3">
          {plan.financials && [
            { v: `${plan.financials.roi_3y_pct}%`, l: 'ROI 3 ans', c: '#C9A84C' },
            { v: `${plan.financials.breakeven_months} mois`, l: 'Break-even', c: '#34D399' },
            { v: `${plan.financials.margin_pct}%`, l: 'Marge brute', c: '#60A5FA' },
          ].map(k => (
            <div key={k.l} className="text-center px-3 py-2 rounded-xl" style={{ background: 'rgba(7,9,15,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="font-bold text-sm" style={{ color: k.c }}>{k.v}</div>
              <div className="text-[10px] text-gray-400">{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive summary ── */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center text-sm">📋</span>
          Synthèse exécutive
        </h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">{plan.executive_summary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Contexte marché</div>
            <p className="text-gray-400 text-sm leading-relaxed">{plan.market_context}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Pourquoi maintenant ?</div>
            <p className="text-gray-400 text-sm leading-relaxed">{plan.opportunity_rationale}</p>
          </div>
        </div>
      </div>

      {/* ── Strategies ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#60A5FA]/15 flex items-center justify-center text-sm">🎯</span>
          Modèles commerciaux retenus
        </h2>
        <div className="grid gap-5">
          {plan.strategies?.map((s, i) => {
            const meta = MODEL_META[s.model] ?? { label: s.model, icon: '📊', color: '#C9A84C' }
            return (
              <div key={i} className="bg-[#0D1117] border rounded-2xl overflow-hidden" style={{ borderColor: meta.color + '30' }}>
                <div className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: meta.color + '15' }}>
                    {meta.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-white">{s.title}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: meta.color + '20', color: meta.color }}>{meta.label}</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{s.description}</p>
                  </div>
                </div>

                {/* Metrics strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-t border-white/5">
                  {[
                    { l: 'Investissement', v: `${fmtEur(s.investment_min_eur)} – ${fmtEur(s.investment_max_eur)}`, icon: '💼' },
                    { l: 'Durée', v: `${s.timeline_months} mois`, icon: '⏱️' },
                    { l: 'Marge brute', v: `${s.margin_pct_min}%–${s.margin_pct_max}%`, icon: '📈' },
                    { l: 'Break-even', v: `${s.breakeven_months} mois`, icon: '⚖️' },
                  ].map(m => (
                    <div key={m.l} className="bg-[#0D1117] p-4">
                      <div className="text-xs text-gray-500 mb-1">{m.icon} {m.l}</div>
                      <div className="text-sm font-bold text-white">{m.v}</div>
                    </div>
                  ))}
                </div>

                {/* Pros/cons */}
                <div className="grid grid-cols-2 gap-4 p-5 border-t border-white/5">
                  <div>
                    <div className="text-xs text-[#34D399] uppercase tracking-wide mb-2 font-semibold">Avantages</div>
                    <ul className="space-y-1">
                      {s.pros?.map((p, j) => <li key={j} className="text-xs text-gray-300 flex items-start gap-1.5"><span className="text-[#34D399] mt-0.5">✓</span>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-[#F97316] uppercase tracking-wide mb-2 font-semibold">Points de vigilance</div>
                    <ul className="space-y-1">
                      {s.cons?.map((c, j) => <li key={j} className="text-xs text-gray-300 flex items-start gap-1.5"><span className="text-[#F97316] mt-0.5">⚠</span>{c}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Action plan ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#34D399]/15 flex items-center justify-center text-sm">🗺️</span>
          Plan d'action structuré
        </h2>
        <div className="space-y-4">
          {plan.action_plan?.map((phase, i) => (
            <div key={i} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-4 p-5 pb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: `hsl(${i * 60 + 180},60%,40%)20`, border: `1px solid hsl(${i * 60 + 180},60%,40%)40` }}>
                  {phase.icon ?? `${i + 1}`}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-500 font-mono">Phase {phase.phase}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                    <span className="text-xs text-gray-400">{phase.duration}</span>
                    <span className="ml-auto text-xs font-bold" style={{ color: '#C9A84C' }}>{fmtEur(phase.budget_eur)}</span>
                  </div>
                  <h3 className="font-bold text-white text-sm mt-0.5">{phase.title}</h3>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 px-5 pb-5">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Actions</div>
                  <ul className="space-y-1.5">
                    {phase.actions?.map((a, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ background: '#C9A84C20', color: '#C9A84C' }}>{j + 1}</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                {phase.milestones?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Livrables</div>
                    <ul className="space-y-1.5">
                      {phase.milestones.map((m, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-gray-300">
                          <span className="text-[#34D399] mt-0.5 shrink-0">✓</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Financial projections ── */}
      {plan.financials && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center text-sm">💰</span>
            Projections financières
          </h2>

          {/* Gauges */}
          <div className="flex justify-around mb-6 flex-wrap gap-4">
            <Gauge value={plan.financials.roi_3y_pct} max={400} color="#C9A84C" label="ROI 3 ans" />
            <Gauge value={plan.financials.margin_pct} max={60} color="#34D399" label="Marge brute" />
            <Gauge value={Math.round((1 - plan.financials.breakeven_months / 36) * 100)} max={100} color="#60A5FA" label="Score rentabilité" />
          </div>

          {/* Revenue chart */}
          <div className="bg-white/3 rounded-xl p-4 mb-5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Revenus / Coûts mensuels estimés</div>
            <FinancialChart fin={plan.financials} />
          </div>

          {/* KPI table */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { l: 'Investissement initial', v: `${fmtEur(plan.financials.initial_investment_min)} – ${fmtEur(plan.financials.initial_investment_max)}`, c: '#C9A84C' },
              { l: 'CA mensuel an 1', v: fmtEur(plan.financials.monthly_revenue_y1), c: '#34D399' },
              { l: 'CA mensuel an 3', v: fmtEur(plan.financials.monthly_revenue_y3), c: '#34D399' },
              { l: 'Break-even', v: `${plan.financials.breakeven_months} mois`, c: '#60A5FA' },
              { l: 'ROI 3 ans', v: `${plan.financials.roi_3y_pct}%`, c: '#C9A84C' },
              { l: 'Marge brute', v: `${plan.financials.margin_pct}%`, c: '#A78BFA' },
            ].map(k => (
              <div key={k.l} className="bg-white/3 rounded-xl p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{k.l}</div>
                <div className="font-bold text-sm" style={{ color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          {plan.financials.notes && (
            <p className="text-xs text-gray-600 mt-3 italic">{plan.financials.notes}</p>
          )}
        </div>
      )}

      {/* ── B2B Targets ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#A78BFA]/15 flex items-center justify-center text-sm">🤝</span>
          Clients B2B cibles
          <span className="ml-auto text-xs font-normal text-gray-500">{b2bTargets.length} segments identifiés</span>
        </h2>
        <p className="text-xs text-gray-500 mb-4">Ces segments représentent vos acheteurs potentiels directs. Les coordonnées individuelles sont disponibles pour les abonnés Premium.</p>

        <div className="grid gap-4">
          {b2bTargets.map((t, i) => (
            <div key={i} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-bold text-white">{t.segment}</h3>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{t.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-500">Volume/client</div>
                  <div className="text-sm font-bold text-[#C9A84C]">{t.volume_per_client}</div>
                </div>
              </div>

              {/* Example companies */}
              <div className="mb-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Entreprises cibles (exemples)</div>
                <div className="flex flex-wrap gap-2">
                  {t.examples?.map((ex, j) => (
                    <span key={j} className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: '#ffffff08', border: '1px solid #ffffff15', color: '#d1d5db' }}>
                      🏢 {ex}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px]" style={{
                    background: t.decision_cycle === 'court' ? '#34D39920' : t.decision_cycle === 'moyen' ? '#F9741620' : '#EF444420',
                    color: t.decision_cycle === 'court' ? '#34D399' : t.decision_cycle === 'moyen' ? '#F97316' : '#EF4444',
                  }}>Cycle {t.decision_cycle}</span>
                  <span>{t.potential}</span>
                </div>
                <span className="text-xs text-gray-500 italic">{t.approach}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Premium upsell for client contacts */}
        <div className="mt-5 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,.3)' }}>
          <div className="p-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,rgba(201,168,76,0.08),rgba(167,139,250,0.08))' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: '#C9A84C15' }}>
              📋
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">
                {isPremium ? '✓ Liste clients disponible' : `Liste de ${Math.min(b2bTargets.length * 4, 25)} clients B2B vérifiés`}
              </h3>
              <p className="text-sm text-gray-400">
                {isPremium
                  ? 'Accédez aux fiches clients avec coordonnées, volumes achetés et CA via le tableau de bord Premium.'
                  : `Nous avons identifié ${Math.min(b2bTargets.length * 4, 25)} acheteurs B2B potentiels pour ces produits en Guinée et à l'export : centrales d'achat, industriels, distributeurs. Chaque fiche contient : nom, pays, volumes achetés, CA estimé, email de contact.`
                }
              </p>
            </div>
            {isPremium ? (
              <Link href={`/country/${iso}/plan`}
                className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm"
                style={{ background: '#C9A84C', color: '#07090F' }}>
                Accéder →
              </Link>
            ) : (
              <Link href="/pricing"
                className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap"
                style={{ background: '#C9A84C', color: '#07090F' }}>
                Passer Premium →
              </Link>
            )}
          </div>
          {!isPremium && (
            <div className="px-5 pb-4 pt-3 border-t border-white/5">
              {/* Blurred preview */}
              <div className="text-xs text-gray-500 mb-2">Aperçu des fiches clients (contenu réservé Premium)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2" style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none' }}>
                {[
                  { name: 'Groupe CFAO West Africa', type: 'Distributeur', country: 'Guinée/Dakar', vol: '50-200T/mois', ca: '€2-8M/an' },
                  { name: 'SOBRAGUI / Brasseries locales', type: 'Industriel', country: 'Conakry', vol: '100-500T/mois', ca: '€5-20M/an' },
                  { name: 'Centrale d\'achat SONAP', type: 'Centrale achat', country: 'Conakry', vol: '200T+/mois', ca: '€10M+/an' },
                  { name: 'Office des Céréales (OPAG)', type: 'Institution', country: 'Guinée', vol: 'Variable', ca: 'N/A' },
                ].map((c, i) => (
                  <div key={i} className="bg-white/3 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-white">{c.name}</div>
                      <div className="text-[10px] text-gray-500">{c.type} · {c.country}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-[#C9A84C] font-bold">{c.vol}</div>
                      <div className="text-[10px] text-gray-500">{c.ca}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Risk matrix ── */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#EF4444]/15 flex items-center justify-center text-sm">⚠️</span>
          Matrice des risques
        </h2>
        <div className="space-y-3">
          {plan.risks?.map((r, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: RISK_BG[r.impact], border: `1px solid ${RISK_COLOR[r.impact]}30` }}>
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: RISK_COLOR[r.impact] + '30', color: RISK_COLOR[r.impact] }}>
                    {RISK_LABEL[r.impact]}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white text-sm">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.description}</div>
                  <div className="text-xs text-gray-500 mt-1.5 flex items-start gap-1">
                    <span className="text-[#34D399] shrink-0">→</span>
                    <span>{r.mitigation}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-gray-500">Probabilité</div>
                  <div className="text-xs font-bold" style={{ color: RISK_COLOR[r.probability] }}>{RISK_LABEL[r.probability]}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Key success factors + Quick wins ── */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-lg">🔑</span> Facteurs clés de succès
          </h3>
          <ul className="space-y-2">
            {plan.key_success_factors?.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-[#C9A84C] mt-0.5 shrink-0">◆</span>{f}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#0D1117] border border-[rgba(34,197,94,.15)] rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <span className="text-lg">⚡</span> Quick wins (0–3 mois)
          </h3>
          <ul className="space-y-2">
            {plan.quick_wins?.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-[#34D399] mt-0.5 shrink-0">→</span>{w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Useful resources ── */}
      {plan.useful_resources?.length > 0 && (
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#60A5FA]/15 flex items-center justify-center text-sm">🔗</span>
            Ressources utiles
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {plan.useful_resources.map((r, i) => (
              <div key={i} className="bg-white/3 rounded-xl p-4 flex items-start gap-3">
                <span className="text-lg shrink-0">{r.type === 'institution' ? '🏛️' : r.type === 'marketplace' ? '🏪' : r.type === 'database' ? '🗄️' : '🛠️'}</span>
                <div>
                  <div className="font-semibold text-white text-sm">{r.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#60A5FA] hover:underline mt-1 block truncate max-w-[200px]">
                      {r.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div className="flex gap-3 justify-center pb-4 flex-wrap">
        <Link href={`/reports/${iso}`}
          className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors">
          ← Retour au rapport
        </Link>
        <button onClick={() => window.print()}
          className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors">
          🖨️ Imprimer / PDF
        </button>
        <Link href="/pricing"
          className="px-6 py-3 rounded-xl font-bold text-sm transition-colors"
          style={{ background: '#C9A84C', color: '#07090F' }}>
          🚀 Activer Premium →
        </Link>
      </div>

      {/* Context chat */}
      <ContextChat plan={plan} country={country} iso={iso} opps={opps} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessPlanPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const iso = (params?.iso as string ?? '').toUpperCase()

  const selectedOppIds = (searchParams?.get('opps') ?? '').split(',').filter(Boolean)
  const selectedModels = (searchParams?.get('models') ?? 'import_sell,produce_locally,train_locals').split(',').filter(Boolean)

  const [opps, setOpps] = useState<OppRow[]>([])
  const [countryName, setCountryName] = useState('')
  const [loading, setLoading] = useState(false)       // LLM generation in progress
  const [cacheChecked, setCacheChecked] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null) // plan "brut" avec les 3 stratégies
  const [scopePct, setScopePct] = useState(0)         // 0 = pas de réduction, 30 = -30%, etc.
  const [error, setError] = useState('')
  const [userTier, setUserTier] = useState('free')
  // User budget (persisted in localStorage per iso+opps) — drives BudgetShortfallNotice
  const budgetKey = `ftg_bp_budget_${iso}_${[...selectedOppIds].sort().join(',')}`
  const [userBudgetEur, setUserBudgetEur] = useState<number | null>(null)

  // Load persisted budget
  useEffect(() => {
    if (!iso || !selectedOppIds.length) return
    try {
      const raw = localStorage.getItem(budgetKey)
      if (raw) setUserBudgetEur(Number(raw))
    } catch {}
  }, [budgetKey, iso, selectedOppIds.length])

  // Persist budget on change
  useEffect(() => {
    if (userBudgetEur == null) return
    try { localStorage.setItem(budgetKey, String(userBudgetEur)) } catch {}
  }, [userBudgetEur, budgetKey])

  // Load opps + country, then check cache
  useEffect(() => {
    if (!iso || !selectedOppIds.length) return
    Promise.all([
      supabase.from('countries').select('name_fr').eq('id', iso).single(),
      supabase.from('opportunities')
        .select('*, products(name,category)')
        .in('id', selectedOppIds),
    ]).then(([{ data: c }, { data: o }]) => {
      if (c) setCountryName((c as { name_fr: string }).name_fr)
      setOpps((o ?? []) as OppRow[])
    })

    // Get user tier
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('tier').eq('id', user.id).single()
        .then(({ data }) => { if (data?.tier) setUserTier(data.tier) })
    })

    // Cache lookup — if hit, skip generation entirely.
    const oppsParam = [...selectedOppIds].sort().join(',')
    fetch(`/api/reports/business-plan?iso=${iso}&opps=${encodeURIComponent(oppsParam)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.cached && json.plan) {
          setPlan(json.plan as Plan)
          setScopePct(json.scope_reduction_pct ?? 0)
        }
      })
      .catch(() => { /* fall through to form */ })
      .finally(() => setCacheChecked(true))
  }, [iso])

  const generate = async (ctx: UserContext) => {
    // Capture budget from the context form → drives BudgetShortfallNotice
    const parsedBudget = Number((ctx.budget_eur ?? '').replace(/[^\d.]/g, ''))
    if (!Number.isNaN(parsedBudget) && parsedBudget > 0) setUserBudgetEur(parsedBudget)

    setLoading(true)
    setError('')
    try {
      const oppsPayload = opps.map(o => ({
        id: o.id,
        product: o.products?.name ?? '',
        category: o.products?.category ?? '',
        type: o.type,
        score: o.opportunity_score,
        gap_value_usd: o.gap_value_usd,
        summary: o.summary,
      }))

      // API ignores `models` and always generates the 3 modes.
      // userContext is still sent as a hint but doesn't change the shape of the plan.
      const res = await fetch('/api/reports/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName,
          iso,
          opportunities: oppsPayload,
          userContext: ctx,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPlan(json.plan)
      setScopePct(json.scope_reduction_pct ?? 0)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!selectedOppIds.length) {
    return (
      <div className="min-h-screen bg-[#07090F] flex flex-col">
        <Topbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <div className="text-white font-bold mb-2">Aucune opportunité sélectionnée</div>
            <Link href={`/reports/${iso}`} className="text-[#C9A84C] text-sm hover:underline">← Retour au rapport</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col overflow-x-hidden">
      <Topbar />
      <div className="max-w-4xl mx-auto w-full px-4 py-8 overflow-hidden">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/reports" className="hover:text-gray-300">Rapports</Link>
          <span>/</span>
          <Link href={`/reports/${iso}`} className="hover:text-gray-300">{countryName || iso}</Link>
          <span>/</span>
          <span className="text-gray-300">Business Plan</span>
        </div>

        {/* Step indicator */}
        {!plan && (
          <div className="flex items-center gap-3 mb-8">
            {['Sélection', 'Contexte', 'Business Plan'].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={i === 1 ? { background: '#C9A84C', color: '#07090F' } : i < 1 ? { background: '#34D399', color: '#07090F' } : { background: '#ffffff10', color: '#6b7280' }}>
                  {i < 1 ? '✓' : i + 1}
                </div>
                <span className="text-xs" style={{ color: i === 1 ? 'white' : '#6b7280' }}>{step}</span>
                {i < 2 && <span className="text-gray-700 text-xs">→</span>}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-6">
            {error.includes('429') || error.includes('quota') || error.includes('Too Many Requests') ? (
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">⚠️</span>
                <div>
                  <div className="font-bold text-white mb-1">Quota API Gemini dépassé</div>
                  <p className="text-sm text-red-300 mb-3">
                    La clé API Google est sur le tier gratuit et a atteint sa limite. Pour générer des business plans, il faut activer le billing sur Google AI Studio.
                  </p>
                  <div className="space-y-1 text-xs text-gray-400">
                    <p>1. Va sur <span className="text-blue-400">aistudio.google.com</span> → lier une carte Google Cloud</p>
                    <p>2. Gemini 2.0 Flash coûte ~$0.0003 par business plan généré</p>
                    <p>3. Relancer après activation (peut prendre 5 min)</p>
                  </div>
                  <button onClick={() => { setError(''); }} className="mt-3 text-xs text-gray-500 hover:text-gray-300 underline">
                    Réessayer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">❌</span>
                <div>
                  <div className="font-bold text-white mb-1">Erreur de génération</div>
                  <p className="text-sm text-red-300">{error}</p>
                  <button onClick={() => setError('')} className="mt-2 text-xs text-gray-500 hover:text-gray-300 underline">
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <GeneratingScreen opps={opps} models={selectedModels} country={countryName} />
        ) : !cacheChecked ? (
          // Brief skeleton while we check the cache — avoids showing the form
          // then hiding it if the cache is a hit.
          <div className="max-w-2xl mx-auto py-16 text-center text-gray-500 text-sm">
            <div className="w-10 h-10 mx-auto mb-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            Chargement de votre business plan…
          </div>
        ) : !plan ? (
          <ContextForm opps={opps} models={selectedModels} onSubmit={generate} loading={loading} countryName={countryName} />
        ) : (
          <>
            <PlanDisplay
              plan={filterPlanByModes(plan, selectedModels, scopePct)}
              opps={opps}
              country={countryName}
              iso={iso}
              userTier={userTier}
              userBudgetEur={userBudgetEur}
              onChangeBudget={setUserBudgetEur}
              scopePct={scopePct}
            />
            {/* Budget shortfall notice — floats on the right when budget < required_min */}
            <BudgetShortfallNotice
              userBudgetEur={userBudgetEur}
              requiredMinEur={(filterPlanByModes(plan, selectedModels, scopePct).strategies ?? [])
                .reduce((sum, s) => sum + (s.investment_min_eur ?? 0), 0)}
              requiredMaxEur={(filterPlanByModes(plan, selectedModels, scopePct).strategies ?? [])
                .reduce((sum, s) => sum + (s.investment_max_eur ?? 0), 0)}
              iso={iso}
              oppIds={selectedOppIds}
            />
          </>
        )}
      </div>
    </div>
  )
}
