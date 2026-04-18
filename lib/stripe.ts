import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Singleton Stripe client — lazy init (env.local doit être chargé avant).
 * Throws si STRIPE_SECRET_KEY manque → handler appelant décide de 503 ou fallback.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY missing')
  _stripe = new Stripe(key, { apiVersion: '2025-03-31.basil' })
  return _stripe
}

/**
 * Indique si Stripe est actuellement configuré (permet aux endpoints de
 * return 503 proprement avec un message clair au lieu de crasher).
 */
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
