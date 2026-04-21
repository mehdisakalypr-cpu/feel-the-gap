import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 60

// GET /api/parcours-state
// Public read — powers Topbar role filter, homepage CTAs, /pricing/funding gate.
export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb.from('parcours_state').select('role_kind, enabled, auto_enable_threshold, enabled_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map: Record<string, { enabled: boolean; auto_enable_threshold: number | null }> = {}
  for (const row of data ?? []) {
    map[row.role_kind] = { enabled: row.enabled, auto_enable_threshold: row.auto_enable_threshold }
  }
  return NextResponse.json({ parcours: map }, { headers: { 'cache-control': 's-maxage=30, stale-while-revalidate=120' } })
}
