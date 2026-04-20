/**
 * FTG — Credit cost catalog
 *
 * Toute action facturée doit être listée ici. 1 crédit ≈ €0.50-€0.90 selon pack acheté.
 * Actions gratuites (vue carte, résumé pays top-5) n'utilisent pas ce catalog.
 */

export const CREDIT_COSTS = {
  opportunity_view: 1,          // Voir détail opportunité (HS code, volumes, concurrents, prix, buyers)
  bp_generate: 10,              // Générer business plan PDF 15-30p
  export_buyer: 5,              // Exporter contact buyer (par entry)
  export_exporter: 5,           // Exporter contact exporter (par entry)
  outreach: 1,                  // Envoyer outreach via FTG (par contact)
  custom_study: 25,             // Demande custom study LLM deep research
  deal_room_match: 5,           // Match qualifié dans deal room entrepreneur↔buyer
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

/** Tier plans: crédits inclus par mois. Free = 0 (Demo BP statique gratuit). */
export const PLAN_MONTHLY_GRANT = {
  free: 0,
  solo_producer: 30,  // 1 pays × 1 opportunité × parcours complet (cultiver + vendre local-to-local)
  starter: 60,
  strategy: 100,
  premium: 200,
  ultimate: 500,    // generous quota; Ultimate also caps Fill-the-Gap usage at 250 opps/mo (separate counter)
  custom: 10000, // enterprise/agency pré-set ajustable au deal
} as const

export type PlanTier = keyof typeof PLAN_MONTHLY_GRANT

/** Confirmed ladder 2026-04-17: 19.99 / 29 / 99 / 149 / 299 — aligned with BUSINESS_MODELS.md. */
export const PLAN_PRICE_EUR = {
  free: 0,
  solo_producer: 19.99,
  starter: 29,
  strategy: 99,
  premium: 149,
  ultimate: 299,
  custom: 0, // sur devis
} as const

/** Fill the Gap monthly quota par tier (videos, clients, store, recap, AI engine,
 * bulk business plans). Auto-reset le 1er du mois à 00:01 UTC, rollover = 0.
 * Déclenché au passage Feel the Gap -> Fill the Gap. Stocké côté DB dans
 * `user_fillthegap_quota` (RPC `debit_fillthegap` / `fillthegap_balance`). */
export const FILLTHEGAP_QUOTA_BY_TIER = {
  free: 0,
  solo_producer: 0,
  starter: 0,
  strategy: 0,
  premium: 150,
  ultimate: 250,
  custom: 0,
} as const

/** @deprecated use FILLTHEGAP_QUOTA_BY_TIER.ultimate */
export const ULTIMATE_FILL_QUOTA = FILLTHEGAP_QUOTA_BY_TIER.ultimate

/** Top-up packs (valides 12 mois) — dégressif, tous > coût/crédit des subscriptions. */
export const TOPUP_PACKS = [
  { size: 10, price: 12, unit: 1.20 },
  { size: 20, price: 22, unit: 1.10 },
  { size: 30, price: 30, unit: 1.00 },
  { size: 50, price: 45, unit: 0.90 },
] as const

/** Durées d'abonnement avec remises dégressives (règle feedback_subscription_durations).
 *  Appliqué via applyDurationDiscount() sur n'importe quel prix mensuel. */
export const SUBSCRIPTION_DURATIONS = [
  { months: 1,  discountPct: 0,  label: 'Mensuel' },
  { months: 12, discountPct: 10, label: '12 mois (−10%)' },
  { months: 24, discountPct: 20, label: '24 mois (−20%)' },
  { months: 36, discountPct: 30, label: '36 mois (−30%)' },
] as const

export type DurationMonths = 1 | 12 | 24 | 36

export function applyDurationDiscount(monthlyEur: number, months: DurationMonths): {
  monthlyEffective: number
  totalUpfront: number
  discountPct: number
  savingsVsMonthly: number
} {
  const dur = SUBSCRIPTION_DURATIONS.find(d => d.months === months) ?? SUBSCRIPTION_DURATIONS[0]
  const monthlyEffective = Math.round(monthlyEur * (1 - dur.discountPct / 100) * 100) / 100
  const totalUpfront = Math.round(monthlyEffective * months * 100) / 100
  const savingsVsMonthly = Math.round((monthlyEur * months - totalUpfront) * 100) / 100
  return { monthlyEffective, totalUpfront, discountPct: dur.discountPct, savingsVsMonthly }
}

/**
 * Buyers (clients potentiels) — quota inclus par tier (top-N révélés
 * automatiquement par pays selon ranking verified > confidence_score).
 * Au-delà : débit Fill-the-Gap par buyer (BUYER_REVEAL_COST_CREDITS).
 *
 * `null` = illimité (pas de gating quantitatif).
 */
export const BUYER_REVEAL_QUOTA_BY_TIER: Record<PlanTier, number | null> = {
  free:          0,
  solo_producer: 0,
  starter:       0,
  strategy:      10,
  premium:       50,
  ultimate:      null,
  custom:        null,
}

/** Coût en crédits Fill-the-Gap pour révéler un buyer hors quota.
 *  Différencié verified/basic — un contact vérifié vaut 2.5× plus. */
export const BUYER_REVEAL_COST_CREDITS = {
  verified: 5,
  basic:    2,
} as const

/** Anti-scraping caps */
export const LIMITS = {
  actions_per_min: 60,          // rate limit global par user
  export_per_request: 500,      // max entries par export
  export_per_day: 2000,         // max entries par jour (tous tiers)
  free_accounts_per_ip: 5,      // anti-sybil
} as const
