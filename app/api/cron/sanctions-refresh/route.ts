import { NextRequest, NextResponse } from 'next/server'
import { refreshSanctionsLists } from '../../marketplace/sanctions/_lib/refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET / POST /api/cron/sanctions-refresh
 * Cron weekly (Vercel cron / Supabase pg_cron / OS cron). Auth via header
 * `x-cron-secret` (env CRON_SECRET) ou query `?secret=…`.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret')
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const result = await refreshSanctionsLists()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
