import { NextRequest, NextResponse } from 'next/server'
import {
  detectCountryFromHeaders,
  getGeoPrice,
  getTierForCountry,
} from '@/lib/geo-pricing'
import { PLAN_PRICE_EUR } from '@/lib/credits/costs'

/**
 * GET /api/geo
 * Returns the visitor's detected country and the geo-adjusted plan prices.
 * Reads CF-IPCountry (Cloudflare), falls back to x-vercel-ip-country then
 * Accept-Language locale. Never calls any external API at runtime.
 */
export async function GET(req: NextRequest) {
  const country = detectCountryFromHeaders(req.headers)

  const starter = getGeoPrice(PLAN_PRICE_EUR.starter, country)
  const premium = getGeoPrice(PLAN_PRICE_EUR.premium, country)

  // Keep the legacy tier shape for older callers (admin dashboards).
  const tier = getTierForCountry(country)

  return NextResponse.json({
    country: starter.countryCode,
    countryName: starter.countryName,
    multiplier: starter.multiplier,
    currency: starter.currency,
    plans: {
      starter: { baseEUR: starter.baseEUR, price: starter.price, currency: starter.currency },
      premium: { baseEUR: premium.baseEUR, price: premium.price, currency: premium.currency },
    },
    tier: {
      id: tier.id,
      label: tier.label,
      multiplier: tier.multiplier,
      currency: tier.currency,
      symbol: tier.symbol,
    },
  })
}
