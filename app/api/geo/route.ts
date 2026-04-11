import { NextRequest, NextResponse } from 'next/server'
import { getTierForCountry } from '@/lib/geo-pricing'

export async function GET(req: NextRequest) {
  // Vercel injects x-vercel-ip-country automatically
  const country = req.headers.get('x-vercel-ip-country')
    ?? req.headers.get('cf-ipcountry')  // Cloudflare fallback
    ?? null

  const tier = getTierForCountry(country)

  return NextResponse.json({
    country,
    tier: tier.id,
    multiplier: tier.multiplier,
    currency: tier.currency,
    symbol: tier.symbol,
  })
}
