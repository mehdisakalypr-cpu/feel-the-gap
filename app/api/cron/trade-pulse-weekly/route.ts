/**
 * Weekly Trade Pulse digest — Monday 08:00 Europe/Paris (07:00 UTC most of year).
 *
 * STATUS: stub. Counts eligible recipients and returns a plan; does NOT yet
 * compute real signals/highlights/trends from buyer_demands + commerce_leads
 * + TARIC, and does NOT yet call sendTradePulse().
 *
 * Wiring path (next iteration):
 *   1. queryWeeklySignals(): join buyer_demands × commerce_leads on industry +
 *      country, filter on created_at > now() - 7d, rank by buyer_count × growth.
 *   2. queryDealHighlights(): top 4 deals from `deals` table with marginPct >= 15
 *      created/updated in last 7d.
 *   3. queryTrendDeltas(): HS-code volume deltas via TARIC import API + Wikidata.
 *   4. for each subscriber in trade_pulse_subscribers (active): build per-user
 *      payload (locale aware), call sendTradePulse(), record send in
 *      trade_pulse_sends for opt-out + retry tracking.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function bearerOk(req: Request): boolean {
  const h = req.headers.get('authorization') ?? ''
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null
  return Boolean(expected) && h === expected
}

async function countEligibleRecipients(): Promise<{ total: number; fr: number; en: number } | { error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'supabase env missing' }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // For now: count active CRM contacts marked opted-in for trade-pulse.
  // The proper subscriber table will land with the real send wiring.
  const { count: total, error } = await sb
    .from('crm_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('opted_in_trade_pulse', true)
    .neq('status', 'unsubscribed')
  if (error) return { error: error.message }

  return { total: total ?? 0, fr: 0, en: 0 }
}

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const recipients = await countEligibleRecipients()

  return NextResponse.json({
    ok: true,
    stub: true,
    started_at: startedAt,
    recipients,
    note: 'No emails sent yet — signal/highlight/trend queries pending. See route.ts header for wiring plan.',
  })
}

export async function POST(req: Request) {
  // Allow manual trigger via POST with same auth (useful for dry-run from admin UI).
  return GET(req)
}
