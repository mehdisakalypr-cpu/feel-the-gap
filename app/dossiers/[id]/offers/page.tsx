'use client'

import { useEffect, useMemo, useState, use as usePromise } from 'react'
import Link from 'next/link'

type ReasonCode = 'ticket_too_low' | 'valuation_unfit' | 'not_aligned' | 'timing' | 'terms_unfavorable' | 'other'
const REASONS: Array<{ code: ReasonCode; label: string }> = [
  { code: 'ticket_too_low',    label: 'Ticket trop bas' },
  { code: 'valuation_unfit',   label: 'Valorisation inadaptée' },
  { code: 'not_aligned',       label: 'Non aligné avec mes besoins' },
  { code: 'timing',            label: 'Timing inadapté' },
  { code: 'terms_unfavorable', label: 'Termes défavorables' },
  { code: 'other',             label: 'Autre' },
]

type Offer = {
  offer_id: string
  kind: 'funding' | 'investor'
  counterparty_id: string
  amount_eur: number
  interest_rate_pct: number | null
  duration_months: number | null
  has_insurance: boolean | null
  fees_eur: number | null
  pct_capital: number | null
  platform_valuation_eur: number | null
  user_valuation_eur: number | null
  valuation_warning_flagged: boolean | null
  message: string | null
  contact_requested: boolean
  status: string
  sent_at: string
  decided_at: string | null
  refusal_reason_code: string | null
  refusal_reason_text: string | null
}

type Payload = {
  dossier: {
    id: string
    public_number: number | null
    type: 'financement' | 'investissement'
    country_iso: string | null
    amount_eur: number
    title: string
    status: string
  }
  offers: Offer[]
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M€'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k€'
  return n.toLocaleString('fr-FR') + ' €'
}

export default function OffersReceivedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refuseTarget, setRefuseTarget] = useState<Offer | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/funding/dossier/${id}/offers-received`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur de chargement')
      setData(j as Payload)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const accent = data?.dossier.type === 'financement' ? '#34D399' : '#60A5FA'
  const groups = useMemo(() => {
    const g = { pending: [] as Offer[], decided: [] as Offer[] }
    for (const o of data?.offers ?? []) {
      if (o.status === 'sent' || o.status === 'draft') g.pending.push(o)
      else g.decided.push(o)
    }
    return g
  }, [data])

  async function accept(offer: Offer) {
    if (busyId) return
    setBusyId(offer.offer_id)
    try {
      const res = await fetch(`/api/funding/offers/${offer.offer_id}/accept?kind=${offer.kind}`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      await load()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/account" className="hover:text-gray-300">← Retour au compte</Link>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Chargement…</div>
        ) : error ? (
          <div className="rounded-xl p-4 text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        ) : !data ? null : (
          <>
            <div className="rounded-3xl p-6 mb-6"
              style={{ background: '#0D1117', border: `1px solid ${accent}25` }}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: accent + '20', color: accent }}>
                  {data.dossier.type.toUpperCase()}
                </span>
                <h1 className="text-xl md:text-2xl font-bold">
                  Dossier #{data.dossier.public_number ?? '—'}
                  {data.dossier.title && <span className="text-gray-400 font-normal"> · {data.dossier.title}</span>}
                </h1>
              </div>
              <div className="text-sm text-gray-400">
                Ticket demandé <span className="text-white font-bold">{fmtEur(data.dossier.amount_eur)}</span>
                {data.dossier.country_iso && <> · 🌍 {data.dossier.country_iso}</>}
                · Statut <span className="text-white">{data.dossier.status}</span>
              </div>
            </div>

            <Section title="À traiter" count={groups.pending.length} color={accent}>
              {groups.pending.length === 0 ? (
                <Empty text="Aucune offre en attente. Les financeurs/investisseurs consultent votre dossier — vous serez notifié à chaque proposition." />
              ) : (
                <div className="space-y-3">
                  {groups.pending.map((o) => (
                    <OfferRow key={o.offer_id} offer={o} accent={accent}
                      onAccept={() => accept(o)}
                      onRefuse={() => setRefuseTarget(o)}
                      busy={busyId === o.offer_id} />
                  ))}
                </div>
              )}
            </Section>

            {groups.decided.length > 0 && (
              <Section title="Historique" count={groups.decided.length} color={accent}>
                <div className="space-y-3">
                  {groups.decided.map((o) => (
                    <OfferRow key={o.offer_id} offer={o} accent={accent} readOnly />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>

      {refuseTarget && (
        <RefuseModal
          offer={refuseTarget}
          accent={accent}
          onClose={() => setRefuseTarget(null)}
          onDone={async () => { setRefuseTarget(null); await load() }}
        />
      )}
    </div>
  )
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-bold">{title}</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: color + '15', color, border: `1px solid ${color}30` }}>{count}</span>
      </div>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl p-8 text-center text-sm text-gray-500"
      style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.05)' }}>
      {text}
    </div>
  )
}

function OfferRow({
  offer, accent, onAccept, onRefuse, busy, readOnly,
}: {
  offer: Offer; accent: string
  onAccept?: () => void; onRefuse?: () => void
  busy?: boolean; readOnly?: boolean
}) {
  const statusLabel = offer.status === 'sent' ? 'Envoyée'
    : offer.status === 'accepted' ? 'Acceptée'
    : offer.status === 'declined' ? 'Refusée' : offer.status
  return (
    <div className="rounded-2xl p-5"
      style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: accent + '20', color: accent }}>
              {offer.kind === 'funding' ? '💰 Offre de crédit' : '📈 Offre equity'}
            </span>
            <span className="text-[10px] text-gray-500">{statusLabel}</span>
            <span className="text-[10px] text-gray-500">· Envoyée le {new Date(offer.sent_at).toLocaleDateString('fr-FR')}</span>
          </div>

          {offer.kind === 'funding' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
              <Field k="Montant" v={fmtEur(offer.amount_eur)} />
              <Field k="Taux" v={offer.interest_rate_pct != null ? `${offer.interest_rate_pct}%` : '—'} />
              <Field k="Durée" v={offer.duration_months != null ? `${offer.duration_months} mois` : '—'} />
              <Field k="Frais" v={offer.fees_eur != null ? fmtEur(offer.fees_eur) : '—'} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
              <Field k="Montant" v={fmtEur(offer.amount_eur)} />
              <Field k="% capital" v={offer.pct_capital != null ? `${offer.pct_capital}%` : '—'} />
              <Field k="Valo plateforme" v={fmtEur(offer.platform_valuation_eur)} />
              <Field k="Valo proposée" v={offer.user_valuation_eur != null ? fmtEur(offer.user_valuation_eur) : '—'} />
            </div>
          )}

          {offer.kind === 'investor' && offer.valuation_warning_flagged && (
            <div className="mt-2 text-xs px-3 py-1.5 rounded-lg inline-block"
              style={{ background: 'rgba(249,115,22,0.1)', color: '#FB923C', border: '1px solid rgba(249,115,22,0.3)' }}>
              ⚠️ Contre-proposition à valorisation différente
            </div>
          )}

          {offer.message && (
            <div className="mt-3 text-sm text-gray-300 rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              « {offer.message} »
            </div>
          )}

          {offer.status === 'declined' && offer.refusal_reason_code && (
            <div className="mt-2 text-xs" style={{ color: '#F87171' }}>
              Refusé · {offer.refusal_reason_code}
              {offer.refusal_reason_text && <span className="text-gray-500"> — « {offer.refusal_reason_text} »</span>}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="shrink-0 flex flex-col gap-2 min-w-[160px]">
            <button onClick={onAccept} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: '#34D399', color: '#07090F' }}>
              {busy ? '…' : '✅ Accepter'}
            </button>
            <button onClick={onRefuse} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              ❌ Refuser
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase mb-0.5">{k}</div>
      <div className="text-sm text-white font-medium">{v}</div>
    </div>
  )
}

function RefuseModal({ offer, accent, onClose, onDone }: { offer: Offer; accent: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ReasonCode>('not_aligned')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/funding/offers/${offer.offer_id}/refuse?kind=${offer.kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason_code: reason, reason_text: text.slice(0, 500) }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      onDone()
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
      <div className="max-w-md w-full rounded-3xl p-6 md:p-8"
        style={{ background: '#0D1117', border: `1px solid ${accent}40` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold">Refuser cette offre</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Après 3 refus, le dossier est placé en revue par notre équipe pour vérifier sa qualité. Indiquez une raison claire.
        </p>

        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <label key={r.code}
              className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: reason === r.code ? accent + '15' : 'rgba(255,255,255,0.03)',
                border: reason === r.code ? `1px solid ${accent}60` : '1px solid rgba(255,255,255,0.08)',
              }}>
              <input type="radio" name="reason" value={r.code} checked={reason === r.code}
                onChange={() => setReason(r.code)} className="w-4 h-4" />
              <span className="text-sm" style={{ color: reason === r.code ? accent : '#D1D5DB' }}>{r.label}</span>
            </label>
          ))}
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={3} placeholder="Précisez (facultatif, 500 car.)"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-y mb-4" />

        {error && (
          <div className="rounded-xl p-3 mb-3 text-xs text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Annuler
          </button>
          <button onClick={submit} disabled={submitting}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.4)' }}>
            {submitting ? 'Envoi…' : 'Confirmer le refus'}
          </button>
        </div>
      </div>
    </div>
  )
}
