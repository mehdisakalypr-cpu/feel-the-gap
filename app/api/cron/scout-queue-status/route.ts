import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Monitoring-only — scout draining runs on VPS PM2 (ftg-scout-loop).
 * Returns live funnel counts for /admin/crm and observability.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const out: Record<string, number> = {}
  for (const s of ['pending','running','done','failed']) {
    const { count } = await db.from('scout_queue').select('*',{count:'exact',head:true}).eq('status', s)
    out[`scout_queue_${s}`] = count ?? 0
  }
  const counts = await Promise.all([
    db.from('entrepreneurs_directory').select('*',{count:'exact',head:true}),
    db.from('entrepreneur_demos').select('*',{count:'exact',head:true}),
    db.from('entrepreneur_demos').select('*',{count:'exact',head:true}).eq('status','contacted'),
    db.from('profiles').select('*',{count:'exact',head:true}),
    db.from('marketplace_matches').select('*',{count:'exact',head:true}),
  ])
  out.entrepreneurs_directory = counts[0].count ?? 0
  out.entrepreneur_demos = counts[1].count ?? 0
  out.contacted = counts[2].count ?? 0
  out.signups = counts[3].count ?? 0
  out.marketplace_matches = counts[4].count ?? 0
  return NextResponse.json({ ok: true, snapshot: out, at: new Date().toISOString() })
}
