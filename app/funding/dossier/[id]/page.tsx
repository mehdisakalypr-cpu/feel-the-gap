'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'

// Page de saisie dynamique d'un dossier de financement ou d'investissement.
// La structure (sections + questions) est générée côté serveur par
// agents/dossier-builder.ts à la création du dossier, puis stockée dans
// funding_dossiers.structure (jsonb).
//
// Les réponses sont auto-sauvegardées (debounced ~900ms) via PATCH
// /api/funding/dossier/[id] avec localStorage en backup.

// ── Types (mirror of agents/dossier-builder.ts) ─────────────────────────────

type QuestionType =
  | 'text' | 'textarea' | 'number' | 'currency_eur' | 'percent'
  | 'date' | 'select' | 'multiselect' | 'boolean' | 'file'

interface DossierQuestion {
  key: string
  label: string
  type: QuestionType
  required: boolean
  help?: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
}

interface DossierSection {
  key: string
  title: string
  description: string
  questions: DossierQuestion[]
}

interface DossierStructure {
  version: number
  type: 'financement' | 'investissement'
  sections: DossierSection[]
  context?: Record<string, unknown>
  generated_at?: string
}

interface Dossier {
  id: string
  type: 'financement' | 'investissement'
  title: string
  country_iso: string | null
  product_slug: string | null
  amount_eur: number
  status: 'draft' | 'submitted' | 'under_review' | 'matched' | 'archived'
  structure: DossierStructure
  answers: Record<string, unknown>
  completion_pct: number
  updated_at: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function countAnswered(structure: DossierStructure, answers: Record<string, unknown>): { answered: number; total: number; requiredAnswered: number; requiredTotal: number } {
  let answered = 0
  let total = 0
  let requiredAnswered = 0
  let requiredTotal = 0
  for (const section of structure.sections) {
    for (const q of section.questions) {
      total++
      if (q.required) requiredTotal++
      const val = answers[q.key]
      const filled = val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)
      if (filled) {
        answered++
        if (q.required) requiredAnswered++
      }
    }
  }
  return { answered, total, requiredAnswered, requiredTotal }
}

function fmtEur(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

// ── Field component ─────────────────────────────────────────────────────────

function Field({ q, value, onChange }: {
  q: DossierQuestion
  value: unknown
  onChange: (v: unknown) => void
}) {
  const labelEl = (
    <div className="mb-1.5">
      <label className="text-sm font-medium text-gray-200">
        {q.label}
        {q.required && <span className="text-[#F97316] ml-1">*</span>}
      </label>
      {q.help && <p className="text-[11px] text-gray-500 mt-0.5">{q.help}</p>}
    </div>
  )

  const inputBase = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]/50 transition-colors'

  switch (q.type) {
    case 'textarea':
      return (
        <div>
          {labelEl}
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            placeholder={q.placeholder}
            className={inputBase + ' resize-y'}
          />
        </div>
      )
    case 'number':
    case 'percent':
      return (
        <div>
          {labelEl}
          <div className="relative">
            <input
              type="number"
              value={value == null ? '' : String(value)}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={q.placeholder}
              min={q.min}
              max={q.max}
              className={inputBase}
            />
            {q.type === 'percent' && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
            )}
          </div>
        </div>
      )
    case 'currency_eur':
      return (
        <div>
          {labelEl}
          <div className="relative">
            <input
              type="number"
              value={value == null ? '' : String(value)}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              placeholder={q.placeholder}
              min={0}
              className={inputBase + ' pr-8'}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
          </div>
        </div>
      )
    case 'date':
      return (
        <div>
          {labelEl}
          <input
            type="date"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className={inputBase}
          />
        </div>
      )
    case 'boolean':
      return (
        <div>
          {labelEl}
          <div className="flex gap-2">
            {[true, false].map((opt) => (
              <button
                key={String(opt)}
                onClick={() => onChange(opt)}
                type="button"
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: value === opt ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)',
                  border: value === opt ? '1px solid #C9A84C70' : '1px solid rgba(255,255,255,0.1)',
                  color: value === opt ? '#E8C97A' : '#9CA3AF',
                }}
              >
                {opt ? 'Oui' : 'Non'}
              </button>
            ))}
          </div>
        </div>
      )
    case 'select':
      return (
        <div>
          {labelEl}
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputBase + ' bg-[#0D1117]'}
          >
            <option value="">— Sélectionner —</option>
            {(q.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      return (
        <div>
          {labelEl}
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).map((o) => {
              const active = arr.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    const next = active ? arr.filter((v) => v !== o.value) : [...arr, o.value]
                    onChange(next)
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? '#C9A84C20' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid #C9A84C80' : '1px solid rgba(255,255,255,0.12)',
                    color: active ? '#E8C97A' : '#9CA3AF',
                  }}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'file':
      return (
        <div>
          {labelEl}
          <div className="rounded-xl border border-dashed border-white/15 bg-white/3 px-4 py-4 text-xs text-gray-500">
            📎 Upload de pièces justificatives — fonctionnalité en cours d'intégration (Vercel Blob).
            <br />En attendant, décrivez le document dans les commentaires ci-dessous.
          </div>
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Décrivez le document ou collez un lien temporaire"
            className={inputBase + ' mt-2 resize-y'}
          />
        </div>
      )
    case 'text':
    default:
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder}
            className={inputBase}
          />
        </div>
      )
  }
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DossierPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sectionIdx, setSectionIdx] = useState(0)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Load dossier
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/funding/dossier/${id}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? 'Erreur de chargement')
        if (cancelled) return
        const d = j.dossier as Dossier
        setDossier(d)
        // Merge server answers with localStorage backup (server wins on conflict)
        const localKey = `ftg_dossier_${id}`
        let merged = d.answers ?? {}
        try {
          const raw = localStorage.getItem(localKey)
          if (raw) {
            const local = JSON.parse(raw) as Record<string, unknown>
            merged = { ...local, ...merged }
          }
        } catch {}
        setAnswers(merged)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // Debounced auto-save + localStorage backup
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!dossier) return
    // Persist locally immediately (resume-safe)
    try {
      localStorage.setItem(`ftg_dossier_${id}`, JSON.stringify(answers))
    } catch {}
    // Debounced DB save
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingState('saving')
      try {
        const { answered, total, requiredAnswered, requiredTotal } = countAnswered(dossier.structure, answers)
        // completion based on required questions when any, else all
        const pct = requiredTotal > 0
          ? Math.round((requiredAnswered / requiredTotal) * 100)
          : Math.round((answered / Math.max(total, 1)) * 100)
        const res = await fetch(`/api/funding/dossier/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, completion_pct: pct }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
        setSavingState('saved')
        setTimeout(() => setSavingState('idle'), 1500)
      } catch {
        setSavingState('error')
      }
    }, 900)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [answers, dossier, id])

  const stats = useMemo(() => {
    if (!dossier) return { answered: 0, total: 0, requiredAnswered: 0, requiredTotal: 0 }
    return countAnswered(dossier.structure, answers)
  }, [dossier, answers])

  const completionPct = dossier
    ? (stats.requiredTotal > 0
        ? Math.round((stats.requiredAnswered / stats.requiredTotal) * 100)
        : Math.round((stats.answered / Math.max(stats.total, 1)) * 100))
    : 0

  const currentSection = dossier?.structure.sections[sectionIdx]

  async function submitDossier() {
    if (!dossier) return
    if (stats.requiredAnswered < stats.requiredTotal) {
      setError(`Il manque ${stats.requiredTotal - stats.requiredAnswered} réponse(s) obligatoire(s) avant de pouvoir soumettre.`)
      return
    }
    try {
      setSavingState('saving')
      const res = await fetch(`/api/funding/dossier/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, completion_pct: 100, status: 'submitted' }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Submit failed')
      router.push('/account?tab=dossiers')
    } catch (err) {
      setError((err as Error).message)
      setSavingState('error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F]">
        <Topbar />
        <div className="max-w-3xl mx-auto py-16 text-center text-gray-500 text-sm">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          Chargement du dossier…
        </div>
      </div>
    )
  }

  if (error && !dossier) {
    return (
      <div className="min-h-screen bg-[#07090F]">
        <Topbar />
        <div className="max-w-3xl mx-auto py-16 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <Link href="/account" className="text-[#C9A84C] text-sm hover:underline">← Retour au compte</Link>
        </div>
      </div>
    )
  }

  if (!dossier || !currentSection) return null

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">

        {/* Header */}
        <div className="mb-6">
          <div className="text-xs text-gray-500 mb-2">
            <Link href="/account" className="hover:text-gray-300">← Mon compte</Link>
            <span className="mx-2">/</span>
            <span>Dossier {dossier.type === 'financement' ? 'de financement' : 'd\'investissement'}</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl md:text-2xl font-bold mb-1">{dossier.title}</h1>
              <p className="text-sm text-gray-400">
                Montant sollicité : <span className="text-white font-semibold">{fmtEur(dossier.amount_eur)}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Progression</div>
              <div className="text-2xl font-bold" style={{ color: completionPct === 100 ? '#34D399' : '#C9A84C' }}>
                {completionPct}%
              </div>
              <div className="text-[10px] text-gray-600">
                {stats.requiredAnswered}/{stats.requiredTotal} obligatoires
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${completionPct}%`,
                background: 'linear-gradient(90deg, #C9A84C, #34D399)',
              }}
            />
          </div>
        </div>

        {/* Section navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {dossier.structure.sections.map((s, i) => {
            const sectionStats = (() => {
              let filled = 0
              for (const q of s.questions) {
                const val = answers[q.key]
                if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
              }
              return { filled, total: s.questions.length }
            })()
            const done = sectionStats.filled === sectionStats.total && sectionStats.total > 0
            const active = i === sectionIdx
            return (
              <button
                key={s.key}
                onClick={() => setSectionIdx(i)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: active ? '#C9A84C20' : done ? '#34D39915' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid #C9A84C80' : done ? '1px solid #34D39950' : '1px solid rgba(255,255,255,0.1)',
                  color: active ? '#E8C97A' : done ? '#34D399' : '#9CA3AF',
                }}
              >
                {done && '✓ '}{i + 1}. {s.title}
              </button>
            )
          })}
        </div>

        {/* Section content */}
        <div className="rounded-2xl p-5 md:p-6 mb-6" style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)' }}>
          <h2 className="text-lg font-bold mb-1">{currentSection.title}</h2>
          <p className="text-sm text-gray-500 mb-5">{currentSection.description}</p>

          <div className="space-y-5">
            {currentSection.questions.map((q) => (
              <Field
                key={q.key}
                q={q}
                value={answers[q.key]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 mb-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSectionIdx((i) => Math.max(0, i - 1))}
            disabled={sectionIdx === 0}
            className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            ← Précédent
          </button>
          <div className="flex-1 text-center text-xs text-gray-600">
            Section {sectionIdx + 1} / {dossier.structure.sections.length}
            {savingState === 'saving' && <span className="ml-2 text-[#C9A84C]">· sauvegarde…</span>}
            {savingState === 'saved' && <span className="ml-2 text-[#34D399]">· sauvegardé ✓</span>}
            {savingState === 'error' && <span className="ml-2 text-red-400">· erreur de sauvegarde</span>}
          </div>
          {sectionIdx < dossier.structure.sections.length - 1 ? (
            <button
              onClick={() => setSectionIdx((i) => Math.min(dossier.structure.sections.length - 1, i + 1))}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #E8C97A)', color: '#07090F' }}
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={submitDossier}
              disabled={completionPct < 100}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:cursor-not-allowed"
              style={{
                background: completionPct === 100 ? 'linear-gradient(135deg, #34D399, #10B981)' : 'rgba(255,255,255,0.05)',
                color: completionPct === 100 ? '#07090F' : '#6B7280',
                border: completionPct === 100 ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              ✓ Soumettre le dossier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
