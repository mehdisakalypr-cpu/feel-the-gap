/**
 * Geo-Pricing PPP — Adjusts pricing based on purchasing power parity
 * Detected via Vercel's x-vercel-ip-country header or client-side fallback
 */

export interface PricingTier {
  id: string
  multiplier: number
  currency: string
  symbol: string
  label: string
}

const PPP_TIERS: Record<string, PricingTier> = {
  tier1_premium: {
    id: 'tier1_premium',
    multiplier: 1.0,
    currency: 'EUR',
    symbol: '\u20ac',
    label: 'Standard',
  },
  tier2_standard: {
    id: 'tier2_standard',
    multiplier: 0.7,
    currency: 'USD',
    symbol: '$',
    label: 'Reduced',
  },
  tier3_emerging: {
    id: 'tier3_emerging',
    multiplier: 0.45,
    currency: 'USD',
    symbol: '$',
    label: 'Emerging',
  },
  tier4_frontier: {
    id: 'tier4_frontier',
    multiplier: 0.25,
    currency: 'USD',
    symbol: '$',
    label: 'Frontier',
  },
}

const COUNTRY_TO_TIER: Record<string, string> = {
  // Tier 1 — Premium (full price EUR)
  DE: 'tier1_premium', FR: 'tier1_premium', IT: 'tier1_premium', ES: 'tier1_premium',
  JP: 'tier1_premium', KR: 'tier1_premium', GB: 'tier1_premium', US: 'tier1_premium',
  CA: 'tier1_premium', AU: 'tier1_premium', NL: 'tier1_premium', SE: 'tier1_premium',
  CH: 'tier1_premium', BE: 'tier1_premium', AT: 'tier1_premium', FI: 'tier1_premium',
  DK: 'tier1_premium', NO: 'tier1_premium', IE: 'tier1_premium', SG: 'tier1_premium',
  NZ: 'tier1_premium', PT: 'tier1_premium', LU: 'tier1_premium',

  // Tier 2 — Standard (0.7x)
  BR: 'tier2_standard', MX: 'tier2_standard', TR: 'tier2_standard', RU: 'tier2_standard',
  AR: 'tier2_standard', CL: 'tier2_standard', ZA: 'tier2_standard', MY: 'tier2_standard',
  TH: 'tier2_standard', CN: 'tier2_standard', PL: 'tier2_standard', CZ: 'tier2_standard',
  RO: 'tier2_standard', CO: 'tier2_standard', PE: 'tier2_standard',

  // Tier 3 — Emerging (0.45x)
  NG: 'tier3_emerging', KE: 'tier3_emerging', TZ: 'tier3_emerging', IN: 'tier3_emerging',
  BD: 'tier3_emerging', PK: 'tier3_emerging', VN: 'tier3_emerging', PH: 'tier3_emerging',
  ID: 'tier3_emerging', EG: 'tier3_emerging', GH: 'tier3_emerging', SN: 'tier3_emerging',
  CI: 'tier3_emerging', MA: 'tier3_emerging', DZ: 'tier3_emerging', TN: 'tier3_emerging',

  // Tier 4 — Frontier (0.25x)
  ET: 'tier4_frontier', MOZ: 'tier4_frontier', BFA: 'tier4_frontier', BEN: 'tier4_frontier',
  GIN: 'tier4_frontier', KHM: 'tier4_frontier', HND: 'tier4_frontier', GTM: 'tier4_frontier',
  MLI: 'tier4_frontier', TCD: 'tier4_frontier', NER: 'tier4_frontier', MWI: 'tier4_frontier',
}

export function getTierForCountry(countryCode: string | null): PricingTier {
  if (!countryCode) return PPP_TIERS.tier1_premium
  const tierId = COUNTRY_TO_TIER[countryCode.toUpperCase()] ?? 'tier1_premium'
  return PPP_TIERS[tierId]
}

export function getAdjustedPrice(baseEUR: number, tier: PricingTier): number {
  return Math.round(baseEUR * tier.multiplier)
}

export function formatPrice(amount: number, tier: PricingTier): string {
  return `${amount} ${tier.symbol}`
}

export { PPP_TIERS }
