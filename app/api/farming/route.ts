import { NextRequest, NextResponse } from 'next/server'
import { scanOpportunities, type ScanInput } from '@/agents/opportunity-scanner'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ScanInput

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
