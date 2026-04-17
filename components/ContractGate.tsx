'use client'

/**
 * ContractGate — scroll-gated modal + typed signature.
 *
 * Flow:
 *   1. Iframe loads /api/contracts/template/[plan]?embed=1
 *   2. Embedded template postMessage({type:'scrolled-to-bottom'}) when user reaches bottom
 *   3. Checkbox enables, user ticks "I accept"
 *   4. User types full name (min 3 chars)
 *   5. POST /api/contracts/accept → DB row + Resend receipt
 *   6. onAccepted(result) fires → caller performs next step (signup finalize / Stripe redirect)
 *
 * Non-intrusive: if the user dismisses, onCancel runs and nothing is signed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type ContractGateAgreement = 'data' | 'strategy' | 'premium' | 'account_signup'

export type ContractGateResult = {
  id: string
  plan: ContractGateAgreement
  version: string
  agreement_hash_sha256: string
  signed_at: string
}

type Props = {
  agreement: ContractGateAgreement
  email: string
  purchaseIntent?: Record<string, unknown>
  onAccepted: (result: ContractGateResult) => void
  onCancel: () => void
  lang?: 'fr' | 'en'
}

const TITLES: Record<ContractGateAgreement, { fr: string; en: string }> = {
  data:            { fr: 'Abonnement Data — 29 €/mois',     en: 'Data Subscription — 29 €/month' },
  strategy:        { fr: 'Abonnement Strategy — 99 €/mois', en: 'Strategy Subscription — 99 €/month' },
  premium:         { fr: 'Abonnement Premium — 149 €/mois', en: 'Premium Subscription — 149 €/month' },
  account_signup:  { fr: 'Conditions du compte gratuit',    en: 'Free account terms' },
}

export default function ContractGate({
  agreement,
  email,
  purchaseIntent = {},
  onAccepted,
  onCancel,
  lang = 'fr',
}: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [checked, setChecked]   = useState(false)
  const [typedName, setTypedName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedAt = useRef<number>(Date.now())
  const scrolledAt = useRef<number | null>(null)

  const title = TITLES[agreement][lang]
  const iframeSrc = `/api/contracts/template/${agreement}?embed=1`

  const t = useMemo(() => ({
    fr: {
      header: 'Validation du contrat',
      subtitle: 'Avant de continuer, lisez le document jusqu\'à la fin puis signez avec votre nom complet.',
      scrollPrompt: 'Faites défiler jusqu\'à la fin pour activer la signature',
      accept: (ttl: string) => `J'ai lu et j'accepte « ${ttl} »`,
      typedNameLabel: 'Votre nom et prénom',
      typedNamePlaceholder: 'Prénom Nom',
      submit: 'Je signe et je continue',
      cancel: 'Annuler',
      sending: 'Signature en cours…',
      receiptInfo: 'Un reçu signé sera envoyé à',
      legal: 'Votre IP, User-Agent, nom et l\'horodatage sont conservés 10 ans à titre de preuve légale.',
      scrolledBadge: 'Lu jusqu\'à la fin',
      scrollMore: 'Faites défiler…',
    },
    en: {
      header: 'Contract review',
      subtitle: 'Please scroll to the end of the document and sign with your full legal name before continuing.',
      scrollPrompt: 'Scroll to the end to enable the signature field',
      accept: (ttl: string) => `I have read and accept "${ttl}"`,
      typedNameLabel: 'Your full name',
      typedNamePlaceholder: 'Firstname Lastname',
      submit: 'Sign and proceed',
      cancel: 'Cancel',
      sending: 'Signing…',
      receiptInfo: 'A signed receipt will be sent to',
      legal: 'Your IP, User-Agent, typed name and timestamp are retained for 10 years as legal evidence.',
      scrolledBadge: 'Read to the end',
      scrollMore: 'Scroll down…',
    },
  }[lang]), [lang])

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== 'object') return
      const data = ev.data as { type?: string; plan?: string }
      if (data.type === 'scrolled-to-bottom' && data.plan === agreement && !scrolled) {
        setScrolled(true)
        scrolledAt.current = Date.now()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [agreement, scrolled])

  // Lock background scroll while modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const canSubmit = scrolled && checked && typedName.trim().length >= 3 && !submitting

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const timeOnDoc = scrolledAt.current ? scrolledAt.current - mountedAt.current : Date.now() - mountedAt.current
      const res = await fetch('/api/contracts/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: agreement,
          email,
          typed_name: typedName.trim(),
          purchase_intent: purchaseIntent,
          time_on_doc_ms: Math.max(0, timeOnDoc),
          total_time_on_page_ms: Date.now() - mountedAt.current,
          scroll_completed: true,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) {
        throw new Error(j.error ?? 'acceptance_failed')
      }
      onAccepted({
        id: j.id,
        plan: j.plan,
        version: j.version,
        agreement_hash_sha256: j.agreement_hash_sha256,
        signed_at: j.signed_at,
      })
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }, [agreement, canSubmit, email, onAccepted, purchaseIntent, typedName])

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
         role="dialog" aria-modal="true" aria-labelledby="cg-title">
      <div className="bg-[#0D1117] border border-[rgba(201,168,76,.25)] rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col">

        <header className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="cg-title" className="text-base sm:text-lg font-bold text-white truncate">{t.header} — {title}</h2>
            <p className="text-xs text-gray-400 mt-1">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded shrink-0"
            aria-label={t.cancel}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-hidden p-3 sm:p-4">
          <div className="relative rounded-xl overflow-hidden border border-white/10">
            <iframe
              src={iframeSrc}
              className="w-full h-[48vh] sm:h-[52vh] bg-[#07090F]"
              title={title}
            />
            <div className="absolute top-2 right-2">
              {scrolled ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  ✓ {t.scrolledBadge}
                </span>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  ↓ {t.scrollMore}
                </span>
              )}
            </div>
          </div>
        </div>

        <footer className="p-4 sm:p-5 border-t border-white/10 space-y-3">
          <label className={`flex items-center gap-3 cursor-pointer ${!scrolled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              disabled={!scrolled}
              checked={checked}
              onChange={() => setChecked(v => !v)}
              className="w-5 h-5 accent-[#C9A84C]"
            />
            <span className="text-sm text-white/90">
              {scrolled ? t.accept(title) : t.scrollPrompt}
            </span>
          </label>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">{t.typedNameLabel}</label>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={t.typedNamePlaceholder}
              disabled={!checked}
              minLength={3}
              className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-[rgba(201,168,76,.15)] text-white text-sm focus:outline-none focus:border-[#C9A84C] disabled:opacity-50"
            />
          </div>

          <p className="text-[11px] text-gray-500 leading-relaxed">
            {t.receiptInfo} <span className="text-[#C9A84C]">{email}</span>. {t.legal}
          </p>

          {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-white/15 text-white/80 hover:bg-white/5 disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={`px-4 py-2 text-sm rounded-lg font-bold transition ${
                canSubmit
                  ? 'bg-[#C9A84C] text-[#07090F] hover:bg-[#E8C97A]'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? t.sending : t.submit}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
