/**
 * Project sync — apply lv_project_filters → upsert into project tables
 *
 * Reads filters from gapup_leads.lv_project_filters and projects companies
 * (with primary contacts) into the configured target tables. Default target
 * for FTG / OFA is `public.commerce_leads`.
 */

import { vaultClient, publicClient } from '../client'
import { logSync } from '../log'
import type { SyncResult } from '../types'

type ProjectFilter = {
  id: string
  project: string
  name: string
  sql_filter: string
  target_table: string | null
  is_active: boolean
}

type CompanyRow = {
  id: string
  legal_name: string
  trade_name: string | null
  domain: string | null
  country_iso: string
  city: string | null
  address: string | null
  nace_code: string | null
  sic_code: string | null
  industry_tags: string[] | null
  is_import_export: boolean
  size_bucket: string | null
  primary_source: string
  source_ids: Record<string, string>
}

async function fetchCompaniesForFilter(filter: ProjectFilter, limit?: number): Promise<CompanyRow[]> {
  const sb = vaultClient()
  // Apply filter via Postgres `OR` raw — Supabase JS doesn't take raw SQL but we
  // can use the rest API filter syntax via our restricted set of seeded filters.
  // For safety and simplicity, we hardcode supported filter shapes here.
  let q = sb.from('lv_companies').select('id, legal_name, trade_name, domain, country_iso, city, address, nace_code, sic_code, industry_tags, is_import_export, size_bucket, primary_source, source_ids').limit(limit ?? 5000)
  switch (`${filter.project}/${filter.name}`) {
    case 'ftg/import-export-eu':
      q = q.eq('is_import_export', true).in('country_iso', ['FRA', 'DEU', 'ESP', 'ITA', 'GBR', 'NLD', 'BEL', 'POL']).like('nace_code', '46%')
      break
    case 'ftg/import-export-global':
      q = q.eq('is_import_export', true)
      break
    case 'ofa/smb-website-needed':
      q = q.in('size_bucket', ['micro', 'small']).is('domain', null)
      break
    case 'estate/hospitality-chains':
      q = q.like('nace_code', '55%').in('size_bucket', ['medium', 'large'])
      break
    default:
      return []
  }
  const { data, error } = await q
  if (error) throw new Error(`fetch failed: ${error.message}`)
  return (data ?? []) as CompanyRow[]
}

async function fetchPrimaryContact(companyId: string): Promise<{ email: string | null; phone: string | null }> {
  const sb = vaultClient()
  const { data } = await sb
    .from('lv_contacts')
    .select('contact_type, contact_value, verify_status, verify_score')
    .eq('company_id', companyId)
    .order('verify_score', { ascending: false, nullsFirst: false })
    .limit(10)
  let email: string | null = null
  let phone: string | null = null
  for (const c of data ?? []) {
    if (!email && c.contact_type === 'email' && c.verify_status !== 'invalid') email = c.contact_value as string
    if (!phone && c.contact_type === 'phone') phone = c.contact_value as string
  }
  return { email, phone }
}

export async function runProjectSync(opts: { project?: string; limit?: number } = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  const sb = vaultClient()
  let q = sb.from('lv_project_filters').select('id, project, name, sql_filter, target_table, is_active').eq('is_active', true)
  if (opts.project) q = q.eq('project', opts.project)
  const { data: filters, error: filtersErr } = await q
  if (filtersErr) {
    result.error = filtersErr.message
    result.duration_ms = Date.now() - start
    return result
  }

  const pubSb = publicClient()

  for (const filter of (filters ?? []) as ProjectFilter[]) {
    if (!filter.target_table) continue // CC admin-readonly etc.
    const tableName = filter.target_table.replace(/^public\./, '')
    const companies = await fetchCompaniesForFilter(filter, opts.limit)
    for (const c of companies) {
      result.rows_processed++
      const contact = await fetchPrimaryContact(c.id)
      const slug = `${filter.project}-${c.country_iso.toLowerCase()}-${c.id.slice(0, 8)}`
      const row: Record<string, unknown> = {
        business_name: c.legal_name,
        slug,
        country_iso: c.country_iso,
        city: c.city,
        address: c.address,
        phone: contact.phone,
        email: contact.email,
        website_url: c.domain ? `https://${c.domain}` : null,
        category: c.nace_code || c.sic_code || (c.industry_tags?.[0] ?? null),
        source: `vault:${c.primary_source}`,
        source_id: Object.values(c.source_ids ?? {})[0] ?? c.id,
        source_url: null,
        status: 'pending_review',
      }
      const { error: upErr, count } = await pubSb
        .from(tableName)
        .upsert(row, { onConflict: 'slug', ignoreDuplicates: false, count: 'exact' })
      if (upErr) {
        if (upErr.message.includes('does not exist')) {
          // target table not present yet (e.g. estate_leads not created)
          result.rows_skipped++
          continue
        }
        result.rows_skipped++
        continue
      }
      result.rows_inserted += count ?? 1
    }
    await sb.from('lv_project_filters').update({ last_sync_at: new Date().toISOString() }).eq('id', filter.id)
  }

  result.duration_ms = Date.now() - start
  await logSync({ source_id: 'sirene', project: opts.project ?? null, operation: 'sync', result })
  return result
}
