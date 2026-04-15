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

/** Tier plans: crédits inclus par mois. */
export const PLAN_MONTHLY_GRANT = {
  free: 5,
  starter: 50,
  pro: 200,
  business: 800,
  enterprise: 5000,
  custom: 10000, // pré-set, à ajuster au deal
} as const

export type PlanTier = keyof typeof PLAN_MONTHLY_GRANT

/** Top-up packs: [size, price EUR, price/credit]. Courbe dégressive. */
export const TOPUP_PACKS = [
  { size: 10, price: 9, unit: 0.90 },
  { size: 30, price: 24, unit: 0.80 },
  { size: 50, price: 37, unit: 0.74 },    // sweet spot
  { size: 100, price: 69, unit: 0.69 },
  { size: 300, price: 179, unit: 0.60 },
  { size: 1000, price: 499, unit: 0.50 },
] as const

/** Anti-scraping caps */
export const LIMITS = {
  actions_per_min: 60,          // rate limit global par user
  export_per_request: 500,      // max entries par export
  export_per_day: 2000,         // max entries par jour (tous tiers)
  free_accounts_per_ip: 5,      // anti-sybil
} as const
