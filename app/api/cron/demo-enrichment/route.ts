import { NextRequest, NextResponse } from 'next/server'
import { runDemoEnricher, EnrichTarget } from '@/agents/demo-enricher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron — pulls validated emails from the leads vault into entrepreneur_demos.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> required if CRON_SECRET set.
 * Without secret, apply defaults to false; cron sends apply=true via header.
 *
 * Query params:
 *   ?apply=1       — write to DB (default 1 when called from cron)
 *   ?limit=100     — demos to scan per run (1-500, default 100)
 *   ?country=FRA   — restrict to ISO list (default FRA,GBR)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const fromCron = !!secret && authHeader === `Bearer ${secret}`
  const applyParam = url.searchParams.get('apply')
  const apply = applyParam !== null ? applyParam === '1' : fromCron

  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 500) : 100

  const countryParam = url.searchParams.get('country')
  const countries = countryParam ? countryParam.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : undefined

  const targetParam = url.searchParams.get('target')
  const target: EnrichTarget = targetParam === 'demos' ? 'demos' : 'leads'

  try {
    const res = await runDemoEnricher({ apply, limit, countries, target })
    return NextResponse.json({ ok: true, target, ...res })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
