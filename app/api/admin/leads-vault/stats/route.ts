import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function vaultAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'gapup_leads' } },
  )
}

async function requireAdmin() {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = vaultAdmin()

  const [companies, persons, contacts, sources, filters, recent] = await Promise.all([
    sb.from('lv_companies').select('id', { head: true, count: 'exact' }),
    sb.from('lv_persons').select('id', { head: true, count: 'exact' }),
    sb.from('lv_contacts').select('id', { head: true, count: 'exact' }),
    sb.from('lv_sources').select('id, name, license, status, enabled, total_records, last_full_pull_at, last_delta_pull_at').order('id'),
    sb.from('lv_project_filters').select('id, project, name, target_table, is_active, last_sync_at').order('project, name'),
    sb.from('lv_sync_log').select('id, source_id, project, operation, rows_processed, rows_inserted, rows_updated, rows_skipped, error, duration_ms, started_at').order('started_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({
    totals: {
      companies: companies.count ?? 0,
      persons: persons.count ?? 0,
      contacts: contacts.count ?? 0,
    },
    sources: sources.data ?? [],
    filters: filters.data ?? [],
    recent_sync_log: recent.data ?? [],
  })
}
