import { NextResponse } from 'next/server'
import { processPendingSends } from '@/lib/email/sequences'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await processPendingSends(50)
    return NextResponse.json({ status: 'ok', ...result })
  } catch (err: any) {
    console.error('[cron/email-drip]', err?.message || err)
    return NextResponse.json({ status: 'error', error: err?.message || 'unknown' }, { status: 500 })
  }
}
