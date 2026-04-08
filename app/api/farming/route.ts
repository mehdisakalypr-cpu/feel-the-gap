import { NextRequest, NextResponse } from 'next/server'
import { scanOpportunities, type ScanInput } from '@/agents/opportunity-scanner'
import { getAuthUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const raw = await req.json()

    // Map farming form fields → ScanInput
    const body: ScanInput = {
      product:                 raw.product ?? raw.productName ?? '',
      description:             raw.description ?? raw.productDescription,
      productUrl:              raw.productUrl,
      productPrice:            raw.productPrice,
      opportunityTypes:        raw.opportunityTypes,
      opportunityDescription:  raw.opportunityDescription,
      manufacturer:            raw.manufacturer,
      geography:               raw.geography,
      budget:                  raw.budget,
      affiliateLink:           raw.affiliateLink,
    }

    if (!body.product?.trim()) {
      return NextResponse.json({ error: 'product is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    const result = await scanOpportunities(body)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/farming]', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
