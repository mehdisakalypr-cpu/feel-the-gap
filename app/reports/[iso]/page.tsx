'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import JourneySidebar from '@/components/JourneySidebar'
import JourneyChipsBar from '@/components/JourneyChipsBar'
import FillTheGapCreditModal from '@/components/FillTheGapCreditModal'
import { supabase } from '@/lib/supabase'
import { useJourneyContext } from '@/lib/journey/context'
import DOMPurify from 'dompurify'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Country {
  id: string; name: string; name_fr: string; flag: string
  region: string; sub_region: string
  population: number | null; gdp_usd: number | null; gdp_per_capita: number | null
  total_imports_usd: number | null; total_exports_usd: number | null
  trade_balance_usd: number | null; top_import_category: string | null
  arable_land_pct: number | null; data_year: number | null
  top_import_text: string | null; top_export_text: string | null
  renewable_pct: number | null; energy_cost_index: number | null
}

interface Opportunity {
  id: string; type: string; opportunity_score: number
  gap_value_usd: number | null; summary: string | null
  land_availability: string | null; labor_cost_index: number | null
  infrastructure_score: number | null
  products: { name: string; category: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null, digits = 1) {
  if (!v && v !== 0) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(digits) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(digits) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(digits) + 'M'
  return sign + '$' + abs.toLocaleString()
}

function fmtNum(v: number | null) {
  if (!v) return '—'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  return v.toLocaleString()
}

// Returns: investment, time-to-market, margin based on opportunity type + score + energy
function getBusinessMetrics(opp: Opportunity, energyCostIndex?: number | null): { investment: string; ttm: string; margin: string; risk: string; energyAdvantage: string | null } {
  const score = opp.opportunity_score
  const gap = opp.gap_value_usd ?? 0
  const infra = opp.infrastructure_score ?? 5
  const labor = opp.labor_cost_index ?? 30
  const energy = energyCostIndex ?? 50

  // Investment estimate: 10-25% of gap value, adjusted by infra
  const infraFactor = infra < 4 ? 1.4 : infra < 6 ? 1.1 : 0.9
  const investMin = Math.round(gap * 0.08 * infraFactor / 1e6)
  const investMax = Math.round(gap * 0.20 * infraFactor / 1e6)
  const investment = investMin < 1 ? `<$1M – $${investMax}M` : `$${investMin}M – $${investMax}M`

  // Time to market: based on type and infrastructure
  let ttmMin = 12, ttmMax = 24
  if (opp.type === 'import_replacement') { ttmMin = 6; ttmMax = 18 }
  if (opp.type === 'local_production') { ttmMin = 18; ttmMax = 36 }
  if (opp.type === 'export_opportunity') { ttmMin = 12; ttmMax = 30 }
  if (infra < 4) { ttmMin += 6; ttmMax += 12 }
  const ttm = `${ttmMin}–${ttmMax} mois`

  // Margin: labor + energy cost drive this
  const laborAdj = labor < 20 ? 1.3 : labor < 40 ? 1.0 : 0.8
  const energyAdj = energy < 30 ? 1.2 : energy < 50 ? 1.0 : 0.85
  const marginMin = Math.round(15 * laborAdj * energyAdj)
  const marginMax = Math.round(35 * laborAdj * energyAdj)
  const margin = `${marginMin}%–${marginMax}%`

  // Risk
  const risk = score >= 80 ? 'Modéré' : score >= 60 ? 'Élevé' : 'Très élevé'

  // Energy advantage flag
  const energyAdvantage = energy < 30 ? 'Énergie très compétitive (coût bas)' : energy < 45 ? 'Énergie compétitive' : null

  return { investment, ttm, margin, risk, energyAdvantage }
}

// Parse top_import_text into categories with estimated shares
function parseImportText(text: string, totalImports: number | null): Array<{ product: string; pct: number; value: number; color: string }> {
  if (!text) return []
  const raw = text.replace(/\s*\(\d{4}\)$/, '').split(',').map(s => s.trim()).filter(Boolean)

  // Assign categories and weights
  const WEIGHTS: Record<string, { color: string; weight: number }> = {
    'petroleum': { color: '#F97316', weight: 22 },
    'refined petroleum': { color: '#F97316', weight: 22 },
    'crude petroleum': { color: '#F97316', weight: 20 },
    'fuel': { color: '#F97316', weight: 18 },
    'gas': { color: '#FBBF24', weight: 15 },
    'rice': { color: '#34D399', weight: 12 },
    'wheat': { color: '#34D399', weight: 10 },
    'food': { color: '#34D399', weight: 10 },
    'cars': { color: '#60A5FA', weight: 8 },
    'vehicles': { color: '#60A5FA', weight: 8 },
    'machinery': { color: '#60A5FA', weight: 12 },
    'machine': { color: '#60A5FA', weight: 12 },
    'electronics': { color: '#818CF8', weight: 10 },
    'medicine': { color: '#A78BFA', weight: 8 },
    'pharmaceutical': { color: '#A78BFA', weight: 8 },
    'garments': { color: '#EC4899', weight: 7 },
    'clothing': { color: '#EC4899', weight: 7 },
    'steel': { color: '#94A3B8', weight: 9 },
    'iron': { color: '#94A3B8', weight: 8 },
    'construction': { color: '#64748B', weight: 6 },
  }

  const items = raw.slice(0, 8).map(p => {
    const lp = p.toLowerCase()
    let color = '#6B7280'
    let weight = 5
    for (const [k, v] of Object.entries(WEIGHTS)) {
      if (lp.includes(k)) { color = v.color; weight = v.weight; break }
    }
    return { product: p, weight, color }
  })

  const totalWeight = items.reduce((s, i) => s + i.weight, 0)
  const total = totalImports ?? 1e9

  return items.map(i => ({
    product: i.product,
    pct: Math.round((i.weight / totalWeight) * 100),
    value: Math.round((i.weight / totalWeight) * total),
    color: i.color,
  }))
}

const TYPE_LABEL: Record<string, string> = {
  local_production: 'Production locale',
  import_replacement: 'Substitution import',
  export_opportunity: 'Opportunité export',
  processing: 'Transformation',
}

const CAT_ICON: Record<string, string> = {
  agriculture: '🌾', energy: '⚡', materials: '🪨', manufactured: '🏭', resources: '💧',
}

const RISK_COLOR: Record<string, string> = {
  'Faible': '#34D399', 'Modéré': '#FBBF24', 'Élevé': '#F97316', 'Très élevé': '#EF4444',
}

// Turn a free-form product name into a stable slug for the journey store.
// "Cocoa beans" -> "cocoa-beans", "Café Arabica" -> "cafe-arabica".
function productSlugFromName(name: string | null | undefined): string | null {
  if (!name) return null
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || null
}

// ── Main page ─────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'import_sell',     label: 'Import & Revente',   icon: '🚢', desc: 'Acheter à l\'étranger et distribuer' },
  { id: 'produce_locally', label: 'Production locale',  icon: '🏭', desc: 'Installer une capacité de fabrication' },
  { id: 'train_locals',    label: 'Former les locaux',  icon: '🎓', desc: 'Modèle services / transfert de compétences' },
]

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const iso = (params?.iso as string ?? '').toUpperCase()

  const [country, setCountry] = useState<Country | null>(null)
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userTier, setUserTier] = useState<string>('free')
  const [selectedOpps, setSelectedOpps] = useState<Set<string>>(new Set())
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [showModelPanel, setShowModelPanel] = useState(false)
  const [showCheckboxHint, setShowCheckboxHint] = useState(false)
  // Minimum opportunity score filter — 0 = no filter, 100 = only perfect.
  const [minScore, setMinScore] = useState(0)

  // ── Fill-the-Gap bulk BP state (Premium / Ultimate only) ───────────────────
  const [ftgBalance, setFtgBalance] = useState<number | null>(null)
  const [ftgGrant, setFtgGrant] = useState<number>(0)
  const [ftgPeriodEnd, setFtgPeriodEnd] = useState<string | null>(null)
  const [showBpModal, setShowBpModal] = useState(false)
  const [bpSubmitting, setBpSubmitting] = useState(false)
  const [flash, setFlash] = useState<{ kind: 'success' | 'error' | 'info'; msg: string } | null>(null)

  // Tier gating — seuls Premium et Ultimate voient les checkboxes + le bouton bulk BP.
  const canBulkBp = userTier === 'premium' || userTier === 'ultimate'

  // Journey store — when user ticks opportunities, mirror the unique product
  // slugs into the store so every downstream step (plan, clients, videos,
  // store, recap) shows them as chips and scopes data accordingly.
  const setSelectedProductsInStore = useJourneyContext((s) => s.setSelectedProducts)
  const setIsoInStore = useJourneyContext((s) => s.setIso)

  useEffect(() => {
    if (iso) setIsoInStore(iso)
  }, [iso, setIsoInStore])

  const toggleOpp = (id: string) => setSelectedOpps(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleModel = (id: string) => setSelectedModels(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const goToPlan = () => {
    const oppsParam = Array.from(selectedOpps).join(',')
    const modelsParam = Array.from(selectedModels).join(',')
    router.push(`/reports/${iso}/business-plan?opps=${oppsParam}&models=${modelsParam}`)
  }

  useEffect(() => {
    if (!iso) return
    Promise.all([
      supabase.from('countries').select('*').eq('id', iso).single(),
      supabase.from('opportunities').select('*, products(name, category)').eq('country_iso', iso).order('opportunity_score', { ascending: false }),
      supabase.from('reports').select('content_html').eq('country_iso', iso).limit(1).single(),
      supabase.auth.getUser(),
    ]).then(async ([{ data: c }, { data: o }, { data: r }, { data: authData }]) => {
      if (c) setCountry(c as Country)
      setOpps((o ?? []) as Opportunity[])
      if (r?.content_html) setReportHtml(r.content_html)
      if (authData.user) {
        const { data: profile } = await supabase.from('profiles').select('tier').eq('id', authData.user.id).single()
        if (profile?.tier) setUserTier(profile.tier)
      }
      setLoading(false)
    })

    // Restore interested opportunities from localStorage
    try {
      const saved = localStorage.getItem(`ftg_journey_${iso}`)
      if (saved) {
        const data = JSON.parse(saved)
        if (Array.isArray(data.interested_opp_ids)) {
          setSelectedOpps(new Set(data.interested_opp_ids))
        }
      }
    } catch {}
  }, [iso])

  // Fetch Fill-the-Gap balance (Premium / Ultimate only)
  useEffect(() => {
    if (!canBulkBp) return
    let cancelled = false
    fetch('/api/credits/fillthegap/balance')
      .then((r) => r.json())
      .then((j: { ok?: boolean; balance?: number; grant?: number; periodEnd?: string | null }) => {
        if (cancelled || !j?.ok) return
        setFtgBalance(typeof j.balance === 'number' ? j.balance : 0)
        setFtgGrant(typeof j.grant === 'number' ? j.grant : 0)
        setFtgPeriodEnd(j.periodEnd ?? null)
      })
      .catch(() => { /* silent — non-blocking */ })
    return () => { cancelled = true }
  }, [canBulkBp])

  // Auto-dismiss flash after 6s
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 6000)
    return () => clearTimeout(t)
  }, [flash])

  // Persist interested opportunities
  useEffect(() => {
    if (!iso) return
    try {
      const existing = JSON.parse(localStorage.getItem(`ftg_journey_${iso}`) ?? '{}')
      localStorage.setItem(`ftg_journey_${iso}`, JSON.stringify({
        ...existing,
        interested_opp_ids: Array.from(selectedOpps),
      }))
    } catch {}
  }, [selectedOpps, iso])

  // Mirror checked opportunities → journey store (`selectedProducts`).
  // Dedupe by product slug. The store's `setSelectedProducts` preserves
  // `activeProduct` when it remains in the list, or falls back to the first.
  useEffect(() => {
    if (opps.length === 0) return
    const slugs: string[] = []
    for (const id of selectedOpps) {
      const opp = opps.find((o) => o.id === id)
      const slug = productSlugFromName(opp?.products?.name)
      if (slug) slugs.push(slug)
    }
    // Dedupe while preserving the tick order.
    const unique = Array.from(new Set(slugs))
    setSelectedProductsInStore(unique)
  }, [selectedOpps, opps, setSelectedProductsInStore])

  // Select all visible (filtered) / clear — Premium + Ultimate only
  const selectAllFiltered = () => {
    const all = new Set<string>(selectedOpps)
    // Note: depends on filteredOpps which is computed after loading — we handle empty-case by
    // selecting every opp visible in the DOM; `opps` is already the post-fetch list and
    // `minScore` is applied via filteredOpps below. Resolved via `opps` + minScore here.
    for (const o of opps) {
      if (minScore === 0 || (o.opportunity_score ?? 0) >= minScore) all.add(o.id)
    }
    setSelectedOpps(all)
  }
  const clearAllSelection = () => setSelectedOpps(new Set())

  // Submit the bulk BP debit — called from the modal's onConfirm
  const submitBulkBp = async () => {
    if (bpSubmitting) return
    const ids = Array.from(selectedOpps)
    if (ids.length === 0) return
    setBpSubmitting(true)
    try {
      const res = await fetch('/api/credits/fillthegap/debit-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fillthegap_bp_bulk', opportunity_ids: ids }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean; balance?: number; queued?: number; error?: string; needed?: number
      }
      if (res.status === 402 || j?.error === 'insufficient') {
        const have = typeof j.balance === 'number' ? j.balance : (ftgBalance ?? 0)
        const need = typeof j.needed === 'number' ? j.needed : ids.length
        setFlash({
          kind: 'error',
          msg: `Quota insuffisant — il vous reste ${have} crédit${have > 1 ? 's' : ''}, il en faut ${need}.`,
        })
        setShowBpModal(false)
        return
      }
      if (!res.ok || !j?.ok) {
        setFlash({ kind: 'error', msg: 'Impossible de lancer la génération. Réessayez.' })
        setShowBpModal(false)
        return
      }
      // Success
      if (typeof j.balance === 'number') setFtgBalance(j.balance)
      setFlash({
        kind: 'success',
        msg: `${j.queued ?? ids.length} business plan${(j.queued ?? ids.length) > 1 ? 's' : ''} en cours de génération.`,
      })
      setSelectedOpps(new Set())
      setShowBpModal(false)
      // Soft navigation signal — keep user on the report but add a query param for downstream.
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('bp', 'queued')
        window.history.replaceState({}, '', url.toString())
      } catch { /* no-op */ }
    } catch (err) {
      console.error('[submitBulkBp]', err)
      setFlash({ kind: 'error', msg: 'Erreur réseau, réessayez.' })
      setShowBpModal(false)
    } finally {
      setBpSubmitting(false)
    }
  }

  const scrollToOpps = () => {
    document.getElementById('opportunities-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Only show the checkbox hint for users who can actually tick them.
    if (canBulkBp) {
      setShowCheckboxHint(true)
      setTimeout(() => setShowCheckboxHint(false), 8000)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#07090F] flex flex-col">
      <Topbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )

  if (!country) return (
    <div className="min-h-screen bg-[#07090F] flex flex-col">
      <Topbar />
      <div className="flex-1 flex items-center justify-center text-gray-400">Pays introuvable</div>
    </div>
  )

  const imports = parseImportText(country.top_import_text ?? '', country.total_imports_usd)
  const surplus = (country.trade_balance_usd ?? 0) > 0
  const topOpp = opps[0]
  // Filter by minimum score; full totalGap kept for context.
  const filteredOpps = minScore > 0 ? opps.filter(o => (o.opportunity_score ?? 0) >= minScore) : opps
  const totalGap = opps.reduce((s, o) => s + (o.gap_value_usd ?? 0), 0)
  const filteredGap = filteredOpps.reduce((s, o) => s + (o.gap_value_usd ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#07090F] flex flex-col overflow-x-hidden">
      <Topbar />
      <JourneySidebar iso={iso} currentStep="report" userTier={userTier} />

      <main className="lg:ml-80 px-4 lg:px-8 py-8 space-y-8 overflow-x-hidden">

        {/* Chips bar — active product context, scroll-sticky. */}
        <JourneyChipsBar userTier={userTier} />

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/reports" className="hover:text-gray-300 transition-colors">Rapports</Link>
          <span>/</span>
          <span className="text-gray-300">{country.flag} {country.name_fr}</span>
        </div>

        {/* ── CTA "Voir les opportunités" + jump dropdown + score filter ── */}
        {opps.length > 0 && (
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={scrollToOpps}
                className="group px-6 py-3 bg-gradient-to-r from-[#34D399] to-[#10B981] text-[#07090F] font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all flex items-center gap-2"
              >
                <span className="text-lg">💡</span>
                <span>Voir les {filteredOpps.length} opportunité{filteredOpps.length > 1 ? 's' : ''}{minScore > 0 ? ` (≥ ${minScore}%)` : ''}</span>
                <span className="group-hover:translate-y-0.5 transition-transform">↓</span>
              </button>
              <select
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  document.getElementById(`opp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  e.target.value = ''
                }}
                aria-label="Aller à une opportunité"
                className="px-3 py-3 rounded-xl bg-[#0D1117] border border-[#C9A84C]/30 text-sm text-gray-200 hover:border-[#C9A84C]/60 transition-colors max-w-[260px] truncate cursor-pointer"
              >
                <option value="">🎯 Aller à une opportunité…</option>
                {filteredOpps.map((o, i) => (
                  <option key={o.id} value={o.id}>
                    #{i + 1} · {o.products?.name ?? 'Produit'} — {o.opportunity_score}/100
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <label htmlFor="min-score-filter" className="text-gray-500">Score minimum :</label>
              <select
                id="min-score-filter"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                aria-label="Filtrer par score minimum"
                className="px-3 py-2 rounded-lg bg-[#0D1117] border border-[#C9A84C]/20 text-xs text-gray-200 hover:border-[#C9A84C]/50 transition-colors cursor-pointer"
              >
                <option value={0}>Toutes ({opps.length})</option>
                {Array.from({ length: 20 }, (_, i) => 100 - i * 5).map((s) => {
                  const count = opps.filter(o => (o.opportunity_score ?? 0) >= s).length
                  return (
                    <option key={s} value={s} disabled={count === 0}>
                      ≥ {s}% · {count} opp.{count === 0 ? ' (aucune)' : ''}
                    </option>
                  )
                })}
              </select>
              {minScore > 0 && (
                <button
                  onClick={() => setMinScore(0)}
                  className="text-[#C9A84C] hover:underline text-xs ml-1"
                  aria-label="Réinitialiser le filtre"
                >
                  ✕ réinit.
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-start gap-4 md:gap-6 flex-wrap md:flex-nowrap">
          <div className="text-6xl shrink-0">{country.flag}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white break-words">{country.name_fr}</h1>
              <span className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-gray-400">{country.sub_region}</span>
              {topOpp && (
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#C9A84C22', color: '#C9A84C', border: '1px solid #C9A84C44' }}>
                  Score {topOpp.opportunity_score}/100
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-2 max-w-2xl">
              Analyse d'intelligence commerciale — {country.data_year ?? 2023}. Ce rapport synthétise les flux d'importation,
              les écarts de production et les opportunités d'investissement identifiées pour {country.name_fr}.
            </p>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {[
            { label: 'Importations totales', value: fmt(country.total_imports_usd), icon: '📥', color: '#60A5FA' },
            { label: 'Exportations totales', value: fmt(country.total_exports_usd), icon: '📤', color: '#34D399' },
            { label: 'Balance commerciale', value: fmt(country.trade_balance_usd), icon: surplus ? '📈' : '📉', color: surplus ? '#34D399' : '#EF4444' },
            { label: 'PIB par habitant', value: country.gdp_per_capita ? `$${country.gdp_per_capita?.toLocaleString()}` : fmt(country.gdp_usd ? country.gdp_usd / (country.population ?? 1) : null), icon: '💰', color: '#C9A84C' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.1)] rounded-xl p-2.5 md:p-4 min-w-0">
              <div className="flex items-start gap-1.5 md:gap-2 mb-1 md:mb-2">
                <span className="text-base md:text-lg shrink-0">{kpi.icon}</span>
                <span className="text-[10px] md:text-xs text-gray-500 leading-tight">{kpi.label}</span>
              </div>
              <div className="text-sm md:text-xl font-bold leading-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* ── Executive Summary ── */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center text-sm">📋</span>
            Synthèse exécutive
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed space-y-3">
            <p>
              {country.name_fr} ({country.sub_region}) est une économie de <strong className="text-white">{fmtNum(country.population)} habitants</strong> avec un PIB estimé
              à <strong className="text-white">{fmt(country.gdp_usd)}</strong>.
              {surplus
                ? ` Le pays affiche un excédent commercial de ${fmt(country.trade_balance_usd)}, principalement dû à ses exportations de matières premières.`
                : ` Le pays enregistre un déficit commercial de ${fmt(Math.abs(country.trade_balance_usd ?? 0))}, reflétant sa dépendance aux importations manufacturées.`
              }
            </p>
            {country.top_import_text && (
              <p>
                Les principales importations comprennent : <strong className="text-white">{country.top_import_text}</strong>.
                {country.top_export_text && ` Les exportations sont dominées par : ${country.top_export_text}.`}
              </p>
            )}
            {opps.length > 0 && (
              <p>
                L'analyse identifie <strong className="text-white">{opps.length} opportunité{opps.length > 1 ? 's' : ''} prioritaire{opps.length > 1 ? 's' : ''}</strong> représentant
                un potentiel de marché total de <strong className="text-[#C9A84C]">{fmt(totalGap)}</strong> par an.
                L'opportunité la mieux notée concerne {topOpp?.products?.name ?? 'un produit clé'} avec un score de {topOpp?.opportunity_score}/100.
              </p>
            )}
            {(country.arable_land_pct ?? 0) > 15 && (
              <p>
                Avec <strong className="text-white">{country.arable_land_pct}%</strong> de terres arables,
                le pays présente un potentiel agricole significatif à valoriser pour réduire sa dépendance alimentaire aux importations.
              </p>
            )}
            {(country.renewable_pct ?? 0) > 50 && (
              <p>
                Le mix énergétique est remarquable : <strong className="text-[#34D399]">{country.renewable_pct}% d'électricité renouvelable</strong>{' '}
                (indice coût énergie : {country.energy_cost_index}/100). Cet avantage compétitif réduit structurellement les coûts de production industrielle
                et représente un levier fort pour attirer des industries énergivores (métallurgie, transformation alimentaire, data centers).
              </p>
            )}
            {(country.renewable_pct ?? 100) < 10 && (
              <p>
                Le mix énergétique reste très dépendant des énergies fossiles ({country.renewable_pct ?? 0}% renouvelable),
                ce qui pèse sur les coûts de production (indice : {country.energy_cost_index}/100). La transition énergétique représente
                elle-même une opportunité d'investissement à long terme.
              </p>
            )}
          </div>
        </div>

        {/* ── AI-generated detailed report (from reports table) ── */}
        {reportHtml && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center text-sm">🤖</span>
              Rapport détaillé
              <span className="px-2 py-0.5 bg-[#C9A84C]/10 text-[#C9A84C] text-xs rounded-full ml-2">IA</span>
            </h2>
            <div
              className="text-gray-300 text-sm leading-relaxed break-words overflow-hidden [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-200 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-white [&_a]:text-[#C9A84C] [&_a]:underline [&_table]:w-full [&_table]:overflow-x-auto [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reportHtml) }}
            />
          </div>
        )}

        {/* ── Import Profile ── */}
        {imports.length > 0 && (
          <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#60A5FA]/15 flex items-center justify-center text-sm">📦</span>
              Profil des importations
            </h2>
            <p className="text-xs text-gray-500 mb-5">Estimation de la répartition · {country.data_year ?? 2023}</p>

            <div className="space-y-3">
              {imports.map((imp, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300 capitalize">{imp.product}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{fmt(imp.value, 0)}</span>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: imp.color }}>{imp.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${imp.pct}%`, background: imp.color, opacity: 0.85 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {country.top_export_text && (
              <div className="mt-5 pt-4 border-t border-white/5 text-xs text-gray-500">
                Exports clés : <span className="text-gray-400">{country.top_export_text}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Opportunities ── */}
        {opps.length > 0 && (
          <div id="opportunities-section" className="scroll-mt-20">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 flex-wrap">
              <span className="w-7 h-7 rounded-lg bg-[#34D399]/15 flex items-center justify-center text-sm">💡</span>
              Opportunités identifiées
              {minScore > 0 && (
                <span className="text-xs text-[#C9A84C] font-normal px-2 py-0.5 bg-[#C9A84C]/10 rounded-full border border-[#C9A84C]/20">
                  score ≥ {minScore}% · {filteredOpps.length}/{opps.length}
                </span>
              )}
              <span className="ml-auto text-sm font-normal text-gray-500">
                Potentiel{minScore > 0 ? ' filtré' : ' total'} : <span className="text-[#C9A84C] font-bold">{fmt(minScore > 0 ? filteredGap : totalGap)}</span>/an
              </span>
            </h2>

            {/* Bulk select controls — Premium / Ultimate only */}
            {canBulkBp && filteredOpps.length > 0 && (
              <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] font-semibold hover:bg-[#C9A84C]/20 transition-colors"
                >
                  ☑ Tout sélectionner{minScore > 0 ? ' (filtrées)' : ''}
                </button>
                <button
                  type="button"
                  onClick={clearAllSelection}
                  disabled={selectedOpps.size === 0}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ☐ Tout désélectionner
                </button>
                {ftgBalance !== null && (
                  <span className="text-gray-500 ml-auto">
                    Crédits Fill the Gap : <span className="text-white font-semibold">{ftgBalance}</span>
                    {ftgGrant > 0 && <span className="text-gray-600"> / {ftgGrant}</span>}
                  </span>
                )}
              </div>
            )}

            {filteredOpps.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-500 bg-[#0D1117] rounded-2xl border border-white/5">
                Aucune opportunité ≥ {minScore}%.{' '}
                <button onClick={() => setMinScore(0)} className="text-[#C9A84C] hover:underline">Réinitialiser le filtre</button>
              </div>
            )}

            <div className="space-y-5">
              {filteredOpps.map((opp, idx) => {
                const metrics = getBusinessMetrics(opp, country.energy_cost_index)
                const riskColor = RISK_COLOR[metrics.risk] ?? '#6B7280'
                const catColor = opp.products?.category === 'energy' ? '#F97316'
                  : opp.products?.category === 'agriculture' ? '#34D399'
                  : opp.products?.category === 'materials' ? '#A78BFA' : '#60A5FA'
                const isSelected = selectedOpps.has(opp.id)

                return (
                  <div key={opp.id}
                    id={`opp-${opp.id}`}
                    className={`bg-[#0D1117] rounded-2xl overflow-hidden transition-all scroll-mt-24 ${canBulkBp ? 'cursor-pointer' : ''}`}
                    style={{
                      border: isSelected && canBulkBp
                        ? '2px solid rgba(201,168,76,0.6)'
                        : '1px solid rgba(201,168,76,0.15)',
                      boxShadow: isSelected && canBulkBp ? '0 0 20px rgba(201,168,76,0.1)' : 'none',
                    }}
                    onClick={canBulkBp ? () => toggleOpp(opp.id) : undefined}
                  >

                    {/* Header */}
                    <div className="flex items-start gap-4 p-5 pb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: catColor + '20' }}>
                        {CAT_ICON[opp.products?.category ?? ''] ?? '📦'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white">{opp.products?.name ?? 'Produit'}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={{ background: catColor + '20', color: catColor }}>
                            {opp.products?.category}
                          </span>
                          <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-gray-400">
                            {TYPE_LABEL[opp.type] ?? opp.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <span className="text-xs text-gray-500">Gap de marché : <span className="text-[#C9A84C] font-bold">{fmt(opp.gap_value_usd)}/an</span></span>
                          <span className="text-xs text-gray-500">Score : <span className="font-bold text-white">{opp.opportunity_score}/100</span></span>
                        </div>
                      </div>
                      {/* Checkbox + hint popup (first opportunity only) — Premium/Ultimate only */}
                      <div className="relative shrink-0" hidden={!canBulkBp}>
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner l'opportunité ${opp.products?.name ?? ''}`}
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleOpp(opp.id)}
                          className="sr-only peer"
                          tabIndex={canBulkBp ? 0 : -1}
                        />
                        <div
                          onClick={canBulkBp ? (e) => { e.stopPropagation(); toggleOpp(opp.id) } : undefined}
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${canBulkBp ? 'cursor-pointer' : 'cursor-default'} ${showCheckboxHint && idx === 0 && canBulkBp ? 'ring-4 ring-amber-400/50 animate-pulse' : ''}`}
                          style={{
                            background: isSelected ? '#C9A84C' : 'rgba(255,255,255,0.05)',
                            border: isSelected ? '2px solid #C9A84C' : '2px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          {isSelected && <span className="text-[#07090F] text-xs font-bold">✓</span>}
                        </div>
                        {showCheckboxHint && idx === 0 && canBulkBp && (
                          <>
                            {/* Mobile: below checkbox, arrow up, wraps to 2 lines if needed */}
                            <div className="md:hidden absolute top-full right-0 mt-2 z-20 animate-in fade-in slide-in-from-top-1 pointer-events-none">
                              <div className="relative bg-amber-500 text-gray-950 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg w-max max-w-[220px] leading-tight">
                                👆 Cochez si cette opportunité vous intéresse
                                <div className="absolute right-2 top-[-6px] w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] border-b-amber-500" />
                              </div>
                            </div>
                            {/* Desktop: to the left of the checkbox, arrow right */}
                            <div className="hidden md:block absolute right-8 top-1/2 -translate-y-1/2 z-20 animate-in fade-in slide-in-from-right-2 pointer-events-none">
                              <div className="relative bg-amber-500 text-gray-950 text-xs font-bold px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                👆 Cochez si cette opportunité vous intéresse
                                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-l-[6px] border-l-amber-500" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {/* Score ring */}
                      <div className="shrink-0 relative w-14 h-14">
                        <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3"/>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#C9A84C" strokeWidth="3"
                            strokeDasharray={`${opp.opportunity_score} ${100 - opp.opportunity_score}`}
                            strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#C9A84C]">
                          {opp.opportunity_score}
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    {opp.summary && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-gray-300 leading-relaxed">{opp.summary}</p>
                      </div>
                    )}

                    {/* Business metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-t border-white/5">
                      {[
                        { label: 'Investissement estimé', value: metrics.investment, icon: '💼' },
                        { label: 'Time to Market', value: metrics.ttm, icon: '⏱️' },
                        { label: 'Marge brute estimée', value: metrics.margin, icon: '📈' },
                        { label: 'Niveau de risque', value: metrics.risk, icon: '⚠️', color: riskColor },
                      ].map(m => (
                        <div key={m.label} className="bg-[#0D1117] p-4">
                          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">{m.icon} {m.label}</div>
                          <div className="text-sm font-bold" style={{ color: m.color ?? 'white' }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Energy advantage badge */}
                    {metrics.energyAdvantage && (
                      <div className="px-5 py-2.5 border-t border-white/5 bg-[#34D399]/5 flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <span className="text-xs text-[#34D399] font-semibold">{metrics.energyAdvantage}</span>
                        {country.renewable_pct != null && (
                          <span className="text-xs text-gray-500 ml-1">· {country.renewable_pct}% d'électricité renouvelable</span>
                        )}
                      </div>
                    )}

                    {/* Context factors */}
                    <div className="px-5 py-3 border-t border-white/5 flex flex-wrap gap-4 text-xs text-gray-500">
                      {opp.land_availability && (
                        <span>🌱 Terres disponibles : <span className="text-gray-300 capitalize">{opp.land_availability === 'high' ? 'Élevé' : opp.land_availability === 'medium' ? 'Moyen' : 'Faible'}</span></span>
                      )}
                      {opp.labor_cost_index != null && (
                        <span>👷 Indice coût main-d'œuvre : <span className="text-gray-300">{opp.labor_cost_index}/100</span></span>
                      )}
                      {opp.infrastructure_score != null && (
                        <span>🏗️ Infrastructure : <span className="text-gray-300">{opp.infrastructure_score}/10</span></span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Country Context ── */}
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#A78BFA]/15 flex items-center justify-center text-sm">🌍</span>
            Contexte pays
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Population', value: fmtNum(country.population), icon: '👥' },
              { label: 'PIB total', value: fmt(country.gdp_usd), icon: '💰' },
              { label: 'Région', value: country.sub_region, icon: '🗺️' },
              { label: 'Terres arables', value: country.arable_land_pct ? `${country.arable_land_pct}%` : '—', icon: '🌾' },
              { label: 'Énergie renouvelable', value: country.renewable_pct != null ? `${country.renewable_pct}%` : '—', icon: '⚡' },
              { label: 'Coût énergie (indice)', value: country.energy_cost_index != null ? `${country.energy_cost_index}/100` : '—', icon: '🔋' },
              { label: 'Année des données', value: String(country.data_year ?? '—'), icon: '📅' },
              { label: 'Opportunités', value: `${opps.length} identifiée${opps.length > 1 ? 's' : ''}`, icon: '💡' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 bg-white/3 rounded-xl p-3">
                <span className="text-lg">{f.icon}</span>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{f.label}</div>
                  <div className="font-semibold text-white text-sm">{f.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>


        <div className="text-center text-xs text-gray-600 pb-4">
          Rapport Feel The Gap · {country.data_year ?? 2023}
        </div>
      </main>

      {/* ── Sticky bottom panel ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          transform: selectedOpps.size > 0 ? 'translateY(0)' : 'translateY(110%)',
          background: 'rgba(7,9,15,0.92)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(201,168,76,0.25)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          {!showModelPanel ? (
            /* Compact bar */
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: '#C9A84C', color: '#07090F' }}>
                  {selectedOpps.size}
                </div>
                <span className="text-sm text-white font-semibold">
                  opportunité{selectedOpps.size > 1 ? 's' : ''} sélectionnée{selectedOpps.size > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-500 hidden md:inline">
                  · {Array.from(selectedOpps).map(id => opps.find(o => o.id === id)?.products?.name).filter(Boolean).join(', ')}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedOpps(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Effacer
                </button>
                {canBulkBp && (
                  <button
                    onClick={() => setShowBpModal(true)}
                    disabled={bpSubmitting || selectedOpps.size === 0}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#34D399,#10B981)', color: '#07090F' }}
                    title={`Générer ${selectedOpps.size} business plan(s) — 1 crédit par opportunité`}
                  >
                    ⚡ Générer les business plans ({selectedOpps.size})
                  </button>
                )}
                <button
                  onClick={() => setShowModelPanel(true)}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F' }}
                >
                  ✨ Business Plan →
                </button>
              </div>
            </div>
          ) : (
            /* Model selection panel */
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold text-white">Sous quelle forme souhaitez-vous commercialiser&nbsp;?</div>
                <button onClick={() => setShowModelPanel(false)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
              </div>
              <div className="text-xs text-gray-500 mb-3">Cochez au moins une méthode pour générer votre business plan.</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {MODELS.map(m => {
                  const active = selectedModels.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModel(m.id)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1.5px solid rgba(201,168,76,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ background: active ? '#C9A84C20' : '#ffffff08' }}>
                        {m.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: active ? '#E8C97A' : '#d1d5db' }}>{m.label}</div>
                        <div className="text-xs text-gray-500">{m.desc}</div>
                      </div>
                      <div className="ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center"
                        style={{ background: active ? '#C9A84C' : '#ffffff10', border: active ? 'none' : '1px solid #ffffff20' }}>
                        {active && <span className="text-[#07090F] text-xs font-bold">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {selectedModels.size === 0
                    ? 'Sélectionnez au moins une méthode'
                    : `${selectedModels.size} méthode${selectedModels.size > 1 ? 's' : ''} · ${selectedOpps.size} opportunité${selectedOpps.size > 1 ? 's' : ''}`}
                </span>
                <button
                  onClick={goToPlan}
                  disabled={selectedModels.size === 0}
                  title={selectedModels.size === 0 ? 'Cochez au moins une méthode de commercialisation' : undefined}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#07090F', opacity: selectedModels.size === 0 ? 0.4 : 1 }}
                >
                  ✨ Générer le Business Plan →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer when panel is visible */}
      {selectedOpps.size > 0 && <div className="h-20" />}

      {/* ── Flash message (toast-lite) ── */}
      {flash && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 z-[110] max-w-sm rounded-xl px-4 py-3 shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2"
          style={{
            background: flash.kind === 'success' ? '#065F46' : flash.kind === 'error' ? '#7F1D1D' : '#1E3A8A',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-base">
              {flash.kind === 'success' ? '✅' : flash.kind === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="flex-1">{flash.msg}</span>
            <button
              onClick={() => setFlash(null)}
              aria-label="Fermer"
              className="ml-1 opacity-70 hover:opacity-100"
            >✕</button>
          </div>
        </div>
      )}

      {/* ── Bulk BP confirmation modal (Premium / Ultimate) ── */}
      {canBulkBp && (
        <FillTheGapCreditModal
          open={showBpModal}
          action="bp_bulk"
          quantity={selectedOpps.size}
          balance={ftgBalance ?? 0}
          monthlyGrant={ftgGrant}
          periodEnd={ftgPeriodEnd}
          tier={userTier === 'ultimate' ? 'ultimate' : 'premium'}
          onClose={() => { if (!bpSubmitting) setShowBpModal(false) }}
          onConfirm={submitBulkBp}
        />
      )}
    </div>
  )
}
