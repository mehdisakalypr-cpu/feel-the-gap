'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DOMPurify from 'dompurify'
import Topbar from '@/components/Topbar'
import PaywallGate from '@/components/PaywallGate'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Country {
  id: string; name: string; name_fr: string; flag: string; region: string
  sub_region: string; population: number | null; gdp_usd: number | null
  total_imports_usd: number | null; total_exports_usd: number | null
  trade_balance_usd: number | null; top_import_category: string | null; data_year: number | null
  arable_land_pct: number | null; labor_cost_index: number | null; infrastructure_score: number | null
  top_import_text: string | null; top_export_text: string | null
}

interface Opportunity {
  id: string; type: string; opportunity_score: number; gap_value_usd: number | null
  summary: string | null; land_availability: string | null
  products: { name: string; category: string } | null
}

interface TopImport {
  name: string; category: string; value_usd: number; quantity: number | null; source: string; year: number
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null) {
  if (!v) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(1) + 'T'
  if (a >= 1e9)  return s + '$' + (a / 1e9).toFixed(1) + 'B'
  if (a >= 1e6)  return s + '$' + (a / 1e6).toFixed(0) + 'M'
  return s + '$' + a.toLocaleString()
}

const TYPE_LABEL: Record<string, string> = { direct_trade: 'Direct Trade', local_production: 'Local Production' }
const CATEGORY_ICON: Record<string, string> = { agriculture: '🌾', energy: '⚡', materials: '🪨', manufactured: '🏭', resources: '💧' }
// Ranks support both legacy tiers (free/basic/standard) and current DB tiers (explorer/data/strategy).
const TIER_RANK: Record<string, number> = {
  free: 0,
  explorer: 0,
  basic: 1,
  data: 1,
  standard: 2,
  strategy: 2,
  premium: 3,
  enterprise: 4,
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

function AIChat({ country }: { country: Country }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const userMsg: ChatMsg = { role: 'user', content: input }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setInput('')
    setStreaming(true)
    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs, context: { country: country.name_fr, iso: country.id, product: country.top_import_category ?? 'général', category: country.top_import_category ?? 'général', strategy: 'trade' } }),
      })
      if (!res.ok) throw new Error('API error')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let aiText = ''
      setMsgs(m => [...m, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try { const d = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content; if (d) { aiText += d; setMsgs(m => [...m.slice(0, -1), { role: 'assistant', content: aiText }]) } } catch {}
        }
      }
    } catch { setMsgs(m => [...m, { role: 'assistant', content: t('country.ai_unavailable') }]) }
    setStreaming(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl text-[#C9A84C] font-semibold text-sm hover:bg-[#C9A84C]/20 transition-colors flex items-center justify-center gap-2">
      <span>✨</span> {t('country.ask_ai')}
    </button>
  )

  return (
    <div className="border border-[#C9A84C]/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#C9A84C]/10 border-b border-[#C9A84C]/20">
        <span className="text-xs font-semibold text-[#C9A84C]">✨ {t('country.ai_title')} — {country.name_fr}</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
      </div>
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-[#07090F]">
        {msgs.length === 0 && <p className="text-xs text-gray-500">{t('country.ai_placeholder_country', { country: country.name_fr })}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${m.role === 'user' ? 'bg-[#C9A84C] text-[#07090F] font-medium' : 'bg-[#111827] text-gray-300'}`}>
              {m.content || <span className="animate-pulse">▋</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-white/5 bg-[#0D1117]">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('country.ai_placeholder')} disabled={streaming}
          className="flex-1 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C] transition-colors" />
        <button type="submit" disabled={streaming || !input.trim()} className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-lg text-sm disabled:opacity-40 hover:bg-[#E8C97A] transition-colors">→</button>
      </form>
    </div>
  )
}

// ── Studies Tab ────────────────────────────────────────────────────────────────

const STUDY_PARTS = [
  { part: 1, title_fr: 'Ressources et marché local', title_en: 'Resources & Local Market', desc_fr: 'État des ressources, denrées produites et importées, infrastructure commerciale.', desc_en: 'Country resources, goods produced and imported, trade infrastructure.', tier: 'free', tierLabel: 'Explorer (gratuit)', color: '#6B7280', icon: '🌍' },
  { part: 2, title_fr: 'Analyse business & distribution', title_en: 'Business Analysis & Distribution', desc_fr: 'Produits en tension, modes de distribution (import, production locale, formation).', desc_en: 'High-tension products, distribution modes (import, local production, training).', tier: 'basic', tierLabel: 'Data (29 €/mois)', color: '#60A5FA', icon: '📊' },
  { part: 3, title_fr: 'Acteurs locaux du marché', title_en: 'Local Market Actors', desc_fr: 'Importateurs, transformateurs, distributeurs classés par CA et méthodes d\'achat.', desc_en: 'Importers, processors, distributors ranked by revenue and procurement.', tier: 'standard', tierLabel: 'Strategy (99 €/mois)', color: '#C9A84C', icon: '🏭' },
]

function StudiesTab({ iso, userTier, country, lang }: { iso: string; userTier: string; country: Country; lang: string }) {
  const [studies, setStudies] = useState<Record<number, string>>({})
  const [loadingPart, setLoadingPart] = useState<number | null>(null)
  const [expandedPart, setExpandedPart] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/studies/${iso.toUpperCase()}`).then(r => r.json()).then(d => {
      const map: Record<number, string> = {}
      for (const s of (d.studies ?? [])) map[s.part] = s.content_html
      setStudies(map)
    }).catch(() => {})
  }, [iso])

  async function generatePart(part: number) {
    setLoadingPart(part); setError(null)
    try {
      const res = await fetch(`/api/studies/${iso.toUpperCase()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ part }) })
      const d = await res.json()
      if (res.ok && d.content) { setStudies(prev => ({ ...prev, [part]: d.content })); setExpandedPart(part) }
      else setError(d.error || 'Erreur de génération')
    } catch { setError('Erreur réseau') }
    setLoadingPart(null)
  }

  const userRank = TIER_RANK[userTier] ?? 0

  return (
    <div className="space-y-4">
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-5">
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <span>📑</span> {lang === 'fr' ? `Étude de marché — ${country.name_fr}` : `Market Study — ${country.name_fr}`}
        </h2>
        <p className="text-sm text-gray-400">{lang === 'fr' ? 'Synthèse complète en 3 parties générée par IA à partir des données de la plateforme.' : 'Complete 3-part AI synthesis from platform data.'}</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">{error}</div>}

      {STUDY_PARTS.map(sp => {
        const hasContent = !!studies[sp.part]
        const isExpanded = expandedPart === sp.part
        const isLoading = loadingPart === sp.part
        const hasAccess = userRank >= (TIER_RANK[sp.tier] ?? 0)
        const title = lang === 'fr' ? sp.title_fr : sp.title_en
        const desc = lang === 'fr' ? sp.desc_fr : sp.desc_en

        return (
          <div key={sp.part} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[.02] transition-colors"
              onClick={() => hasContent && setExpandedPart(isExpanded ? null : sp.part)}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: sp.color + '15' }}>{sp.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: sp.color + '20', color: sp.color }}>Partie {sp.part}</span>
                  <h3 className="font-semibold text-white text-sm">{title}</h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasContent && <span className="px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] text-[10px] font-bold rounded-full">{lang === 'fr' ? 'Générée' : 'Generated'}</span>}
                {!hasAccess && !hasContent && <span className="px-2 py-0.5 bg-white/5 text-gray-500 text-[10px] font-bold rounded-full">{sp.tierLabel}</span>}
                {hasContent && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>}
              </div>
            </div>

            {!hasContent && (
              <div className="px-5 pb-4">
                {hasAccess ? (
                  <button onClick={() => generatePart(sp.part)} disabled={isLoading}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: sp.color + '15', color: sp.color, border: `1px solid ${sp.color}30` }}>
                    {isLoading ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />{lang === 'fr' ? 'Génération en cours...' : 'Generating...'}</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>{lang === 'fr' ? `Générer la partie ${sp.part}` : `Generate part ${sp.part}`}</>}
                  </button>
                ) : (
                  <Link href="/pricing" className="block w-full py-3 rounded-xl font-semibold text-sm text-center transition-colors bg-white/5 text-gray-400 border border-white/10 hover:border-white/20">
                    <div className="flex items-center justify-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      {lang === 'fr' ? `Plan ${sp.tierLabel} requis` : `${sp.tierLabel} plan required`}
                    </div>
                  </Link>
                )}
              </div>
            )}

            {hasContent && isExpanded && (
              <div className="border-t border-white/5 px-5 py-6">
                <div className="text-gray-300 text-sm leading-relaxed break-words overflow-hidden [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-200 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:text-white [&_table]:w-full [&_table]:my-4 [&_table]:text-xs [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:bg-white/5 [&_th]:text-gray-400 [&_th]:font-semibold [&_td]:px-3 [&_td]:py-2 [&_td]:border-t [&_td]:border-white/5"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(studies[sp.part]) }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'opportunities' | 'studies'
const VALID_TABS: readonly TabId[] = ['overview', 'opportunities', 'studies'] as const

function CountryPageInner() {
  const { iso } = useParams<{ iso: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang } = useLang()
  const [country, setCountry] = useState<Country | null>(null)
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [totalOpps, setTotalOpps] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [userTier, setUserTier] = useState<string>('free')
  const [topImports, setTopImports] = useState<TopImport[]>([])
  const initialTab = ((): TabId => {
    const t = searchParams.get('tab')
    return t && (VALID_TABS as readonly string[]).includes(t) ? (t as TabId) : 'overview'
  })()
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  useEffect(() => {
    if (!iso) return
    const sb = supabase
    Promise.all([
      sb.from('countries').select('*').eq('id', iso.toUpperCase()).single(),
      sb.from('opportunities').select('id, type, opportunity_score, gap_value_usd, summary, land_availability, products(name, category)').eq('country_iso', iso.toUpperCase()).order('opportunity_score', { ascending: false }).limit(10),
      sb.from('opportunities').select('*', { count: 'exact', head: true }).eq('country_iso', iso.toUpperCase()),
      sb.auth.getUser(),
    ]).then(async ([{ data: c }, { data: o }, { count: total }, { data: authData }]) => {
      if (!c) { router.push('/reports'); return }
      setCountry(c as Country)
      setOpps((o ?? []).map((x: any) => ({ ...x, products: Array.isArray(x.products) ? x.products[0] ?? null : x.products })) as Opportunity[])
      setTotalOpps(total ?? 0)
      if (authData.user) {
        const { data: profile } = await sb.from('profiles').select('tier').eq('id', authData.user.id).single()
        setUserTier(profile?.tier ?? 'free')
      }
      setLoading(false)
    })
    fetch(`/api/countries/${iso.toUpperCase()}/imports`).then(r => r.json()).then(d => { if (d.imports?.length) setTopImports(d.imports) }).catch(() => {})
  }, [iso, router])

  if (loading) return <div className="min-h-screen bg-[#07090F] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>
  if (!country) return null

  const balance = country.trade_balance_usd ?? 0

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      <Topbar />
      <div className="w-full">
      <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6 overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
          <span className="text-5xl shrink-0">{country.flag}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1"><Link href="/reports" className="text-xs text-gray-500 hover:text-gray-300">{t('country.back_reports')}</Link></div>
            <h1 className="text-2xl md:text-3xl font-bold text-white break-words">{country.name_fr}</h1>
            <p className="text-gray-400 text-sm">{country.sub_region} · {country.region}</p>
          </div>
          <Link href="/map" className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0">{t('country.view_on_map')}</Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {[
            { label: t('country.imports'), value: fmt(country.total_imports_usd), color: '#60A5FA' },
            { label: t('country.exports'), value: fmt(country.total_exports_usd), color: '#34D399' },
            { label: t('country.balance'), value: fmt(country.trade_balance_usd), color: balance < 0 ? '#F87171' : '#34D399' },
            { label: t('country.gdp'), value: fmt(country.gdp_usd), color: '#C9A84C' },
          ].map(k => (
            <div key={k.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-2.5 md:p-4 min-w-0">
              <div className="text-[10px] md:text-xs text-gray-500 mb-0.5 md:mb-1 leading-tight">{k.label}</div>
              <div className="text-sm md:text-xl font-bold leading-tight" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0D1117] rounded-xl p-1 border border-white/5">
          {[
            { id: 'overview' as const, label: lang === 'fr' ? 'Aperçu' : 'Overview', icon: '📊' },
            { id: 'opportunities' as const, label: lang === 'fr' ? 'Opportunités' : 'Opportunities', icon: '💡', count: totalOpps },
            { id: 'studies' as const, label: lang === 'fr' ? 'Études' : 'Studies', icon: '📑' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
              <span>{tab.icon}</span>{tab.label}
              {'count' in tab && tab.count !== undefined && tab.count > 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C]">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* ═══ TAB: Aperçu ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('country.population'), value: country.population ? (country.population / 1e6).toFixed(1) + 'M' : '—' },
                { label: t('country.data_year'), value: country.data_year?.toString() ?? '—' },
                { label: t('country.top_category'), value: country.top_import_category ? (CATEGORY_ICON[country.top_import_category] ?? '') + ' ' + country.top_import_category : '—' },
              ].map(k => (
                <div key={k.label} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl px-4 py-3">
                  <div className="text-xs text-gray-500 mb-0.5">{k.label}</div>
                  <div className="text-sm font-semibold text-white capitalize">{k.value}</div>
                </div>
              ))}
            </div>

            {topImports.length === 0 && country.top_import_text && (
              <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3"><span>📦</span><h2 className="font-bold text-white">{lang === 'fr' ? 'Principaux produits importés' : 'Top imported products'}</h2></div>
                <p className="text-sm text-gray-300 leading-relaxed">{country.top_import_text}</p>
                {country.top_export_text && <div className="mt-3 pt-3 border-t border-white/5"><div className="flex items-center gap-2 mb-1.5"><span>🚢</span><span className="text-xs font-semibold text-gray-400">{lang === 'fr' ? 'Principaux produits exportés' : 'Top exported products'}</span></div><p className="text-sm text-gray-300 leading-relaxed">{country.top_export_text}</p></div>}
              </div>
            )}

            {topImports.length > 0 && (
              <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <h2 className="font-bold text-white flex items-center gap-2"><span>📦</span>{lang === 'fr' ? 'Principaux produits importés' : 'Top imported products'}</h2>
                  <span className="text-xs text-gray-500">{topImports.length} produits</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5"><th className="text-left px-5 py-2.5 text-[10px] text-gray-500 uppercase font-semibold w-8">#</th><th className="text-left px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Produit</th><th className="text-right px-5 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Valeur</th><th className="text-right px-5 py-2.5 text-[10px] text-gray-500 uppercase font-semibold hidden md:table-cell">Part</th></tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const totalVal = topImports.reduce((s, i) => s + (i.value_usd ?? 0), 0)
                        return topImports.map((imp, idx) => {
                          const pct = totalVal > 0 ? Math.round((imp.value_usd / totalVal) * 100) : 0
                          const catColor = imp.category === 'energy' ? '#F97316' : imp.category === 'agriculture' ? '#34D399' : imp.category === 'materials' ? '#A78BFA' : '#60A5FA'
                          return (
                            <tr key={idx} className="hover:bg-white/3"><td className="px-5 py-3 text-gray-600 font-mono text-xs">{idx + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className="text-base">{CATEGORY_ICON[imp.category] ?? '📦'}</span><div><div className="text-white text-sm font-medium">{imp.name}</div><span className="text-[10px] capitalize px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ background: catColor + '20', color: catColor }}>{imp.category}</span></div></div></td><td className="px-5 py-3 text-right"><span className="font-bold text-[#C9A84C]">{fmt(imp.value_usd)}</span></td><td className="px-5 py-3 text-right hidden md:table-cell"><div className="flex items-center justify-end gap-2"><div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 3)}%`, background: catColor }} /></div><span className="text-xs text-gray-500 w-8 text-right">{pct}%</span></div></td></tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">{t('country.investment_context')}</h3>
              <div className="space-y-2">
                {[
                  { label: t('country.arable_land'), value: country.arable_land_pct != null ? country.arable_land_pct + '%' : '—' },
                  { label: t('country.labor_cost'), value: country.labor_cost_index != null ? country.labor_cost_index + ' / 100' : '—' },
                  { label: t('country.infrastructure'), value: country.infrastructure_score != null ? country.infrastructure_score + ' / 10' : '—' },
                ].map(r => <div key={r.label} className="flex justify-between text-sm"><span className="text-gray-500">{r.label}</span><span className="text-white font-medium">{r.value}</span></div>)}
              </div>
            </div>

          </div>
        )}

        {/* ═══ TAB: Opportunités ═══ */}
        {activeTab === 'opportunities' && (
          <div className="space-y-6">
            {opps.length > 0 && (
              <Link href={`/reports/${iso}`} className="group relative block w-full rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#C9A84C]/20 via-[#C9A84C]/10 to-[#C9A84C]/20 animate-pulse" />
                <div className="relative flex items-center justify-between px-6 py-5 border border-[#C9A84C]/40 rounded-2xl bg-[#0D1117]/90 hover:border-[#C9A84C] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="relative"><div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div><div className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#C9A84C] rounded-full flex items-center justify-center"><span className="text-[8px] font-bold text-[#07090F]">{totalOpps}</span></div></div>
                    <div><div className="text-white font-bold text-base group-hover:text-[#C9A84C] transition-colors">{t('country.see_opportunities', { count: String(totalOpps) })}</div><div className="text-xs text-gray-400">{t('country.see_opportunities_desc', { country: country.name_fr })}</div></div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#C9A84C] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07090F" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
                </div>
              </Link>
            )}

            {opps.length === 0 ? (
              <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-8 text-center"><p className="text-gray-500 text-sm">{t('country.no_opportunities')}</p></div>
            ) : (
              <div className="space-y-3">
                {opps.map(opp => (
                  <div key={opp.id} className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl p-4 hover:border-[#C9A84C]/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div><span className="text-sm font-semibold text-white">{opp.products ? (CATEGORY_ICON[opp.products.category] ?? '') + ' ' + opp.products.name : 'Product'}</span><span className="ml-2 text-xs text-gray-500 capitalize">{TYPE_LABEL[opp.type] ?? opp.type}</span></div>
                      <div className="text-right"><div className="font-bold text-[#C9A84C]">{opp.opportunity_score}</div><div className="text-[10px] text-gray-500">score</div></div>
                    </div>
                    {opp.gap_value_usd && <div className="text-xs text-emerald-400 mb-1.5">{t('country.gap_label')} {fmt(opp.gap_value_usd)}/yr</div>}
                    {opp.summary && <p className="text-xs text-gray-400 line-clamp-2">{opp.summary}</p>}
                    <div className="mt-2 flex gap-3">
                      <Link href={`/reports/${iso}`} className="text-[10px] text-[#34D399] hover:underline">{lang === 'fr' ? 'Rapport détaillé →' : 'Detailed report →'}</Link>
                      <Link href={`/country/${iso}/plan`} className="text-[10px] text-[#C9A84C] hover:underline">{t('country.full_plan')}</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gradient-to-r from-[#C9A84C]/10 to-transparent border border-[#C9A84C]/25 rounded-xl p-4">
              <div className="font-semibold text-white text-sm mb-1">{t('country.full_report', { country: country.name_fr })}</div>
              <div className="text-xs text-gray-400 mb-3">{t('country.full_report_desc')}</div>
              <Link href={`/country/${iso}/plan`} className="block w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm text-center rounded-xl hover:bg-[#E8C97A] transition-colors">
                {t('country.full_plan')}
              </Link>
            </div>
          </div>
        )}

        {/* ═══ TAB: Études ═══ */}
        {activeTab === 'studies' && <StudiesTab iso={iso!} userTier={userTier} country={country} lang={lang} />}
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 z-40 bg-[#07090F]/95 backdrop-blur-md border-t border-[rgba(201,168,76,.2)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0"><span className="text-2xl shrink-0">{country.flag}</span><div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{country.name_fr}</div><div className="text-[11px] text-gray-500">{totalOpps} {t('country.opportunities').toLowerCase()}</div></div></div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/reports/${iso}`} className="px-4 py-2 bg-[#34D399]/15 text-[#34D399] font-semibold text-xs rounded-xl border border-[#34D399]/30 hover:bg-[#34D399]/25 transition-colors whitespace-nowrap">{lang === 'fr' ? 'Opportunités' : 'Opportunities'}</Link>
            <Link href={`/country/${iso}/enriched-plan`} className="px-4 py-2 bg-purple-500/15 text-purple-300 font-semibold text-xs rounded-xl border border-purple-500/30 hover:bg-purple-500/25 transition-colors whitespace-nowrap">{lang === 'fr' ? '3 scénarios ★' : '3 scenarios ★'}</Link>
            <Link href={`/country/${iso}/plan`} className="px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-xs rounded-xl hover:bg-[#E8C97A] transition-colors whitespace-nowrap">Business plan →</Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default function CountryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090F] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>}>
      <CountryPageInner />
    </Suspense>
  )
}
