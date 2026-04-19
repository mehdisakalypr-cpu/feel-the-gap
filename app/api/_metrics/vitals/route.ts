import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    const log = {
      type: 'web_vital',
      ts: new Date().toISOString(),
      name: data.name,
      value: data.value,
      rating: data.rating,
      id: data.id,
      delta: data.delta,
      url: data.url,
      ua: req.headers.get('user-agent')?.slice(0, 200),
      country: req.headers.get('x-vercel-ip-country'),
    }

    console.log('[vitals]', JSON.stringify(log))

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
