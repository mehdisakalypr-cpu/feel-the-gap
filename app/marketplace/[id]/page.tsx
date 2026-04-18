'use client'

/**
 * /marketplace/[id] — détail d'un match + UI escrow Stripe Connect
 * Vague 1 #1b · 2026-04-18
 *
 * Flow :
 * 1. Buyer voit match `confirmed` + escrow `not_initiated` → bouton "Initier escrow"
 *    → POST /api/marketplace/[id]/escrow/create → client_secret → Stripe Elements
 *    → après confirmPayment réussi → escrow_status = 'pending_capture' (webhook confirme)
 * 2. Livraison reçue → bouton "Confirmer livraison" (POD)
 *    → POST /api/marketplace/[id]/escrow/release → capture PI → released
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/Topbar'
import { supabase } from '@/lib/supabase'
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

type Match = {
  id: string
  status: string
  match_score: number
  proposed_quantity_kg: number
  proposed_price_eur_per_kg: number
  proposed_total_eur: number
  commission_rate_pct: number
  commission_amount_eur: number
  stripe_payment_intent_id: string | null
  escrow_status: string
  escrow_initiated_at: string | null
  escrow_released_at: string | null
  pod_confirmed_at: string | null
  pod_notes: string | null
  volume: { id: string; producer_id: string; product_slug: string; product_label: string; country_iso: string } | null
  demand: { id: string; buyer_id: string; product_slug: string } | null
}

const ESCROW_LABEL: Record<string, { label: string; color: string }> = {
  not_initiated:   { label: 'Escrow non initié',          color: 'bg-white/5 border-white/10 text-gray-300' },
  pending_capture: { label: 'En attente de livraison',    color: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  released:        { label: 'Escrow libéré ✅',            color: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  refunded:        { label: 'Remboursé',                   color: 'bg-violet-500/15 border-violet-500/40 text-violet-300' },
  canceled:        { label: 'Annulé',                      color: 'bg-white/5 border-white/10 text-gray-400' },
  failed:          { label: 'Paiement échoué',             color: 'bg-red-500/15 border-red-500/30 text-red-400' },
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposé',
  accepted_producer: 'Accepté producteur',
  accepted_buyer: 'Accepté acheteur',
  confirmed: 'Confirmé 🎉',
  rejected: 'Rejeté',
  expired: 'Expiré',
}

function fmtEur(v: number | null | undefined, digits = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-FR', { maximumFractionDigits: digits }) + ' €'
}

function fmtKg(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000) return (v / 1000).toFixed(1) + ' t'
  return v.toLocaleString('fr-FR') + ' kg'
}

// ── Stripe PaymentElement modal ──────────────────────────────────────────
function EscrowPayForm({ matchId, onSuccess }: { matchId: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr(null)

    // On a ouvert le PI en capture_method='manual' → confirmPayment l'amène à
    // requires_capture (funds held). Webhook déclenchera pas succeeded ici : le
    // PI sera captured côté /escrow/release. redirect='if_required' évite le
    // fullpage redirect sauf 3DS.
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/marketplace/${matchId}` },
      redirect: 'if_required',
    })

    setSubmitting(false)
    if (error) {
      setErr(error.message ?? 'Erreur paiement.')
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      {err && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{err}</div>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full px-4 py-2.5 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Autorisation…' : 'Autoriser le paiement (fonds en escrow)'}
      </button>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Les fonds sont bloqués jusqu'à confirmation de livraison. Rien n'est transféré au producteur avant votre validation.
      </p>
    </form>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params?.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  // Escrow payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null)

  // POD release state
  const [showPodModal, setShowPodModal] = useState(false)
  const [podNotes, setPodNotes] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/marketplace/${matchId}/escrow`, { cache: 'no-store' })
    if (res.status === 401) { router.push('/auth/login?next=/marketplace/' + matchId); return }
    if (res.status === 403) { setError('forbidden'); setLoading(false); return }
    if (res.status === 404) { setError('not_found'); setLoading(false); return }
    const json = await res.json()
    setMatch(json as Match)
    setLoading(false)
  }, [matchId, router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      setUserId(data?.user?.id ?? null)
      await reload()
    })()
    return () => { cancelled = true }
  }, [reload])

  async function initiateEscrow() {
    if (busy) return
    setBusy(true); setFlash(null)
    try {
      const res = await fetch(`/api/marketplace/${matchId}/escrow/create`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setFlash(`❌ ${json.message ?? json.error ?? 'Erreur.'}`)
        return
      }
      // Load Stripe.js with publishable key
      const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      if (!pk) {
        setFlash('❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant côté client.')
        return
      }
      setStripePromise(loadStripe(pk))
      setClientSecret(json.client_secret as string)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function releaseEscrow() {
    if (busy) return
    setBusy(true); setFlash(null)
    try {
      const res = await fetch(`/api/marketplace/${matchId}/escrow/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pod_notes: podNotes.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setFlash(`❌ ${json.message ?? json.error ?? 'Erreur release.'}`)
        return
      }
      setFlash(`✅ Escrow libéré — ${fmtEur(json.amount_released_eur)} transférés (commission ${fmtEur(json.commission_collected_eur)}).`)
      setShowPodModal(false); setPodNotes('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white">
        <Topbar />
        <div className="max-w-3xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen bg-[#07090F] text-white">
        <Topbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="text-sm text-gray-400">Vous n'êtes ni le producteur ni l'acheteur de ce match.</p>
          <Link href="/marketplace" className="text-sm text-[#C9A84C] hover:underline">← Retour au marketplace</Link>
        </div>
      </div>
    )
  }

  if (error === 'not_found' || !match) {
    return (
      <div className="min-h-screen bg-[#07090F] text-white">
        <Topbar />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-bold">Match introuvable</h1>
          <Link href="/marketplace" className="text-sm text-[#C9A84C] hover:underline">← Retour au marketplace</Link>
        </div>
      </div>
    )
  }

  const isBuyer    = userId != null && match.demand?.buyer_id === userId
  const isProducer = userId != null && match.volume?.producer_id === userId
  const escrowMeta = ESCROW_LABEL[match.escrow_status] ?? ESCROW_LABEL.not_initiated

  const canInitiate = isBuyer && match.status === 'confirmed' && match.escrow_status === 'not_initiated'
  const canRelease  = isBuyer && match.escrow_status === 'pending_capture'

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <Topbar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        <Link href="/marketplace" className="text-xs text-gray-500 hover:text-[#C9A84C] inline-block">
          ← Retour au marketplace
        </Link>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[#C9A84C]">Match #{match.id.slice(0, 8)}</div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {match.volume?.product_label ?? match.volume?.product_slug ?? '—'} · {match.volume?.country_iso ?? '—'}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 bg-[#C9A84C]/15 border border-[#C9A84C]/40 rounded-full">
              Score {match.match_score}
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-300">
              {STATUS_LABEL[match.status] ?? match.status}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${escrowMeta.color}`}>
              {escrowMeta.label}
            </span>
          </div>
        </div>

        {flash && (
          <div className={`p-3 rounded-lg text-sm border ${flash.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {flash}
          </div>
        )}

        {/* Détails */}
        <section className="p-5 bg-[#0D1117] border border-white/10 rounded-2xl space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Conditions proposées</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500">Quantité</div>
              <div className="font-semibold">{fmtKg(match.proposed_quantity_kg)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">Prix / kg</div>
              <div className="font-semibold">{fmtEur(match.proposed_price_eur_per_kg)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">Total</div>
              <div className="font-bold text-[#C9A84C]">{fmtEur(match.proposed_total_eur)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">Commission {match.commission_rate_pct}%</div>
              <div className="font-semibold text-emerald-300">{fmtEur(match.commission_amount_eur)}</div>
            </div>
          </div>
        </section>

        {/* Rôle utilisateur */}
        <div className="text-[11px] text-gray-500">
          Vous êtes : {isBuyer ? 'Acheteur' : isProducer ? 'Producteur' : '—'}
        </div>

        {/* Escrow flow */}
        <section className="p-5 bg-[#0D1117] border border-[#C9A84C]/30 rounded-2xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-300">Paiement séquestré (Escrow Stripe Connect)</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${escrowMeta.color}`}>{escrowMeta.label}</span>
          </div>

          {/* Timeline */}
          <div className="space-y-1 text-[11px] text-gray-500">
            {match.escrow_initiated_at && <div>· Escrow initié le {new Date(match.escrow_initiated_at).toLocaleString('fr-FR')}</div>}
            {match.pod_confirmed_at     && <div>· POD confirmé le {new Date(match.pod_confirmed_at).toLocaleString('fr-FR')}</div>}
            {match.escrow_released_at   && <div>· Fonds libérés le {new Date(match.escrow_released_at).toLocaleString('fr-FR')}</div>}
            {match.pod_notes            && <div className="text-gray-400 mt-1">« {match.pod_notes} »</div>}
          </div>

          {/* Buyer : Initier */}
          {canInitiate && !clientSecret && (
            <button
              onClick={initiateEscrow}
              disabled={busy}
              className="w-full px-4 py-3 bg-[#C9A84C] text-[#07090F] font-bold text-sm rounded-xl hover:bg-[#E8C97A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Création de l\'escrow…' : `🔒 Initier l'escrow · ${fmtEur(match.proposed_total_eur)}`}
            </button>
          )}

          {/* Buyer : Stripe Elements après création */}
          {clientSecret && stripePromise && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: { colorPrimary: '#C9A84C', colorBackground: '#0D1117' },
                },
              }}
            >
              <EscrowPayForm
                matchId={matchId}
                onSuccess={() => {
                  setFlash('✅ Paiement autorisé. Fonds en escrow jusqu\'à livraison.')
                  setClientSecret(null)
                  reload()
                }}
              />
            </Elements>
          )}

          {/* Buyer : Confirmer livraison */}
          {canRelease && !showPodModal && (
            <button
              onClick={() => setShowPodModal(true)}
              disabled={busy}
              className="w-full px-4 py-3 bg-emerald-500 text-[#07090F] font-bold text-sm rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              📦 Confirmer la livraison (POD) — libérer les fonds
            </button>
          )}

          {canRelease && showPodModal && (
            <div className="space-y-3 p-4 bg-black/30 border border-emerald-500/30 rounded-xl">
              <label className="block text-xs text-gray-300">Notes POD (optionnel)</label>
              <textarea
                value={podNotes}
                onChange={(e) => setPodNotes(e.target.value.slice(0, 2000))}
                rows={3}
                placeholder="N° de bon de livraison, état marchandise, date réception…"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={releaseEscrow}
                  disabled={busy}
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-[#07090F] font-bold text-sm rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? 'Capture en cours…' : 'Valider & libérer les fonds'}
                </button>
                <button
                  onClick={() => { setShowPodModal(false); setPodNotes('') }}
                  className="px-4 py-2.5 bg-white/5 text-gray-300 text-sm rounded-xl hover:bg-white/10"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Informational states */}
          {!canInitiate && !canRelease && !clientSecret && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {match.status !== 'confirmed' && 'Le match doit être confirmé (producteur + acheteur) avant d\'initier l\'escrow.'}
              {match.status === 'confirmed' && match.escrow_status === 'released' && 'Transaction complétée ✅'}
              {match.status === 'confirmed' && match.escrow_status === 'pending_capture' && !isBuyer && 'L\'acheteur a autorisé le paiement. En attente de livraison + POD.'}
              {isProducer && match.escrow_status === 'not_initiated' && match.status === 'confirmed' && 'Match confirmé. L\'acheteur doit maintenant initier le paiement escrow.'}
            </p>
          )}
        </section>

      </div>
    </div>
  )
}
