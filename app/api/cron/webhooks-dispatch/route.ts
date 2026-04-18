import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dispatchEvent } from '@/lib/api-platform/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron — dispatch des webhooks pour les opportunities créées/modifiées
 * dans les N dernières minutes (N = query param `since_min`, défaut 65 pour
 * chevauchement 5min avec cron hourly).
 *
 * Protection : Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  // Hobby plan: daily cron max → window = 24h + 10min overlap (1450min)
  const sinceMin = Math.min(Math.max(1, Number(url.searchParams.get('since_min') ?? 1450)), 7 * 24 * 60)
  const sinceIso = new Date(Date.now() - sinceMin * 60_000).toISOString()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Opportunities créées depuis sinceMin
  const { data: created, error: createdErr } = await sb
    .from('opportunities')
    .select('id, country_iso, product_id, type, opportunity_score, gap_value_usd, created_at')
    .gte('created_at', sinceIso)
    .limit(500)

  if (createdErr) {
    return NextResponse.json({ ok: false, error: createdErr.message }, { status: 500 })
  }

  let totalCalls = 0
  let totalSuccess = 0
  let totalFailure = 0

  for (const opp of created ?? []) {
    const r = await dispatchEvent('opportunity.created', opp as Record<string, unknown>)
    totalCalls += r.total
    totalSuccess += r.success
    totalFailure += r.failure
  }

  return NextResponse.json({
    ok: true,
    since_min: sinceMin,
    opportunities_seen: created?.length ?? 0,
    deliveries: { total: totalCalls, success: totalSuccess, failure: totalFailure },
  })
}
