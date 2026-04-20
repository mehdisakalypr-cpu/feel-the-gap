// © 2025-2026 Feel The Gap — Stripe Elements payment form (client)
'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

let _stripePromise: Promise<Stripe | null> | null = null
function getStripePromise(): Promise<Stripe | null> {
  if (_stripePromise) return _stripePromise
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
  _stripePromise = pk ? loadStripe(pk) : Promise.resolve(null)
  return _stripePromise
}

interface OuterProps {
  storeSlug: string
  clientSecret: string
  orderId: string
  totalCents: number
  currency?: string
  accent?: string
}

export function PaymentForm(props: OuterProps) {
  const stripePromise = getStripePromise()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    stripePromise.then(s => {
      if (!cancelled) setReady(!!s)
    })
    return () => { cancelled = true }
  }, [stripePromise])

  if (!ready) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6 text-sm text-gray-400">
        Chargement du module de paiement…
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: props.accent || '#C9A84C',
            colorBackground: '#0D1117',
            colorText: '#FFFFFF',
            colorDanger: '#F87171',
            borderRadius: '12px',
          },
        },
      }}
    >
      <Inner {...props} />
    </Elements>
  )
}

function Inner({ storeSlug, orderId, totalCents, currency = 'EUR', accent }: OuterProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || busy) return
    setError(null)
    setBusy(true)
    try {
      const { error: confirmErr } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/store/${encodeURIComponent(storeSlug)}/checkout/success?order_id=${encodeURIComponent(orderId)}`,
        },
      })
      if (confirmErr) {
        setError(confirmErr.message || 'Paiement refusé')
        setBusy(false)
        return
      }
      // confirmPayment redirects on success — we shouldn't reach here in card path,
      // but if no redirect (e.g. SCA-less local methods), fall through to success.
      router.push(`/store/${encodeURIComponent(storeSlug)}/checkout/success?order_id=${encodeURIComponent(orderId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de paiement')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full rounded-xl px-5 py-3 text-sm font-bold text-[#07090F] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: accent || '#C9A84C' }}
      >
        {busy ? 'Traitement…' : `Payer ${(totalCents / 100).toLocaleString('fr-FR', { style: 'currency', currency })}`}
      </button>
      <p className="text-center text-[10px] text-gray-500">
        Paiement sécurisé — propulsé par Stripe. Vos informations bancaires ne sont jamais stockées sur nos serveurs.
      </p>
    </form>
  )
}
