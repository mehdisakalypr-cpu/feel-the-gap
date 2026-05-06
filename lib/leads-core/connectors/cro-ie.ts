/**
 * CRO Ireland connector — Companies Registration Office
 *
 * License : Irish Public Sector Licence (IPSL) / OGL-IE — free reuse with attribution.
 *           Attribution: "Source: Companies Registration Office Ireland (CRO)"
 * Volume  : ~600k active companies on record
 * Official: https://data.gov.ie/dataset/companies-and-business-names
 *
 * NOTE — Bulk CSV status (2026):
 *   CRO discontinued its public bulk CSV download in 2022. The endpoint
 *   https://search.cro.ie/company/CompanyDownload.aspx now returns HTTP 404.
 *   The SOAP API (https://services.cro.ie/cws/cro_open?wsdl) is available
 *   but has a 50 req/min cap and no envelope that allows full pagination.
 *   OpenCorporates aggregates the full CRO registry (jurisdiction_code=ie)
 *   and exposes it via their search API — this is the authoritative fallback
 *   used here. source_id is always 'cro_ie' for downstream traceability.
 *
 * Strategy:
 *   - Paginate OpenCorporates /v0.4/companies/search?jurisdiction_code=ie&inactive=false
 *   - Multiple query seeds to maximise recall (OC free tier = 500 calls/mo)
 *   - Rate-limit: 11s between pages (~5.5 req/min, under observed 6/min cap)
 *   - Upsert 500 rows at a time; onConflict=crn (OC company_number is stable)
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const OC_BASE = 'https://api.opencorporates.com/v0.4'
const UA = 'gapup-leads-vault/1.0 (cro-ie; mehdi.sakalypr@gmail.com)'
const JURISDICTION = 'ie'
const PER_PAGE = 100
const RATE_LIMIT_MS = 11_000
const BACKOFF_429_MS = 65_000
const CHUNK_SIZE = 500

const QUERY_SEEDS = [
  '',
  'import export',
  'wholesale',
  'logistics',
  'freight',
  'trading',
  'distribution',
  'manufacturing',
  'technology',
  'services',
]

type OcAddress = {
  street_address?: string | null
  locality?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string | null
}

type OcCompany = {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  incorporation_date?: string | null
  dissolution_date?: string | null
  inactive?: boolean
  current_status?: string | null
  registered_address_in_full?: string | null
  registered_address?: OcAddress | null
  industry_codes?: Array<{
    industry_code?: { code?: string; description?: string; code_scheme_id?: string }
  }>
}

type OcSearchResponse = {
  results?: {
    companies?: Array<{ company: OcCompany }>
    page?: number
    total_pages?: number
    total_count?: number
    per_page?: number
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function ocToken(): string | undefined {
  return process.env.OPENCORPORATES_API_TOKEN ?? undefined
}

function buildUrl(query: string, page: number): string {
  const params = new URLSearchParams({
    jurisdiction_code: JURISDICTION,
    per_page: String(PER_PAGE),
    page: String(page),
    inactive: 'false',
    order: 'score',
  })
  if (query) params.set('q', query)
  const token = ocToken()
  if (token) params.set('api_token', token)
  return `${OC_BASE}/companies/search?${params.toString()}`
}

async function fetchPage(url: string): Promise<OcSearchResponse | { rateLimited: true }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (res.status === 429 || res.status === 403) return { rateLimited: true }
  if (!res.ok) throw new Error(`OC HTTP ${res.status} for ${url}`)
  return (await res.json()) as OcSearchResponse
}

function detectImportExport(c: OcCompany): boolean {
  const name = (c.name ?? '').toLowerCase()
  if (/\b(import|export|trading|wholesale|logistics|freight|forwarding|distrib)\b/.test(name)) return true
  for (const ic of c.industry_codes ?? []) {
    const code = ic.industry_code?.code ?? ''
    const desc = (ic.industry_code?.description ?? '').toLowerCase()
    if (/^46/.test(code)) return true
    if (/^52(1|2)/.test(code)) return true
    if (/wholesale|import|export|trade|freight|logistics/.test(desc)) return true
  }
  return false
}

function pickNaceCode(c: OcCompany): string | null {
  for (const ic of c.industry_codes ?? []) {
    const scheme = (ic.industry_code?.code_scheme_id ?? '').toLowerCase()
    if (scheme.includes('nace') || scheme.includes('isic')) {
      return (ic.industry_code?.code ?? '').replace(/\./g, '') || null
    }
  }
  const first = c.industry_codes?.[0]?.industry_code?.code
  return first ? first.replace(/\./g, '') : null
}

function parseFoundedYear(date: string | null | undefined): number | null {
  if (!date) return null
  const yr = parseInt(date.slice(0, 4), 10)
  return !isNaN(yr) && yr > 1800 && yr <= new Date().getFullYear() ? yr : null
}

function mapStatus(c: OcCompany): LvCompanyInsert['status'] {
  if (c.inactive === true) return 'dissolved'
  const s = (c.current_status ?? '').toLowerCase()
  if (s.includes('dissolv') || s.includes('strik') || s.includes('liquid')) return 'dissolved'
  if (s.includes('dormant')) return 'dormant'
  return 'active'
}

function rowToCompany(c: OcCompany): LvCompanyInsert | null {
  const legalName = (c.name ?? '').trim()
  const companyNumber = (c.company_number ?? '').trim()
  if (!legalName || !companyNumber) return null
  if (c.inactive === true) return null

  const addr = c.registered_address ?? {}
  const addressLine = c.registered_address_in_full ||
    [addr.street_address, addr.locality].filter(Boolean).join(', ') ||
    null

  const nace = pickNaceCode(c)

  return {
    crn: companyNumber,
    legal_name: legalName,
    country_iso: 'IRL',
    region: addr.region ?? null,
    city: addr.locality ?? null,
    postal_code: addr.postal_code ?? null,
    address: addressLine,
    nace_code: nace,
    industry_tags: ['cro:ie', nace ? `code:${nace.slice(0, 2)}` : null].filter(Boolean) as string[],
    is_import_export: detectImportExport(c),
    founded_year: parseFoundedYear(c.incorporation_date),
    status: mapStatus(c),
    primary_source: 'cro_ie',
    source_ids: { cro: companyNumber },
    enrichment_score: 15,
  }
}

export async function runCroIeIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      source: 'opencorporates_fallback',
      jurisdiction: JURISDICTION,
      api_calls: 0,
      rate_limited: false,
      note: 'CRO bulk CSV discontinued 2022; OC aggregation used, source_id=cro_ie',
    },
  }

  const meta = result.metadata as Record<string, unknown>
  const seenCrns = new Set<string>()
  const limit = opts.limit ?? 500

  try {
    const sb = vaultClient()
    let apiCalls = 0

    outer: for (const query of QUERY_SEEDS) {
      for (let page = 1; page <= 10; page++) {
        const url = buildUrl(query, page)
        let resp: OcSearchResponse | { rateLimited: true }
        try {
          resp = await fetchPage(url)
        } catch (err) {
          console.error(`[cro-ie] fetch failed q="${query}" p=${page}:`, err instanceof Error ? err.message : err)
          break
        }
        apiCalls++
        meta.api_calls = apiCalls

        if ('rateLimited' in resp) {
          console.warn(`[cro-ie] rate-limited at api_calls=${apiCalls}, backing off ${BACKOFF_429_MS}ms`)
          meta.rate_limited = true
          await sleep(BACKOFF_429_MS)
          break outer
        }

        const list = resp.results?.companies ?? []
        if (list.length === 0) break

        const batch: LvCompanyInsert[] = []
        for (const item of list) {
          result.rows_processed++
          const row = rowToCompany(item.company)
          if (!row) {
            result.rows_skipped++
            continue
          }
          const crn = row.crn!
          if (seenCrns.has(crn)) {
            result.rows_skipped++
            continue
          }
          seenCrns.add(crn)
          batch.push(row)
        }

        if (batch.length > 0) {
          if (opts.dryRun) {
            result.rows_inserted += batch.length
            console.log(`[cro-ie] dry-run sample:`, JSON.stringify(batch[0], null, 2))
          } else {
            for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
              const chunk = batch.slice(i, i + CHUNK_SIZE)
              const { error, count } = await (sb.from as any)('lv_companies').upsert(
                chunk,
                { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' },
              )
              if (error) {
                console.error('[cro-ie] upsert error', error.message)
                result.rows_skipped += chunk.length
              } else {
                result.rows_inserted += count ?? chunk.length
              }
            }
          }
        }

        if (result.rows_inserted >= limit) break outer

        const totalPages = resp.results?.total_pages ?? 1
        if (page >= totalPages) break
        await sleep(RATE_LIMIT_MS)
      }

      if (result.rows_inserted >= limit) break
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'cro_ie',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }

    if (meta.rate_limited) {
      result.error = 'rate_limited (OC free tier exhausted — retry next month or set OPENCORPORATES_API_TOKEN)'
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[cro-ie]', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'cro_ie', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
