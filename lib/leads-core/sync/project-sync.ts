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
import { toIso2 } from '../../iso3-to-iso2'

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

function applyFilter(q: any, filter: ProjectFilter): any | null {
  switch (`${filter.project}/${filter.name}`) {
    case 'ftg/import-export-eu':
      // The OR (nace_code.like.46% OR sic_code.like.46%) defeats the planner
      // and causes 60s timeouts on 800k+ rows. The boolean `is_import_export`
      // was already set during ingest by the connectors based on those exact
      // codes, so it's already implicit. Trust it.
      return q.eq('is_import_export', true).in('country_iso', ['FRA', 'DEU', 'ESP', 'ITA', 'GBR', 'NLD', 'BEL', 'POL'])
    case 'ftg/import-export-global':
      return q.eq('is_import_export', true)
    case 'ofa/smb-website-needed':
      return q.in('size_bucket', ['micro', 'small']).is('domain', null)
    case 'estate/hospitality-chains':
      return q.like('nace_code', '55%').in('size_bucket', ['medium', 'large'])
    default:
      return null
  }
}

const SELECT_COLS = 'id, legal_name, trade_name, domain, country_iso, city, address, nace_code, sic_code, industry_tags, is_import_export, size_bucket, primary_source, source_ids'
const PAGE_SIZE = 1000

// Keyset pagination: avoid OFFSET (O(n log n) per page → 60s timeout on 332k rows)
// by walking the `id` index forward via `id > last_seen_id`. Each page = O(log n)
// index seek + O(PAGE_SIZE) read regardless of how deep we are in the result set.
async function fetchCompaniesForFilter(filter: ProjectFilter, limit?: number): Promise<CompanyRow[]> {
  const sb = vaultClient()
  const target = limit ?? 5000
  const out: CompanyRow[] = []
  let lastId: string | null = null

  while (out.length < target) {
    let base = (sb.from as any)('lv_companies').select(SELECT_COLS).order('id', { ascending: true }).limit(Math.min(PAGE_SIZE, target - out.length))
    if (lastId) base = base.gt('id', lastId)
    const q = applyFilter(base, filter)
    if (!q) return []
    const { data, error } = await q
    if (error) throw new Error(`fetch failed: ${error.message}`)
    const rows = (data ?? []) as CompanyRow[]
    if (rows.length === 0) break
    out.push(...rows)
    lastId = rows[rows.length - 1].id
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

type Contact = { email: string | null; phone: string | null }

async function fetchPrimaryContactsBatch(companyIds: string[]): Promise<Map<string, Contact>> {
  const out = new Map<string, Contact>()
  if (companyIds.length === 0) return out
  const sb = vaultClient()
  // PostgREST caps `.in()` URL length; chunk to stay safe.
  const CHUNK = 200
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const slice = companyIds.slice(i, i + CHUNK)
    const { data, error } = await (sb.from as any)('lv_contacts')
      .select('company_id, contact_type, contact_value, verify_status, verify_score')
      .in('company_id', slice)
      .order('verify_score', { ascending: false, nullsFirst: false })
    if (error) throw new Error(`contacts batch failed: ${error.message}`)
    for (const c of (data ?? []) as Array<{ company_id: string; contact_type: string; contact_value: string; verify_status: string }>) {
      const cur = out.get(c.company_id) ?? { email: null, phone: null }
      if (!cur.email && c.contact_type === 'email' && c.verify_status !== 'invalid') cur.email = c.contact_value
      if (!cur.phone && c.contact_type === 'phone') cur.phone = c.contact_value
      out.set(c.company_id, cur)
    }
  }
  return out
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
  let q = (sb.from as any)('lv_project_filters').select('id, project, name, sql_filter, target_table, is_active').eq('is_active', true)
  if (opts.project) q = q.eq('project', opts.project)
  const { data: filters, error: filtersErr } = await q
  if (filtersErr) {
    result.error = filtersErr.message
    result.duration_ms = Date.now() - start
    return result
  }

  const pubSb = publicClient()

  const UPSERT_CHUNK = 500

  for (const filter of (filters ?? []) as ProjectFilter[]) {
    if (!filter.target_table) continue // CC admin-readonly etc.
    const tableName = filter.target_table.replace(/^public\./, '')
    const companies = await fetchCompaniesForFilter(filter, opts.limit)
    for (let i = 0; i < companies.length; i += UPSERT_CHUNK) {
      const chunk = companies.slice(i, i + UPSERT_CHUNK)
      const contacts = await fetchPrimaryContactsBatch(chunk.map((c) => c.id))
      const bySlug = new Map<string, Record<string, unknown>>()
      for (const c of chunk) {
        const contact = contacts.get(c.id) ?? { email: null, phone: null }
        const iso2 = toIso2(c.country_iso) ?? c.country_iso
        const slug = `${filter.project}-${iso2.toLowerCase()}-${c.id.slice(0, 8)}`
        if (bySlug.has(slug)) continue // dedup intra-chunk (EU/global overlap, slug collisions)
        bySlug.set(slug, {
          business_name: c.legal_name,
          slug,
          country_iso: iso2,
          city: c.city,
          address: c.address,
          phone: contact.phone,
          email: contact.email,
          website_url: c.domain ? `https://${c.domain}` : null,
          category: c.nace_code || c.sic_code || (c.industry_tags?.[0] ?? null),
          source: `vault:${c.primary_source}`,
          source_id: Object.values(c.source_ids ?? {})[0] ?? c.id,
          source_url: null,
          status: 'identified',
        })
      }
      const rows = Array.from(bySlug.values())
      result.rows_processed += chunk.length
      if (rows.length === 0) continue
      const { error: upErr } = await (pubSb.from as any)(tableName)
        .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false })
      if (upErr) {
        if (process.env.LEADS_VAULT_DEBUG === '1') {
          console.error(`bulk upsert ${tableName} failed:`, upErr.message, 'chunk size=', rows.length)
        }
        result.rows_skipped += rows.length
        continue
      }
      result.rows_inserted += rows.length
    }
    await (sb.from as any)('lv_project_filters').update({ last_sync_at: new Date().toISOString() }).eq('id', filter.id)
  }

  result.duration_ms = Date.now() - start
  await logSync({ source_id: 'sirene', project: opts.project ?? null, operation: 'sync', result })
  return result
}
