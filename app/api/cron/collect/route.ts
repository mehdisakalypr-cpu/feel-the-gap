import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runDataCollector } = await import('@/agents/data-collector')
  await runDataCollector({ year: 2022 })

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
