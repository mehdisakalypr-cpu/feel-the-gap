'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import PaywallGate from '@/components/PaywallGate'
import { supabase, createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Country {
  id: string; name: string; name_fr: string; flag: string; region: string
  sub_region: string; population: number | null; gdp_usd: number | null
  total_imports_usd: number | null; total_exports_usd: number | null
  trade_balance_usd: number | null; top_import_category: string | null; data_year: number | null
}

interface Opportunity {
  id: string; type: string; opportunity_score: number; gap_value_usd: number | null
  summary: string | null
  products: { name: string; category: string } | null
}

interface Buyer {
  name: string
  type: 'manufacturer' | 'distributor' | 'wholesaler' | 'retailer' | 'cooperative' | 'importer' | 'processor' | 'trader'
  sector: string
  description: string
  city: string
  volume?: string
  products: string[]
  website?: string | null
  email?: string | null
  phone?: string | null
}

interface BuyersGroup {
  resource: string
  chain: string
  buyers: Buyer[]
}

interface PlanData {
  executive_summary: string
  market_context: string
  market_size_eur: number
  growth_rate_pct: number
  competitors: { name: string; share_pct: number; strength: string }[]
  entry_strategy: string
  entry_mode: string
  capex_eur: number
  opex_monthly_eur: number
  revenue_12m_eur: number
  revenue_36m_eur: number
  roi_12m_pct: number
  roi_36m_pct: number
  breakeven_months: number
  margin_pct: number
  actions: { period: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }[]
  risks: { title: string; impact: 'high' | 'medium' | 'low'; probability: 'high' | 'medium' | 'low'; mitigation: string }[]
  key_resources: string[]
  image_keywords: string[]
  product_focus: string
  buyers_by_resource?: BuyersGroup[]
}

// ── Image mapping ──────────────────────────────────────────────────────────────

const CATEGORY_IMAGES: Record<string, string> = {
  agriculture: 'photo-1574943320219-553eb213f72d',  // wheat field
  energy:      'photo-1466611653911-95081537e5b7',  // solar
  materials:   'photo-1611974789855-9c2a0a7236a3',  // metals
  manufactured:'photo-1565043589221-1a6fd9ae45c7',  // factory
  resources:   'photo-1441974231531-c6227db76b6e',  // nature/water
  default:     'photo-1526304640581-d334cdbbf45e',  // globe trade
}

function categoryImage(cat: string | null): string {
  const id = CATEGORY_IMAGES[cat ?? 'default'] ?? CATEGORY_IMAGES.default
  return `https://images.unsplash.com/${id}?w=1200&h=400&fit=crop&q=80`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number): string {
  if (v >= 1e9) return '€' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return '€' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '€' + (v / 1e3).toFixed(0) + 'K'
  return '€' + v.toFixed(0)
}

function fmtUsd(v: number | null): string {
  if (!v) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(1) + 'T'
  if (a >= 1e9)  return s + '$' + (a / 1e9).toFixed(1) + 'B'
  if (a >= 1e6)  return s + '$' + (a / 1e6).toFixed(0) + 'M'
  return s + '$' + a.toLocaleString()
}

const RISK_COLOR = { high: '#F87171', medium: '#FBBF24', low: '#34D399' }
const PRIORITY_COLOR = { high: '#C9A84C', medium: '#60A5FA', low: '#6B7280' }

// ── SVG Charts ────────────────────────────────────────────────────────────────

function RevenueChart({ capex, rev12, rev36, breakeven }: { capex: number; rev12: number; rev36: number; breakeven: number }) {
  const maxVal = Math.max(capex, rev12, rev36)
  const bars = [
    { label: 'Capex', value: capex, color: '#F87171' },
    { label: 'Rev. 12m', value: rev12, color: '#60A5FA' },
    { label: 'Rev. 36m', value: rev36, color: '#34D399' },
  ]
  return (
    <div className="bg-[#111827] rounded-xl p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Projections financières</p>
      <div className="flex items-end gap-4 h-32">
        {bars.map(b => {
          const h = maxVal > 0 ? Math.round((b.value / maxVal) * 100) : 0
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="text-xs font-bold" style={{ color: b.color }}>{fmtEur(b.value)}</div>
              <div className="w-full rounded-t-lg transition-all" style={{ height: `${h}%`, minHeight: 4, background: b.color + 'CC' }} />
              <div className="text-[10px] text-gray-500 text-center">{b.label}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
        <span>Point mort estimé</span>
        <span className="text-white font-semibold">{breakeven} mois</span>
      </div>
    </div>
  )
}

function RoiChart({ roi12, roi36, margin }: { roi12: number; roi36: number; margin: number }) {
  const items = [
    { label: 'ROI 12m', value: roi12, max: Math.max(roi12, roi36, 0) },
    { label: 'ROI 36m', value: roi36, max: Math.max(roi12, roi36, 0) },
    { label: 'Marge nette', value: margin, max: 100 },
  ]
  return (
    <div className="bg-[#111827] rounded-xl p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Rentabilité</p>
      <div className="space-y-3">
        {items.map(it => {
          const pct = it.max > 0 ? Math.min(100, Math.round((it.value / it.max) * 100)) : 0
          const color = it.value >= 50 ? '#34D399' : it.value >= 20 ? '#FBBF24' : '#60A5FA'
          return (
            <div key={it.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{it.label}</span>
                <span className="font-bold" style={{ color }}>{it.value > 0 ? '+' : ''}{it.value}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompetitorChart({ competitors }: { competitors: PlanData['competitors'] }) {
  if (!competitors?.length) return null
  const colors = ['#C9A84C', '#60A5FA', '#34D399', '#F87171', '#A78BFA']
  const total = competitors.reduce((s, c) => s + c.share_pct, 0)
  // Simple pie using conic-gradient
  let cumulative = 0
  const segments = competitors.slice(0, 5).map((c, i) => {
    const start = (cumulative / total) * 360
    cumulative += c.share_pct
    const end = (cumulative / total) * 360
    return { ...c, start, end, color: colors[i % colors.length] }
  })
  const gradient = segments.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')

  return (
    <div className="bg-[#111827] rounded-xl p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Parts de marché concurrents</p>
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-full shrink-0"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="space-y-1.5 flex-1">
          {segments.map(s => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-gray-300 truncate flex-1">{s.name}</span>
              <span className="font-semibold" style={{ color: s.color }}>{s.share_pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Prompt ─────────────────────────────────────────────────────────────────────

function buildPrompt(country: Country, opps: Opportunity[], lang: string, isPremium: boolean): string {
  const oppList = opps.slice(0, 5).map((o, i) =>
    `${i + 1}. ${o.products?.name ?? 'Produit'} — Score: ${o.opportunity_score}/100 — Gap: ${o.gap_value_usd ? '$' + (o.gap_value_usd / 1e6).toFixed(0) + 'M/an' : 'N/A'} — ${o.summary ?? ''}`
  ).join('\n')

  const buyersSchema = isPremium ? `,
  "buyers_by_resource": [
    {
      "resource": "Nom exact du produit/ressource (ex: Tomates fraîches, Blé dur, Huile de palme brute)",
      "chain": "Description de la chaîne de valeur (ex: Agriculteurs → Transformateurs → Grossistes → Détaillants → Consommateurs)",
      "buyers": [
        {
          "name": "Nom réel de l'entreprise ou groupement",
          "type": "manufacturer|distributor|wholesaler|retailer|cooperative|importer|processor|trader",
          "sector": "Secteur précis (ex: Agro-industrie, Grande distribution, Commerce de gros)",
          "description": "Ce que l'entreprise achète/fait avec ce produit en 1-2 phrases",
          "city": "Ville principale",
          "volume": "Volume annuel estimé (ex: 10 000 tonnes/an, 500 000 USD/an)",
          "products": ["Produit1", "Produit2"],
          "website": "www.example.com ou null",
          "email": "contact@example.com ou null",
          "phone": "+XX XXX XX XX XX ou null"
        }
      ]
    }
  ]` : ''

  return `Tu es un expert en développement business international. Génère un business plan structuré pour une opportunité en ${country.name_fr}.

PAYS : ${country.name_fr} (${country.id}) — PIB: ${fmtUsd(country.gdp_usd)} — Imports: ${fmtUsd(country.total_imports_usd)} — Pop: ${country.population ? (country.population / 1e6).toFixed(1) + 'M' : 'N/A'} — Catégorie: ${country.top_import_category ?? 'général'}
OPPORTUNITÉS:
${oppList}

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte avant/après), format exact :
{
  "executive_summary": "3-4 phrases percutantes sur l'opportunité principale et le potentiel",
  "market_context": "2-3 phrases de contexte marché local",
  "market_size_eur": 500000000,
  "growth_rate_pct": 12,
  "competitors": [
    {"name": "Acteur local dominant", "share_pct": 35, "strength": "Distribution établie"},
    {"name": "Import chinois", "share_pct": 28, "strength": "Prix bas"},
    {"name": "Marché informel", "share_pct": 20, "strength": "Accessibilité"},
    {"name": "Autres imports", "share_pct": 17, "strength": "Variété"}
  ],
  "entry_strategy": "Description détaillée de la meilleure stratégie d'entrée avec justification",
  "entry_mode": "Import direct / JV locale / Franchise / E-commerce",
  "capex_eur": 150000,
  "opex_monthly_eur": 25000,
  "revenue_12m_eur": 400000,
  "revenue_36m_eur": 1500000,
  "roi_12m_pct": 45,
  "roi_36m_pct": 180,
  "breakeven_months": 14,
  "margin_pct": 28,
  "actions": [
    {"period": "Semaines 1-2", "title": "Étude terrain", "description": "Action concrète détaillée", "priority": "high"},
    {"period": "Semaines 3-4", "title": "Partenariats locaux", "description": "Action concrète", "priority": "high"},
    {"period": "Mois 2", "title": "Structure légale", "description": "Action concrète", "priority": "medium"},
    {"period": "Mois 2-3", "title": "Sourcing & logistique", "description": "Action concrète", "priority": "high"},
    {"period": "Mois 3", "title": "Lancement commercial", "description": "Action concrète", "priority": "high"},
    {"period": "Mois 3+", "title": "Optimisation & scale", "description": "Action concrète", "priority": "medium"}
  ],
  "risks": [
    {"title": "Risque réglementaire", "impact": "high", "probability": "medium", "mitigation": "Mitigation concrète"},
    {"title": "Risque de change", "impact": "medium", "probability": "high", "mitigation": "Mitigation concrète"},
    {"title": "Risque concurrentiel", "impact": "high", "probability": "low", "mitigation": "Mitigation concrète"},
    {"title": "Risque logistique", "impact": "medium", "probability": "medium", "mitigation": "Mitigation concrète"}
  ],
  "key_resources": [
    "Chambre de Commerce de ${country.name_fr}",
    "Agence de promotion des investissements",
    "Certifications requises (ISO, normes locales)",
    "Banques partenaires locales recommandées"
  ],
  "image_keywords": ["${country.top_import_category ?? 'trade'}", "${country.name_fr}", "market"],
  "product_focus": "Nom du produit/secteur principal ciblé"${buyersSchema}
}
${isPremium ? `\nPour buyers_by_resource : identifie les acheteurs RÉELS (industriels, grossistes, distributeurs, centrales d'achat, coopératives) dans la chaîne de valeur complète pour chaque ressource principale des opportunités. Inclus les coordonnées réelles si connues. Identifie au minimum 8-12 acheteurs par ressource. Couvre toute la chaîne : transformation primaire, distribution nationale, grande distribution, export.` : ''}
Assure-toi que les chiffres sont réalistes par rapport au PIB du pays (${fmtUsd(country.gdp_usd)}).
${lang === 'fr' ? 'Tous les textes en français.' : 'All text in English.'}`
}

// ── Main business plan renderer ───────────────────────────────────────────────

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

const BUYER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  manufacturer: { label: 'Industriel',      color: '#F97316' },
  processor:    { label: 'Transformateur',   color: '#FB923C' },
  distributor:  { label: 'Distributeur',     color: '#60A5FA' },
  wholesaler:   { label: 'Grossiste',        color: '#34D399' },
  retailer:     { label: 'Détaillant',       color: '#A78BFA' },
  cooperative:  { label: 'Coopérative',      color: '#FBBF24' },
  importer:     { label: 'Importateur',      color: '#F87171' },
  trader:       { label: 'Négociant',        color: '#C9A84C' },
}

function BuyerCard({ buyer }: { buyer: Buyer }) {
  const typeCfg = BUYER_TYPE_LABELS[buyer.type] ?? { label: buyer.type, color: '#6B7280' }
  return (
    <div className="bg-[#0D1117] border border-white/8 rounded-xl p-4 flex flex-col gap-2 hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-white text-sm leading-snug">{buyer.name}</div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: typeCfg.color + '20', color: typeCfg.color }}>
          {typeCfg.label}
        </span>
      </div>
      <div className="text-xs text-[#C9A84C]/80 font-medium">{buyer.sector} · {buyer.city}</div>
      <p className="text-xs text-gray-400 leading-relaxed">{buyer.description}</p>
      {buyer.volume && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          {buyer.volume}
        </div>
      )}
      {buyer.products?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {buyer.products.slice(0, 4).map((p, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-500">{p}</span>
          ))}
        </div>
      )}
      {(buyer.website || buyer.email || buyer.phone) && (
        <div className="border-t border-white/5 pt-2 mt-1 flex flex-col gap-1">
          {buyer.website && buyer.website !== 'null' && (
            <a href={buyer.website.startsWith('http') ? buyer.website : `https://${buyer.website}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors truncate">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 2c0 0-3 3-3 10s3 10 3 10M12 2c0 0 3 3 3 10s-3 10-3 10M2 12h20"/>
              </svg>
              {buyer.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {buyer.email && buyer.email !== 'null' && (
            <a href={`mailto:${buyer.email}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {buyer.email}
            </a>
          )}
          {buyer.phone && buyer.phone !== 'null' && (
            <a href={`tel:${buyer.phone}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              {buyer.phone}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function BusinessPlanContent({ country, opps, userTier }: { country: Country; opps: Opportunity[]; userTier: string }) {
  const { lang } = useLang()
  const isPremium = TIER_RANK[userTier] >= TIER_RANK['premium']
  // Cache key scoped by country + lang so regenerating after a lang switch still works.
  const cacheKey = `ftg_plan_${country.id}_${lang}`
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawBuffer, setRawBuffer] = useState('')
  const [checkingCache, setCheckingCache] = useState(true)
  const planRef = useRef<HTMLDivElement>(null)

  // Restore cached plan from localStorage on mount/lang change — zero tokens.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw) as PlanData
        setPlan(parsed)
      } else {
        setPlan(null)
      }
    } catch {}
    setCheckingCache(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey])

  const downloadPDF = useCallback(async () => {
    if (!planRef.current || !plan) return
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])

      const element = planRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#07090F',
        logging: false,
        imageTimeout: 10000,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentW = pageW - margin * 2
      const contentH = (canvas.height * contentW) / canvas.width

      // Add pages as needed
      let remainingH = contentH
      let yOffset = 0
      let pageIndex = 0

      while (remainingH > 0) {
        if (pageIndex > 0) pdf.addPage()

        const sliceH = Math.min(pageH - margin * 2, remainingH)
        const srcY = (yOffset / contentH) * canvas.height
        const srcH = (sliceH / contentH) * canvas.height

        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = Math.round(srcH)
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)

        pdf.addImage(sliceData, 'JPEG', margin, margin, contentW, sliceH)

        remainingH -= sliceH
        yOffset += sliceH
        pageIndex++
      }

      // Add footer on each page
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(7)
        pdf.setTextColor(100, 100, 100)
        pdf.text(
          `Feel The Gap · Business Plan — ${country.flag} ${country.name_fr} · Page ${i}/${totalPages}`,
          pageW / 2, pageH - 4, { align: 'center' }
        )
      }

      pdf.save(`business-plan-${country.id.toLowerCase()}-feelthegap.pdf`)
    } catch (err) {
      console.error('PDF export error', err)
    } finally {
      setExporting(false)
    }
  }, [plan, country])

  async function generate(isRefresh = false) {
    // Set generating FIRST to avoid flashing the "generate" screen
    setGenerating(true)
    setError(null)
    if (!isRefresh) setPlan(null)
    setRawBuffer('')

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: buildPrompt(country, opps, lang, isPremium) }],
          context: {
            country: country.name_fr,
            iso: country.id,
            product: country.top_import_category ?? 'général',
            category: country.top_import_category ?? 'général',
            strategy: 'trade',
          },
        }),
      })

      if (!res.ok) throw new Error('API error')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const delta = JSON.parse(line.slice(6))?.choices?.[0]?.delta?.content
            if (delta) {
              buffer += delta
              setRawBuffer(buffer)
            }
          } catch {}
        }
      }

      // Parse JSON from buffer
      const jsonMatch = buffer.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Invalid response format')
      const parsed = JSON.parse(jsonMatch[0]) as PlanData
      setPlan(parsed)
      // Persist to localStorage so refreshing or navigating back never
      // triggers a new LLM call — download PDF/txt uses this cached state.
      try { localStorage.setItem(cacheKey, JSON.stringify(parsed)) } catch {}
    } catch (err) {
      setError(lang === 'fr' ? 'Erreur de génération. Réessayez.' : 'Generation failed. Please retry.')
      console.error(err)
    } finally {
      setGenerating(false)
      setRawBuffer('')
    }
  }

  function downloadTxt() {
    if (!plan) return
    const text = [
      `BUSINESS PLAN — ${country.flag} ${country.name_fr.toUpperCase()}`,
      `Généré le ${new Date().toLocaleDateString('fr-FR')} par Feel The Gap`,
      '='.repeat(60),
      '',
      '📋 RÉSUMÉ EXÉCUTIF',
      plan.executive_summary,
      '',
      '📊 MARCHÉ',
      `Taille du marché: ${fmtEur(plan.market_size_eur)} | Croissance: +${plan.growth_rate_pct}%/an`,
      plan.market_context,
      '',
      '🚀 STRATÉGIE D\'ENTRÉE',
      `Mode: ${plan.entry_mode}`,
      plan.entry_strategy,
      '',
      '💰 PROJECTIONS FINANCIÈRES',
      `Capex initial: ${fmtEur(plan.capex_eur)}`,
      `Opex mensuel: ${fmtEur(plan.opex_monthly_eur)}`,
      `Revenus 12 mois: ${fmtEur(plan.revenue_12m_eur)} (ROI +${plan.roi_12m_pct}%)`,
      `Revenus 36 mois: ${fmtEur(plan.revenue_36m_eur)} (ROI +${plan.roi_36m_pct}%)`,
      `Point mort: ${plan.breakeven_months} mois | Marge nette: ${plan.margin_pct}%`,
      '',
      '📅 PLAN 90 JOURS',
      ...plan.actions.map(a => `• [${a.priority.toUpperCase()}] ${a.period} — ${a.title}: ${a.description}`),
      '',
      '⚠️ RISQUES',
      ...plan.risks.map(r => `• ${r.title} (impact: ${r.impact}, prob: ${r.probability})\n  Mitigation: ${r.mitigation}`),
      '',
      '📞 RESSOURCES CLÉS',
      ...plan.key_resources.map(r => `• ${r}`),
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `business-plan-${country.id.toLowerCase()}-feelthegap.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loading cache ────────────────────────────────────────────────────────────
  if (checkingCache) {
    return (
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Generate screen ─────────────────────────────────────────────────────────
  if (!plan && !generating) {
    return (
      <div className="rounded-2xl overflow-hidden border border-[rgba(201,168,76,.15)]">
        {/* Hero image */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={categoryImage(country.top_import_category)}
            alt={country.name_fr}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090F] via-[#07090F]/60 to-transparent" />
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <span className="text-4xl">{country.flag}</span>
            <div>
              <div className="text-white font-bold text-xl">{country.name_fr}</div>
              <div className="text-gray-400 text-sm">{country.sub_region} · {country.region}</div>
            </div>
          </div>
        </div>

        <div className="p-7 text-center">
          <div className="flex justify-center gap-4 mb-7">
            {[
              { label: 'PIB', value: fmtUsd(country.gdp_usd) },
              { label: lang === 'fr' ? 'Imports' : 'Imports', value: fmtUsd(country.total_imports_usd) },
              { label: lang === 'fr' ? 'Opportunités' : 'Opportunities', value: String(opps.length) + ' identifiées' },
            ].map(s => (
              <div key={s.label} className="bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl px-4 py-3 text-center">
                <div className="text-base font-bold text-[#C9A84C]">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {lang === 'fr' ? 'Business Plan IA' : 'AI Business Plan'} — {country.name_fr}
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-lg mx-auto">
            {lang === 'fr'
              ? 'Rapport complet : analyse marché, projections financières, stratégie d\'entrée, plan d\'actions 90 jours, matrice de risques.'
              : 'Full report: market analysis, financial projections, entry strategy, 90-day action plan, risk matrix.'}
          </p>

          <button
            onClick={() => generate()}
            className="px-8 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm inline-flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {lang === 'fr' ? 'Générer le business plan' : 'Generate business plan'}
          </button>
          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </div>
      </div>
    )
  }

  // ── Generating screen (only for first generation, not refresh) ─────────────
  if (generating && !plan) {
    return (
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] p-10 flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-[#C9A84C]/20 animate-ping" />
          <div className="w-16 h-16 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-xl">{country.flag}</div>
        </div>
        <div className="text-center">
          <div className="text-white font-semibold mb-1">
            {lang === 'fr' ? 'Génération en cours…' : 'Generating…'}
          </div>
          <div className="text-gray-500 text-sm">
            {lang === 'fr' ? 'Analyse des données et construction du plan' : 'Analysing data and building the plan'}
          </div>
        </div>
        {rawBuffer.length > 10 && (
          <div className="w-full max-w-sm bg-[#111827] rounded-xl p-3">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((rawBuffer.length / 2000) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 text-center">
              {Math.round(rawBuffer.length / 10)} / ~200 tokens
            </p>
          </div>
        )}
      </div>
    )
  }

  if (!plan) return null

  // ── Full plan render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-0 overflow-hidden" ref={planRef}>
      {/* Hero */}
      <div className="rounded-t-2xl overflow-hidden relative h-56 md:h-52">
        <img
          src={categoryImage(country.top_import_category)}
          alt={country.name_fr}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090F] via-[#07090F]/60 to-transparent" />
        {/* On mobile: stack vertically so "Marché adressable" and the amount
            never compete for horizontal space with the country name.
            On md+: keep the original two-column layout. */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-4 md:pb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl md:text-4xl shrink-0">{country.flag}</span>
            <div className="min-w-0">
              <div className="text-white font-bold text-xl md:text-2xl leading-tight">{country.name_fr}</div>
              <div className="text-[#C9A84C] text-xs md:text-sm font-medium leading-tight">{plan.product_focus}</div>
            </div>
          </div>
          <div className="flex items-baseline md:block gap-2 md:text-right shrink-0">
            <div className="text-[11px] md:text-xs text-gray-300 md:text-gray-400 leading-tight whitespace-nowrap">Marché adressable</div>
            <div className="text-base md:text-xl font-bold text-white leading-tight whitespace-nowrap">{fmtEur(plan.market_size_eur)}</div>
            <div className="text-[11px] md:text-xs text-emerald-400 leading-tight whitespace-nowrap">+{plan.growth_rate_pct}%/an</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[rgba(201,168,76,.1)]">
        {[
          { label: 'Capex initial', value: fmtEur(plan.capex_eur), color: '#F87171', icon: '💰' },
          { label: 'Revenus 12m', value: fmtEur(plan.revenue_12m_eur), color: '#60A5FA', icon: '📈' },
          { label: 'ROI 36 mois', value: '+' + plan.roi_36m_pct + '%', color: '#34D399', icon: '📊' },
          { label: 'Point mort', value: plan.breakeven_months + ' mois', color: '#C9A84C', icon: '⏱️' },
        ].map(k => (
          <div key={k.label} className="bg-[#0D1117] px-2.5 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 min-w-0">
            <span className="text-base md:text-lg shrink-0">{k.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] md:text-base font-bold leading-tight" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[10px] md:text-xs text-gray-500 leading-tight">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#0D1117] border-x border-b border-[rgba(201,168,76,.15)] rounded-b-2xl p-6 space-y-8 overflow-hidden break-words">

        {/* 1. Executive summary */}
        <section>
          <SectionTitle icon="📋" title="Résumé exécutif" />
          <div className="bg-[#111827] rounded-xl p-4 border-l-4 border-[#C9A84C]">
            <p className="text-gray-300 text-sm leading-relaxed break-words overflow-wrap-anywhere">{plan.executive_summary}</p>
          </div>
        </section>

        {/* 2. Market + charts row */}
        <section>
          <SectionTitle icon="🌍" title="Analyse du marché" />
          <p className="text-gray-400 text-sm mb-4 leading-relaxed break-words">{plan.market_context}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CompetitorChart competitors={plan.competitors} />
            <RoiChart roi12={plan.roi_12m_pct} roi36={plan.roi_36m_pct} margin={plan.margin_pct} />
          </div>
        </section>

        {/* 3. Entry strategy */}
        <section>
          <SectionTitle icon="🚀" title="Stratégie d'entrée recommandée" />
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-bold rounded-full uppercase tracking-wide">
              {plan.entry_mode}
            </span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed break-words">{plan.entry_strategy}</p>
        </section>

        {/* 4. Financial projections */}
        <section>
          <SectionTitle icon="💰" title="Projections financières" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <RevenueChart
              capex={plan.capex_eur}
              rev12={plan.revenue_12m_eur}
              rev36={plan.revenue_36m_eur}
              breakeven={plan.breakeven_months}
            />
            {/* Financial table */}
            <div className="bg-[#111827] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Tableau financier</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-white/5">
                  {[
                    { label: 'Capex initial', value: fmtEur(plan.capex_eur), color: '#F87171' },
                    { label: 'Opex / mois', value: fmtEur(plan.opex_monthly_eur), color: '#FBBF24' },
                    { label: 'Revenus 12 mois', value: fmtEur(plan.revenue_12m_eur), color: '#60A5FA' },
                    { label: 'Revenus 36 mois', value: fmtEur(plan.revenue_36m_eur), color: '#34D399' },
                    { label: 'ROI 12 mois', value: '+' + plan.roi_12m_pct + '%', color: '#60A5FA' },
                    { label: 'ROI 36 mois', value: '+' + plan.roi_36m_pct + '%', color: '#34D399' },
                    { label: 'Marge nette', value: plan.margin_pct + '%', color: '#C9A84C' },
                    { label: 'Point mort', value: plan.breakeven_months + ' mois', color: '#A78BFA' },
                  ].map(r => (
                    <tr key={r.label}>
                      <td className="py-2 text-gray-500">{r.label}</td>
                      <td className="py-2 text-right font-bold" style={{ color: r.color }}>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5. 90-day action plan */}
        <section>
          <SectionTitle icon="📅" title="Plan d'actions — 90 premiers jours" />
          <div className="space-y-2">
            {plan.actions.map((action, i) => (
              <div key={i} className="flex gap-3 items-start">
                {/* Timeline dot */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div
                    className="w-3 h-3 rounded-full border-2 shrink-0"
                    style={{
                      borderColor: PRIORITY_COLOR[action.priority],
                      background: PRIORITY_COLOR[action.priority] + '30',
                    }}
                  />
                  {i < plan.actions.length - 1 && (
                    <div className="w-px flex-1 bg-white/5 mt-1" style={{ minHeight: 20 }} />
                  )}
                </div>
                <div className="flex-1 bg-[#111827] rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                      background: PRIORITY_COLOR[action.priority] + '20',
                      color: PRIORITY_COLOR[action.priority],
                    }}>
                      {action.period}
                    </span>
                    <span className="text-xs font-semibold text-white">{action.title}</span>
                    <span className="ml-auto text-[10px] text-gray-600 capitalize">{action.priority}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{action.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Risk matrix */}
        <section>
          <SectionTitle icon="⚠️" title="Matrice de risques" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.risks.map((risk, i) => (
              <div key={i} className="bg-[#111827] rounded-xl p-4 border-l-2" style={{ borderColor: RISK_COLOR[risk.impact] }}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{risk.title}</span>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: RISK_COLOR[risk.impact] + '25', color: RISK_COLOR[risk.impact] }}>
                      Impact {risk.impact}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: RISK_COLOR[risk.probability] + '25', color: RISK_COLOR[risk.probability] }}>
                      Prob. {risk.probability}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Mitigation : </span>
                  {risk.mitigation}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 7. Key resources */}
        {plan.key_resources?.length > 0 && (
          <section>
            <SectionTitle icon="📞" title="Ressources & contacts clés" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {plan.key_resources.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-[#111827] rounded-xl px-4 py-3">
                  <span className="text-[#C9A84C] mt-0.5 shrink-0">›</span>
                  <span className="text-sm text-gray-300">{r}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8. Buyers & Distributors — Premium only */}
        {isPremium ? (
          plan.buyers_by_resource && plan.buyers_by_resource.length > 0 && (
            <section>
              <SectionTitle icon="🏭" title="Acheteurs & Distributeurs locaux" />
              <p className="text-xs text-gray-500 mb-4">Acteurs identifiés dans la chaîne de valeur — transformateurs, grossistes, centrales d'achat, distributeurs nationaux.</p>
              <div className="space-y-6">
                {plan.buyers_by_resource.map((group, gi) => (
                  <div key={gi}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="font-semibold text-white text-sm">{group.resource}</div>
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] text-gray-500 shrink-0">{group.buyers?.length ?? 0} acheteurs</span>
                    </div>
                    {group.chain && (
                      <div className="flex items-center gap-2 mb-3 bg-[#111827] rounded-lg px-3 py-2 overflow-x-auto">
                        {group.chain.split('→').map((step, si, arr) => (
                          <span key={si} className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{step.trim()}</span>
                            {si < arr.length - 1 && <span className="text-[#C9A84C] text-xs">→</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {(group.buyers ?? []).map((buyer, bi) => (
                        <BuyerCard key={bi} buyer={buyer} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        ) : (
          <section>
            <SectionTitle icon="🏭" title="Acheteurs & Distributeurs locaux" />
            <div className="bg-[#111827] border border-[#A78BFA]/20 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#A78BFA]/10 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-white mb-1">Fonctionnalité Premium</div>
                <p className="text-sm text-gray-400 max-w-md">
                  Identifiez les industriels, transformateurs, grossistes et centrales d'achat qui achètent vos ressources dans ce pays — avec coordonnées et volumes estimés.
                </p>
              </div>
              <Link href="/pricing" className="mt-1 px-5 py-2.5 bg-[#A78BFA] text-white font-bold rounded-xl hover:bg-[#C4B5FD] transition-colors text-sm">
                Passer en Premium
              </Link>
            </div>
          </section>
        )}

        {/* Actions synthesis banner */}
        <section className="bg-gradient-to-r from-[#C9A84C]/10 via-[#C9A84C]/5 to-transparent border border-[#C9A84C]/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="text-sm font-bold text-[#C9A84C]">
              {lang === 'fr' ? 'Synthèse — Actions prioritaires' : 'Summary — Priority Actions'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plan.actions.filter(a => a.priority === 'high').slice(0, 3).map((a, i) => (
              <div key={i} className="bg-[#C9A84C]/5 border border-[#C9A84C]/15 rounded-xl px-3 py-2.5">
                <div className="text-xs font-bold text-[#C9A84C] mb-0.5">{i + 1}. {a.title}</div>
                <div className="text-[11px] text-gray-400">{a.period}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Download */}
        <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-white/5">
          <button
            onClick={downloadTxt}
            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-300 rounded-xl text-sm hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            .txt
          </button>
          <button
            onClick={downloadPDF}
            disabled={exporting}
            className="px-5 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm hover:bg-[#E8C97A] transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {exporting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {lang === 'fr' ? 'Génération PDF…' : 'Generating PDF…'}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                {lang === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
              </>
            )}
          </button>
        </div>

        {/* Refresh button — bottom of plan */}
        <div className="flex justify-center pt-6 pb-2">
          <button
            onClick={() => {
              const ok = confirm(lang === 'fr'
                ? 'Actualiser le business plan consommera des crédits IA. Continuer ?'
                : 'Refreshing the business plan will consume AI credits. Continue?')
              if (!ok) return
              try { localStorage.removeItem(cacheKey) } catch {}
              generate(true)
            }}
            disabled={generating}
            className="px-5 py-2.5 bg-white/5 border border-white/10 text-gray-400 rounded-xl text-sm hover:bg-white/10 hover:text-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                {lang === 'fr' ? 'Actualisation…' : 'Refreshing…'}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {lang === 'fr' ? 'Actualiser le business plan' : 'Refresh business plan'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold text-white mb-3">
      <span className="text-lg">{icon}</span>
      {title}
    </h2>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function PlanPage() {
  const { iso } = useParams<{ iso: string }>()
  const router = useRouter()
  const { t, lang } = useLang()
  const [country, setCountry] = useState<Country | null>(null)
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [userTier, setUserTier] = useState<string>('standard')

  useEffect(() => {
    if (!iso) return
    const browserSupabase = createSupabaseBrowser()
    Promise.all([
      supabase.from('countries').select('*').eq('id', iso.toUpperCase()).single(),
      supabase.from('opportunities')
        .select('id, type, opportunity_score, gap_value_usd, summary, products(name, category)')
        .eq('country_iso', iso.toUpperCase())
        .order('opportunity_score', { ascending: false })
        .limit(10),
      browserSupabase.auth.getUser(),
    ]).then(async ([{ data: c }, { data: o }, { data: authData }]) => {
      if (!c) { router.push('/reports'); return }
      setCountry(c as Country)
      setOpps((o ?? []).map((x: any) => ({
        ...x,
        products: Array.isArray(x.products) ? x.products[0] ?? null : x.products,
      })) as Opportunity[])
      if (authData.user) {
        const { data: profile } = await browserSupabase.from('profiles').select('tier').eq('id', authData.user.id).single()
        if (profile?.tier) setUserTier(profile.tier)
      }
      setLoading(false)
    })
  }, [iso, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!country) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F] overflow-x-hidden">
      <Topbar />
      <div className="max-w-4xl mx-auto w-full px-4 py-8 overflow-hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
          <Link href="/reports" className="hover:text-gray-300">{t('reports.title')}</Link>
          <span>›</span>
          <Link href={`/country/${iso}`} className="hover:text-gray-300">{country.flag} {country.name_fr}</Link>
          <span>›</span>
          <span className="text-[#C9A84C]">Business Plan</span>
        </div>

        <PaywallGate requiredTier="standard" featureName="Business Plan IA">
          <BusinessPlanContent country={country} opps={opps} userTier={userTier} />
        </PaywallGate>
      </div>
    </div>
  )
}
