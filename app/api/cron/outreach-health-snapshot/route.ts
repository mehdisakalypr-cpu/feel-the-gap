import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Daily snapshot of outreach pipeline health — counts persisted to
 * outreach_health_snapshots for trend analysis on /admin/outreach-enrichment.
 *
 * Runs at 07h UTC (Vercel cron). Bearer-gated by CRON_SECRET when set.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'missing_supabase_env' }, { status: 500 })
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const yday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const queries = await Promise.all([
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true }),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .eq('status', 'generated').is('outreach_sent_at', null).is('email', null),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .not('email', 'is', null),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .not('outreach_sent_at', 'is', null),
    db.from('entrepreneur_demos').select('*', { count: 'exact', head: true })
      .gte('outreach_sent_at', yday),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true }),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true })
      .not('email', 'is', null),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true })
      .not('website_url', 'is', null),
    db.from('entrepreneurs_directory').select('*', { count: 'exact', head: true })
      .not('linkedin_url', 'is', null),
    db.from('marketplace_matches').select('*', { count: 'exact', head: true }),
    db.from('marketplace_matches').select('*', { count: 'exact', head: true })
      .gte('created_at', yday),
  ])

  const counts = queries.map((q) => q.count ?? 0)
  const [
    demos_total, demos_blocked_email, demos_with_email, demos_sent_total, demos_sent_24h,
    dir_total, dir_with_email, dir_with_website, dir_with_linkedin,
    marketplace_matches_total, marketplace_matches_24h,
  ] = counts

  const { data: inserted, error } = await db.from('outreach_health_snapshots').insert({
    demos_total, demos_blocked_email, demos_with_email, demos_sent_total, demos_sent_24h,
    dir_total, dir_with_email, dir_with_website, dir_with_linkedin,
    marketplace_matches_total, marketplace_matches_24h,
  }).select('id, captured_at').maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, snapshot: inserted, counts: {
    demos_total, demos_blocked_email, demos_with_email, demos_sent_total, demos_sent_24h,
    dir_total, dir_with_email, dir_with_website, dir_with_linkedin,
    marketplace_matches_total, marketplace_matches_24h,
  }})
}
