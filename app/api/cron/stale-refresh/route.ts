import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'missing SUPABASE env' }, { status: 500 })
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const t0 = Date.now()
  const { data, error } = await sb.rpc('ftg_mark_stale_content', { stale_days: 60 })

  const duration_ms = Date.now() - t0
  if (error) {
    console.error('[cron/stale-refresh]', error.message)
    return NextResponse.json({ ok: false, error: error.message, duration_ms }, { status: 500 })
  }
  return NextResponse.json({ ok: true, marked: data, duration_ms })
}
