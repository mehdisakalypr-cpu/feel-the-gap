/**
 * Launch-bonus follow-up — daily, sends the founder pricing email to users
 * who signed up >= 24h ago and don't yet have an active subscription.
 *
 * STATUS: stub. Counts eligible candidates and returns a plan; does NOT yet
 * call sendLaunchBonus(). The send + tracking table will land alongside the
 * real CRM 5-email reactivation sequence in a follow-up commit.
 *
 * Wiring path (next iteration):
 *   1. Query crm_contacts joined to subscriptions, filter signed_up_at <
 *      now() - interval '1 day' AND no active sub AND not yet sent.
 *   2. For each candidate: derive locale from contact.locale (fallback fr),
 *      pick brand from contact.product, choose bonusPercent + founderTier
 *      from a lookup table (or default 30% / all-access).
 *   3. Call sendLaunchBonus(), insert into launch_bonus_sends to dedupe.
 *   4. Stop sending once subscription becomes active.
 *
 * Per-portfolio policy (memory feedback_no_free_trial_annual_discounts):
 *   no trial, no refund — discount is the only lever, locked for life.
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

async function countEligibleCandidates(): Promise<{ total: number } | { error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'supabase env missing' }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString()
  // Approximate: count contacts older than 24h with no active subscription.
  // Real implementation will join the subscriptions table once the schema is settled.
  const { count, error } = await sb
    .from('crm_contacts')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', dayAgo)
    .neq('status', 'unsubscribed')
    .is('subscribed_at', null)
  if (error) return { error: error.message }

  return { total: count ?? 0 }
}

export async function GET(req: Request) {
  if (!bearerOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const candidates = await countEligibleCandidates()

  return NextResponse.json({
    ok: true,
    stub: true,
    started_at: startedAt,
    candidates,
    note: 'No emails sent yet — dedup table launch_bonus_sends + subscription join pending. See route.ts header.',
  })
}

export async function POST(req: Request) {
  return GET(req)
}
