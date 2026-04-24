import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckResult = { ok: boolean; latency_ms?: number; error?: string }

async function checkDb(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { ok: false, error: 'supabase_env_missing' }
  const t0 = Date.now()
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await sb.from('countries').select('iso').limit(1).maybeSingle()
    if (error) return { ok: false, error: error.message, latency_ms: Date.now() - t0 }
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown', latency_ms: Date.now() - t0 }
  }
}

export async function GET() {
  const t0 = Date.now()
  const db = await checkDb()

  const healthy = db.ok
  const body = {
    ok: healthy,
    timestamp: new Date().toISOString(),
    uptime_ms: Date.now() - t0,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    region: process.env.VERCEL_REGION ?? 'local',
    checks: { db },
  }

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
