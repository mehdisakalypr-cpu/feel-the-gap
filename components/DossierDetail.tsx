'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Shared dossier detail view used by /finance/reports/[id] and /invest/reports/[id].
// Shows anonymized content by default, with inline offer/proposal form.

interface DossierSection {
  key: string
  title: string
  description: string
  questions: Array<{
    key: string
    label: string
    type: string
    required: boolean
    help?: string
  }>
}

interface Dossier {
  id: string
  type: 'financement' | 'investissement'
  title: string
  country_iso: string | null
  product_slug: string | null
  amount_eur: number
  status: string
  quality_score: number | null
  public_number: number | null
  submitted_at: string | null
  completion_pct: number
  structure: { sections: DossierSection[] }
  answers: Record<string, unknown>
  access_level: 'full' | 'anonymized'
}

function fmtEur(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

function fmtValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'number') return v.toLocaleString('fr-FR')
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

interface DossierDetailProps {
  dossierId: string
  accentColor: string
  baseHref: string
}

export default function DossierDetail({ dossierId, accentColor, baseHref }: DossierDetailProps) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showOfferForm, setShowOfferForm] = useState(false)

  useEffect(() => {
    fetch(`/api/funding/dossiers/${dossierId}/view`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setDossier(j.dossier)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [dossierId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500 text-sm">
        <div className="w-10 h-10 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: accentColor + ' transparent transparent transparent' }} />
        Chargement du dossier…
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-red-300 text-sm mb-4">{error || 'Dossier introuvable'}</p>
        <Link href={baseHref} className="text-sm hover:underline" style={{ color: accentColor }}>← Retour au deal flow</Link>
      </div>
    )
  }

  const isPremium = dossier.access_level === 'full'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-4">
        <Link href={baseHref} className="hover:text-gray-300">← Retour au deal flow</Link>
      </div>

      {/* Header */}
      <div className="rounded-3xl p-6 md:p-8 mb-6"
        style={{ background: '#0D1117', border: `1px solid ${accentColor}25` }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: accentColor + '15', border: `1px solid ${accentColor}40` }}>
            <div className="text-center">
              <div className="text-xl font-bold" style={{ color: accentColor }}>
                {dossier.quality_score ?? '—'}
              </div>
              <div className="text-[8px] text-gray-500 -mt-1">/100</div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl md:text-2xl font-bold text-white">{dossier.title}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: accentColor + '20', color: accentColor }}>
                {dossier.type.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
              {dossier.country_iso && <span>🌍 {dossier.country_iso}</span>}
              {dossier.product_slug && <span>· 📦 {dossier.product_slug}</span>}
              <span>· 📅 {dossier.submitted_at ? new Date(dossier.submitted_at).toLocaleDateString('fr-FR') : '—'}</span>
              <span>· ✅ Complété {dossier.completion_pct}%</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-gray-500 uppercase">Ticket demandé</div>
            <div className="text-2xl font-bold" style={{ color: accentColor }}>{fmtEur(dossier.amount_eur)}</div>
          </div>
        </div>
      </div>

      {/* Access level banner */}
      {!isPremium && (
        <div className="mb-6 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <span className="text-xl">🔒</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white mb-1">Vue anonymisée</div>
            <div className="text-xs text-gray-400 mb-2">
              Vous voyez une version anonymisée de ce dossier. Identité de l'entreprise, fondateurs, SIREN et coordonnées
              sont masqués. Souscrivez à {dossier.type === 'financement' ? 'Finance Premium' : 'Invest Premium'} pour
              accéder au dossier complet et faire une proposition.
            </div>
            <Link href={`/pricing/funding?role=${dossier.type === 'financement' ? 'financeur' : 'investisseur'}`}
              className="inline-block text-xs font-semibold hover:underline" style={{ color: accentColor }}>
              Voir les tarifs Premium →
            </Link>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-5">
        {dossier.structure.sections.map((section) => (
          <div key={section.key} className="rounded-2xl p-5 md:p-6"
            style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-base font-bold text-white mb-1">{section.title}</h2>
            {section.description && <p className="text-xs text-gray-500 mb-4">{section.description}</p>}
            <dl className="space-y-3">
              {section.questions.map((q) => {
                const val = dossier.answers[q.key]
                const isRedacted = typeof val === 'string' && val.includes('•••')
                return (
                  <div key={q.key} className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <dt className="text-gray-400 text-xs md:text-sm">{q.label}</dt>
                    <dd className="md:col-span-2 text-gray-200"
                      style={{ color: isRedacted ? '#9CA3AF' : undefined }}>
                      {fmtValue(val)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* Offer CTA */}
      <div className="mt-8 rounded-3xl p-6 text-center"
        style={{ background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`, border: `1px solid ${accentColor}30` }}>
        <h3 className="text-lg font-bold text-white mb-2">
          {dossier.type === 'financement' ? 'Intéressé ? Proposez une offre de financement' : 'Intéressé ? Proposez une offre d\'investissement'}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {dossier.type === 'financement'
            ? 'Indiquez vos conditions : taux, durée, montant, assurance, frais. L\'entrepreneur sera notifié et pourra accepter, refuser ou négocier.'
            : 'Proposez un ticket avec % equity (max 33%). Vous pouvez contre-proposer à une valorisation différente — un warning sera envoyé aux deux parties.'}
        </p>
        {isPremium ? (
          <button
            onClick={() => setShowOfferForm(true)}
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}
          >
            {dossier.type === 'financement' ? '💰 Proposer un financement' : '📈 Proposer un investissement'}
          </button>
        ) : (
          <Link href={`/pricing/funding?role=${dossier.type === 'financement' ? 'financeur' : 'investisseur'}`}
            className="inline-block px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
            🔓 Débloquer Premium pour faire une offre
          </Link>
        )}
      </div>

      {/* Offer form modal */}
      {showOfferForm && isPremium && (
        <OfferFormModal
          dossier={dossier}
          accentColor={accentColor}
          onClose={() => setShowOfferForm(false)}
        />
      )}
    </div>
  )
}

// ── Offer form modal ──────────────────────────────────────────────────────

function OfferFormModal({ dossier, accentColor, onClose }: {
  dossier: Dossier
  accentColor: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Financement form state
  const [amount, setAmount] = useState(dossier.amount_eur)
  const [rate, setRate] = useState(5.5)
  const [durationMonths, setDurationMonths] = useState(60)
  const [hasInsurance, setHasInsurance] = useState(false)
  const [fees, setFees] = useState(0)
  const [message, setMessage] = useState('')

  // Investissement form state
  const [pctCapital, setPctCapital] = useState(10)
  const [platformValuation, setPlatformValuation] = useState(2_800_000) // placeholder — real = from dossier
  const [userValuation, setUserValuation] = useState<number | null>(null)
  const [isCounterProposal, setIsCounterProposal] = useState(false)

  const effectiveValuation = isCounterProposal && userValuation != null ? userValuation : platformValuation
  const investmentFromPct = (pctCapital / 100) * effectiveValuation

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const body = dossier.type === 'financement' ? {
        kind: 'funding' as const,
        dossier_id: dossier.id,
        amount_eur: amount,
        interest_rate_pct: rate,
        duration_months: durationMonths,
        has_insurance: hasInsurance,
        fees_eur: fees,
        message,
      } : {
        kind: 'investor' as const,
        dossier_id: dossier.id,
        pct_capital: pctCapital,
        platform_valuation_eur: platformValuation,
        user_valuation_eur: isCounterProposal ? userValuation : null,
        amount_eur: investmentFromPct,
        message,
      }
      const res = await fetch('/api/funding/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      setSuccess(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8"
        style={{ background: '#0D1117', border: `1px solid ${accentColor}40` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              {dossier.type === 'financement' ? 'Proposer un financement' : 'Proposer un investissement'}
            </h2>
            <p className="text-xs text-gray-500">{dossier.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-white font-bold mb-2">Offre envoyée !</div>
            <div className="text-sm text-gray-400 mb-4">L'entrepreneur sera notifié et pourra répondre depuis son compte.</div>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: accentColor, color: '#07090F' }}>
              Fermer
            </button>
          </div>
        ) : dossier.type === 'financement' ? (
          <div className="space-y-4">
            <Field label="Montant proposé (€)" required>
              <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <div className="text-[10px] text-gray-500 mt-1">Demandé : {fmtEur(dossier.amount_eur)} — vous pouvez proposer partiellement ou totalement</div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux (%)" required>
                <input type="number" step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </Field>
              <Field label="Durée (mois)" required>
                <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assurance incluse">
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setHasInsurance(v)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium"
                      style={{
                        background: hasInsurance === v ? accentColor + '20' : 'rgba(255,255,255,0.04)',
                        border: hasInsurance === v ? `1px solid ${accentColor}60` : '1px solid rgba(255,255,255,0.1)',
                        color: hasInsurance === v ? accentColor : '#9CA3AF',
                      }}>
                      {v ? 'Oui' : 'Non'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Frais dossier (€)">
                <input type="number" value={fees} onChange={(e) => setFees(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </Field>
            </div>
            <Field label="Message">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Conditions particulières, covenants, garanties demandées…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-y" />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <div className="text-[10px] text-gray-500 uppercase mb-1">Valorisation proposée par l'entrepreneur</div>
              <div className="text-lg font-bold text-white">{fmtEur(platformValuation)}</div>
            </div>

            <Field label="% capital demandé (max 33%)" required>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={33} step={0.5}
                  value={pctCapital} onChange={(e) => setPctCapital(Number(e.target.value))}
                  className="flex-1" style={{ accentColor }} />
                <div className="w-16 text-right font-bold text-white">{pctCapital.toFixed(1)} %</div>
              </div>
            </Field>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="counter" checked={isCounterProposal} onChange={(e) => setIsCounterProposal(e.target.checked)}
                className="w-4 h-4" />
              <label htmlFor="counter" className="text-sm text-gray-300">Contre-proposer à une valorisation différente</label>
            </div>

            {isCounterProposal && (
              <Field label="Votre valorisation pré-money (€)" required>
                <input type="number" value={userValuation ?? ''} onChange={(e) => setUserValuation(e.target.value ? Number(e.target.value) : null)}
                  placeholder="ex: 1800000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                <div className="text-[10px] text-orange-400 mt-1">
                  ⚠️ Un warning sera envoyé à l'entrepreneur indiquant que vous contestez sa valorisation.
                </div>
              </Field>
            )}

            <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <div className="text-[10px] text-gray-500 uppercase mb-1">Montant investi effectif</div>
              <div className="text-2xl font-bold text-[#34D399]">{fmtEur(investmentFromPct)}</div>
              <div className="text-xs text-gray-500 mt-1">
                = {pctCapital}% × {fmtEur(effectiveValuation)}
              </div>
            </div>

            <Field label="Message">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Thèse, attentes en gouvernance, exit envisagé…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-y" />
            </Field>
          </div>
        )}

        {error && !success && (
          <div className="rounded-xl p-3 mt-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {!success && (
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Annuler
            </button>
            <button onClick={submit} disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: '#07090F' }}>
              {submitting ? 'Envoi…' : 'Envoyer l\'offre →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1.5">
        {label}
        {required && <span className="text-[#F97316] ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
