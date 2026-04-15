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
  starter: 60,
  premium: 120,
  custom: 10000, // enterprise/agency pré-set ajustable au deal
} as const

export type PlanTier = keyof typeof PLAN_MONTHLY_GRANT

export const PLAN_PRICE_EUR = {
  free: 0,
  starter: 29,
  premium: 79,
  custom: 0, // sur devis
} as const

/** Top-up packs (valides 12 mois) — dégressif, tous > coût/crédit des subscriptions. */
export const TOPUP_PACKS = [
  { size: 10, price: 12, unit: 1.20 },
  { size: 20, price: 22, unit: 1.10 },
  { size: 30, price: 30, unit: 1.00 },
  { size: 50, price: 45, unit: 0.90 },
] as const

/** Anti-scraping caps */
export const LIMITS = {
  actions_per_min: 60,          // rate limit global par user
  export_per_request: 500,      // max entries par export
  export_per_day: 2000,         // max entries par jour (tous tiers)
  free_accounts_per_ip: 5,      // anti-sybil
} as const
