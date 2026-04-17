import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase env' }, { status: 500 })
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await admin.rpc('renew_fillthegap_quota_all')
  if (error) {
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ok',
    rows_reset: data ?? 0,
    at: new Date().toISOString(),
  })
}
