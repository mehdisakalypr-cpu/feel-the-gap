import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use the free multi-source collector (no API keys required for most sources)
  const { runFreeCollector, runGapAnalyzer } = await import('@/agents/free-collector')
  await runFreeCollector({ year: 2022 })
  await runGapAnalyzer()

  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}
