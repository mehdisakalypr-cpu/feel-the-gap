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

  const solo_producer = getGeoPrice(PLAN_PRICE_EUR.solo_producer, country)
  const starter  = getGeoPrice(PLAN_PRICE_EUR.starter,  country)
  const strategy = getGeoPrice(PLAN_PRICE_EUR.strategy, country)
  const premium  = getGeoPrice(PLAN_PRICE_EUR.premium,  country)
  const ultimate = getGeoPrice(PLAN_PRICE_EUR.ultimate, country)

  // Keep the legacy tier shape for older callers (admin dashboards).
  const tier = getTierForCountry(country)

  return NextResponse.json({
    country: starter.countryCode,
    countryName: starter.countryName,
    multiplier: starter.multiplier,
    currency: starter.currency,
    plans: {
      solo_producer: { baseEUR: solo_producer.baseEUR, price: solo_producer.price, currency: solo_producer.currency },
      starter:  { baseEUR: starter.baseEUR,  price: starter.price,  currency: starter.currency },
      strategy: { baseEUR: strategy.baseEUR, price: strategy.price, currency: strategy.currency },
      premium:  { baseEUR: premium.baseEUR,  price: premium.price,  currency: premium.currency },
      ultimate: { baseEUR: ultimate.baseEUR, price: ultimate.price, currency: ultimate.currency },
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
