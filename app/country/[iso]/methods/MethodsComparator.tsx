'use client'

/**
 * MethodsComparator — Production 3.0
 *
 * Comparateur interactif multi-critères (cost / time / quality / capex / opex)
 * avec pondérations réglables en live et édition locale des cellules.
 *
 * Tier gating :
 *   - free / starter (Data) / strategy      : 1 méthode dominante (popularity_rank=1) visible, reste verrouillé
 *   - premium / ultimate / custom           : bench complet éditable
 *
 * L'édition des cellules est *locale* (useState) — non persistée en DB
 * (comportement demandé pour MVP café).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { PlanTier } from '@/lib/credits/costs'

// ── Types ──────────────────────────────────────────────────────────────────

export type Method = {
  id: string
  product_slug: string
  name: string
  description_md: string
  popularity_rank: number
}

export type Metric = {
  method_id: string
  cost_score: number | null
  time_months: number | null
  quality_score: number | null
  capex_eur: number | null
  opex_eur_per_unit: number | null
}

export type Resource = {
  id: string
  method_id: string
  type: 'machine' | 'material'
  name: string
  est_cost_eur: number | null
  supplier_hint: string | null
}

export type Media = {
  id: string
  method_id: string
  type: 'image' | 'video'
  url: string
  caption: string | null
}

type Weights = {
  cost: number
  time: number
  quality: number
  capex: number
  opex: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PREMIUM_TIERS: PlanTier[] = ['premium', 'ultimate', 'custom']

function hasFullBench(tier: PlanTier): boolean {
  return PREMIUM_TIERS.includes(tier)
}

/** Normalise un tier legacy venant de la DB (explorer/data/standard/basic) vers PlanTier courant. */
function normalizeTier(raw: string | null | undefined): PlanTier {
  const t = (raw ?? 'free').toLowerCase()
  if (t === 'explorer') return 'free'
  if (t === 'basic' || t === 'data') return 'starter'
  if (t === 'standard') return 'strategy'
  if (t === 'enterprise') return 'custom'
  if (['free', 'starter', 'strategy', 'premium', 'ultimate', 'custom'].includes(t)) {
    return t as PlanTier
  }
  return 'free'
}

/**
 * Score pondéré d'une méthode, 0-100.
 *
 * - cost_score et quality_score sont déjà 0-100 (plus haut = mieux).
 * - time_months : plus bas = mieux → on normalise avec 1 - t/maxTime.
 * - capex / opex : plus bas = mieux → normalisation relative au max de la liste.
 * Les poids sont des % (sommés côté UI pour l'affichage mais normalisés ici).
 */
function weightedScore(
  metric: Metric | undefined,
  weights: Weights,
  maxima: { time: number; capex: number; opex: number }
): number {
  if (!metric) return 0
  const cost = metric.cost_score ?? 0
  const quality = metric.quality_score ?? 0
  const time = metric.time_months ?? 0
  const capex = metric.capex_eur ?? 0
  const opex = metric.opex_eur_per_unit ?? 0

  const timeScore = maxima.time > 0 ? Math.max(0, 100 * (1 - time / maxima.time)) : 100
  const capexScore = maxima.capex > 0 ? Math.max(0, 100 * (1 - capex / maxima.capex)) : 100
  const opexScore = maxima.opex > 0 ? Math.max(0, 100 * (1 - opex / maxima.opex)) : 100

  const totalW = weights.cost + weights.time + weights.quality + weights.capex + weights.opex
  if (totalW <= 0) return 0

  const raw =
    cost * weights.cost +
    timeScore * weights.time +
    quality * weights.quality +
    capexScore * weights.capex +
    opexScore * weights.opex

  return Math.round(raw / totalW)
}

function fmtEur(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M €'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k €'
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
        <span>{label}</span>
        <span className="text-[#C9A84C] font-bold">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#C9A84C]"
      />
    </div>
  )
}

function NumberCell({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="w-20 bg-[#07090F] border border-white/10 rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:border-[#C9A84C] disabled:opacity-40"
      />
      {suffix ? <span className="text-[10px] text-gray-500">{suffix}</span> : null}
    </div>
  )
}

function DetailPanel({
  method,
  resources,
  media,
  iso,
  productSlug,
  onClose,
}: {
  method: Method
  resources: Resource[]
  media: Media[]
  iso: string
  productSlug: string
  onClose: () => void
}) {
  const machines = resources.filter((r) => r.type === 'machine')
  const materials = resources.filter((r) => r.type === 'material')
  const images = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video')

  return (
    <div className="mt-4 bg-[#0D1117] border border-[rgba(201,168,76,.25)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <h3 className="font-bold text-white text-sm">
          <span className="text-[#C9A84C]">▸</span> {method.name}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs"
          aria-label="Fermer le panneau"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
        {/* Description */}
        <div className="space-y-2 md:col-span-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Description</div>
          <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
            {method.description_md}
          </div>
        </div>

        {/* Machines */}
        {machines.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Machines</div>
            <ul className="space-y-1.5">
              {machines.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between items-start gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-white">{r.name}</div>
                    {r.supplier_hint && (
                      <div className="text-[11px] text-gray-500">{r.supplier_hint}</div>
                    )}
                  </div>
                  <div className="text-[#C9A84C] font-semibold whitespace-nowrap">
                    {fmtEur(r.est_cost_eur)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Matières */}
        {materials.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Matières</div>
            <ul className="space-y-1.5">
              {materials.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between items-start gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-white">{r.name}</div>
                    {r.supplier_hint && (
                      <div className="text-[11px] text-gray-500">{r.supplier_hint}</div>
                    )}
                  </div>
                  <div className="text-[#C9A84C] font-semibold whitespace-nowrap">
                    {fmtEur(r.est_cost_eur)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Images */}
        {images.length > 0 && (
          <div className="space-y-2 md:col-span-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Galerie</div>
            <div className="flex gap-2 overflow-x-auto">
              {images.map((m) => (
                <figure key={m.id} className="shrink-0 w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.caption ?? method.name}
                    className="w-40 h-28 object-cover rounded-lg border border-white/10"
                    loading="lazy"
                  />
                  {m.caption && (
                    <figcaption className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                      {m.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Vidéos */}
        {videos.length > 0 && (
          <div className="space-y-2 md:col-span-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Vidéos</div>
            <ul className="space-y-1">
              {videos.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-[#60A5FA] hover:underline"
                  >
                    ▶ {m.caption ?? m.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 px-5 py-3.5 flex justify-end">
        <Link
          href={`/country/${iso}/plan?method=${method.id}&product=${productSlug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] transition-colors"
        >
          Utiliser cette méthode pour mon business plan →
        </Link>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function MethodsComparator({
  iso,
  productSlug,
  methods,
  metrics,
  resources,
  media,
  userTier,
}: {
  iso: string
  productSlug: string
  methods: Method[]
  metrics: Metric[]
  resources: Resource[]
  media: Media[]
  userTier: string
}) {
  const tier = normalizeTier(userTier)
  const fullBench = hasFullBench(tier)

  // Méthodes triées par popularity_rank (asc, 1 = dominante).
  const sortedMethods = useMemo(
    () => [...methods].sort((a, b) => a.popularity_rank - b.popularity_rank),
    [methods]
  )

  const dominant = sortedMethods[0]
  const visibleMethods = fullBench ? sortedMethods : dominant ? [dominant] : []

  // Métriques éditables localement (clone initial pour permettre tweak live).
  const [editedMetrics, setEditedMetrics] = useState<Record<string, Metric>>(() => {
    const map: Record<string, Metric> = {}
    for (const m of metrics) map[m.method_id] = { ...m }
    return map
  })

  // Poids pondération — défaut 20% chacun, total 100.
  const [weights, setWeights] = useState<Weights>({
    cost: 20,
    time: 20,
    quality: 20,
    capex: 20,
    opex: 20,
  })

  const maxima = useMemo(() => {
    const all = Object.values(editedMetrics)
    return {
      time: Math.max(1, ...all.map((m) => m.time_months ?? 0)),
      capex: Math.max(1, ...all.map((m) => m.capex_eur ?? 0)),
      opex: Math.max(0.0001, ...all.map((m) => m.opex_eur_per_unit ?? 0)),
    }
  }, [editedMetrics])

  // Scores pondérés par méthode (recalcul live).
  const scores = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of visibleMethods) {
      map[m.id] = weightedScore(editedMetrics[m.id], weights, maxima)
    }
    return map
  }, [visibleMethods, editedMetrics, weights, maxima])

  const bestId = useMemo(() => {
    let best: string | null = null
    let bestScore = -1
    for (const [id, s] of Object.entries(scores)) {
      if (s > bestScore) {
        bestScore = s
        best = id
      }
    }
    return best
  }, [scores])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedMethod = selectedId ? sortedMethods.find((m) => m.id === selectedId) ?? null : null
  const selectedResources = selectedId
    ? resources.filter((r) => r.method_id === selectedId)
    : []
  const selectedMedia = selectedId ? media.filter((m) => m.method_id === selectedId) : []

  function updateMetric<K extends keyof Metric>(
    methodId: string,
    field: K,
    value: Metric[K]
  ) {
    setEditedMetrics((prev) => ({
      ...prev,
      [methodId]: { ...prev[methodId], [field]: value },
    }))
  }

  function resetWeights() {
    setWeights({ cost: 20, time: 20, quality: 20, capex: 20, opex: 20 })
  }

  const weightTotal =
    weights.cost + weights.time + weights.quality + weights.capex + weights.opex

  if (sortedMethods.length === 0) {
    return (
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-8 text-center">
        <p className="text-gray-400 text-sm">
          Aucune méthode de production n'est encore disponible pour ce produit.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Sliders pondération */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-white text-sm">Pondération des critères</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Total : <span className="text-[#C9A84C] font-semibold">{weightTotal}%</span> · ajuste
              les curseurs pour recalculer le score optimal en live.
            </p>
          </div>
          <button
            onClick={resetWeights}
            className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/10"
          >
            Réinitialiser 20/20/20/20/20
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <WeightSlider label="Coût" value={weights.cost} onChange={(v) => setWeights((w) => ({ ...w, cost: v }))} />
          <WeightSlider label="Temps" value={weights.time} onChange={(v) => setWeights((w) => ({ ...w, time: v }))} />
          <WeightSlider label="Qualité" value={weights.quality} onChange={(v) => setWeights((w) => ({ ...w, quality: v }))} />
          <WeightSlider label="Capex" value={weights.capex} onChange={(v) => setWeights((w) => ({ ...w, capex: v }))} />
          <WeightSlider label="Opex" value={weights.opex} onChange={(v) => setWeights((w) => ({ ...w, opex: v }))} />
        </div>
      </div>

      {/* Tier banner */}
      {!fullBench && (
        <div className="bg-gradient-to-r from-[#C9A84C]/10 to-transparent border border-[#C9A84C]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-300">
            <span className="font-bold text-[#C9A84C]">Méthode dominante affichée.</span>{' '}
            Passe au plan <span className="text-white font-semibold">Premium (149 €/mois)</span>{' '}
            pour débloquer le comparateur complet ({sortedMethods.length} méthodes).
          </div>
          <Link
            href="/pricing"
            className="shrink-0 px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold text-xs rounded-lg hover:bg-[#E8C97A] transition-colors"
          >
            Débloquer le bench →
          </Link>
        </div>
      )}

      {/* Tableau comparateur */}
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0D1117] z-10">
              <tr className="border-b border-white/10 text-[10px] uppercase text-gray-500">
                <th className="text-left px-4 py-3 font-semibold">Méthode</th>
                <th className="text-right px-3 py-3 font-semibold">Coût /100</th>
                <th className="text-right px-3 py-3 font-semibold">Temps (mois)</th>
                <th className="text-right px-3 py-3 font-semibold">Qualité /100</th>
                <th className="text-right px-3 py-3 font-semibold">Capex (€)</th>
                <th className="text-right px-3 py-3 font-semibold">Opex (€/unité)</th>
                <th className="text-right px-3 py-3 font-semibold">Score pondéré</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleMethods.map((m) => {
                const metric = editedMetrics[m.id] ?? {
                  method_id: m.id,
                  cost_score: 0,
                  time_months: 0,
                  quality_score: 0,
                  capex_eur: 0,
                  opex_eur_per_unit: 0,
                }
                const score = scores[m.id] ?? 0
                const isBest = m.id === bestId && visibleMethods.length > 1
                const isSelected = m.id === selectedId

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors cursor-pointer ${
                      isBest
                        ? 'bg-emerald-500/8 hover:bg-emerald-500/12'
                        : isSelected
                          ? 'bg-[#C9A84C]/8'
                          : 'hover:bg-white/[.03]'
                    }`}
                    onClick={() => setSelectedId(isSelected ? null : m.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {isBest && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0"
                            title="Meilleur score pondéré"
                          >
                            ★ BEST
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600 font-mono shrink-0">
                          #{m.popularity_rank}
                        </span>
                        <span className="font-medium text-white truncate">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <NumberCell
                        value={metric.cost_score ?? 0}
                        min={0}
                        max={100}
                        onChange={(v) => updateMetric(m.id, 'cost_score', Math.min(100, Math.max(0, v)))}
                      />
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <NumberCell
                        value={metric.time_months ?? 0}
                        min={0}
                        step={0.5}
                        onChange={(v) => updateMetric(m.id, 'time_months', v)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <NumberCell
                        value={metric.quality_score ?? 0}
                        min={0}
                        max={100}
                        onChange={(v) =>
                          updateMetric(m.id, 'quality_score', Math.min(100, Math.max(0, v)))
                        }
                      />
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <NumberCell
                        value={metric.capex_eur ?? 0}
                        min={0}
                        step={100}
                        onChange={(v) => updateMetric(m.id, 'capex_eur', v)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <NumberCell
                        value={metric.opex_eur_per_unit ?? 0}
                        min={0}
                        step={0.01}
                        onChange={(v) => updateMetric(m.id, 'opex_eur_per_unit', v)}
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, score)}%`,
                              background: isBest ? '#34D399' : '#C9A84C',
                            }}
                          />
                        </div>
                        <span
                          className="font-bold text-sm tabular-nums w-8 text-right"
                          style={{ color: isBest ? '#34D399' : '#C9A84C' }}
                        >
                          {score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedId(isSelected ? null : m.id)
                        }}
                        className="text-[11px] text-[#C9A84C] hover:underline font-semibold whitespace-nowrap"
                      >
                        {isSelected ? 'Masquer' : 'Détails'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!fullBench && sortedMethods.length > 1 && (
          <div className="border-t border-white/5 px-4 py-3 bg-white/[.015]">
            <div className="text-[11px] text-gray-500 text-center">
              🔒 {sortedMethods.length - 1} autre{sortedMethods.length - 1 > 1 ? 's' : ''} méthode
              {sortedMethods.length - 1 > 1 ? 's' : ''} verrouillée
              {sortedMethods.length - 1 > 1 ? 's' : ''} — passe en Premium pour accéder au bench
              complet.
            </div>
          </div>
        )}
      </div>

      {/* Panneau détail */}
      {selectedMethod && (
        <DetailPanel
          method={selectedMethod}
          resources={selectedResources}
          media={selectedMedia}
          iso={iso}
          productSlug={productSlug}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
