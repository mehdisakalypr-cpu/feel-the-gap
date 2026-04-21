// Funding marketplace subscription tiers (financeur / investisseur).
// Shared by pricing page, Stripe checkout route, webhook and quota checks.

export type InvestorTierKey = 'explorer' | 'active' | 'pro'
export type InvestorRoleKind = 'financeur' | 'investisseur'
export type DurationMonths = 1 | 12 | 24 | 36

// Quota of offers that can be accepted per month (enforced by accept_offer_atomic RPC).
// An "offer sent" does NOT consume quota — only acceptance by the entrepreneur does.
export const INVESTOR_TIER_QUOTA: Record<InvestorTierKey, number> = {
  explorer: 5,
  active: 10,
  pro: 20,
}

// Baseline monthly price in EUR (before geo-pricing multiplier + duration discount + founding pioneer).
export const INVESTOR_TIER_PRICE_EUR: Record<InvestorTierKey, number> = {
  explorer: 39,
  active: 99,
  pro: 249,
}

export const INVESTOR_TIER_LABEL: Record<InvestorTierKey, string> = {
  explorer: 'Explorer',
  active: 'Active',
  pro: 'Pro',
}

export const INVESTOR_TIER_TAGLINE: Record<InvestorTierKey, string> = {
  explorer: 'Accès de découverte — voyez le deal flow, testez quelques propositions.',
  active: 'Tier principal — activité régulière, pipeline de suivi, extra credits à la demande.',
  pro: 'Volume élevé — thèse multi-pays, équipe d\'analyse, SLA de réponse prioritaire.',
}

// Durations matrix — same dégressif as the rest of the FTG pricing page.
// 12mo: -10%, 24mo: -20%, 36mo: -30% on the monthly effective price.
export const INVESTOR_DURATION_DISCOUNT: Record<DurationMonths, number> = {
  1: 0,
  12: 0.10,
  24: 0.20,
  36: 0.30,
}

export const INVESTOR_DURATIONS: Array<{ months: DurationMonths; label: string }> = [
  { months: 1,  label: '1 mois' },
  { months: 12, label: '12 mois (-10%)' },
  { months: 24, label: '24 mois (-20%)' },
  { months: 36, label: '36 mois (-30%)' },
]

// Founding pioneer: first 50 seats get a permanent -30% on any tier.
// Driven by marketplace_state.founding_pioneer_discount_pct + founding_pioneer_used.
export const FOUNDING_PIONEER_DISCOUNT = 0.30

// Extra-credit packs (one-shot) — consumed 1-for-1 when monthly quota is exhausted.
export type ExtraCreditPackKind = 'single' | 'pack5' | 'pack10' | 'pack25'
export const EXTRA_CREDIT_PACKS: Array<{
  kind: ExtraCreditPackKind
  credits: number
  price_eur: number
  unit_price_eur: number
  label: string
}> = [
  { kind: 'single', credits: 1,  price_eur: 12,  unit_price_eur: 12, label: '1 crédit' },
  { kind: 'pack5',  credits: 5,  price_eur: 50,  unit_price_eur: 10, label: '5 crédits' },
  { kind: 'pack10', credits: 10, price_eur: 90,  unit_price_eur: 9,  label: '10 crédits' },
  { kind: 'pack25', credits: 25, price_eur: 200, unit_price_eur: 8,  label: '25 crédits' },
]

/** Apply duration discount then founding pioneer discount. Returns monthly effective price in EUR (rounded). */
export function computeEffectiveMonthly(
  tier: InvestorTierKey,
  duration: DurationMonths,
  foundingPioneer: boolean,
  geoMultiplier = 1,
): { monthlyEffective: number; upfront: number; monthlyBaseline: number; savings: number } {
  const baseline = INVESTOR_TIER_PRICE_EUR[tier] * geoMultiplier
  const afterDuration = baseline * (1 - INVESTOR_DURATION_DISCOUNT[duration])
  const afterPioneer = foundingPioneer ? afterDuration * (1 - FOUNDING_PIONEER_DISCOUNT) : afterDuration
  const monthlyEffective = Math.round(afterPioneer)
  const upfront = Math.round(monthlyEffective * duration)
  const savings = Math.round((baseline - monthlyEffective) * duration)
  return { monthlyEffective, upfront, monthlyBaseline: Math.round(baseline), savings }
}

/** Stripe metadata payload — serialized in checkout session + replayed in webhook. */
export interface FundingSubscriptionMetadata {
  product: 'ftg'
  kind: 'funding_investor_subscription'
  user_id: string
  role_kind: InvestorRoleKind
  tier: InvestorTierKey
  duration_months: string       // stringified DurationMonths
  founding_pioneer: string      // 'true' | 'false'
  quota_month: string           // stringified INVESTOR_TIER_QUOTA[tier]
  geo_country: string
  geo_multiplier: string
  baseline_cents: string
  monthly_effective_cents: string
}
