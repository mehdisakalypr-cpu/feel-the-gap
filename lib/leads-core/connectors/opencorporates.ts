/**
 * OpenCorporates connector — global business registry aggregator
 *
 * License: ODbL (commercial use allowed with attribution; bulk dumps require
 *   a paid plan).
 * Volume: ~200M entities across ~140 jurisdictions. Free tier is rate-limited
 *   to ~500 calls/month, so we use this connector as a *gap-filler*: hit
 *   jurisdictions where we have no national bulk source (US, AU, SG, HK, CA,
 *   NZ, IE, AE, JP, ZA…) and cherry-pick by activity codes (NACE/SIC import-
 *   export) to maximise yield per call.
 *
 * Strategy v1 (free tier, ~5k entries/mo cap):
 *   1. Iterate over a curated list of (jurisdiction, activity_code) pairs.
 *   2. Use /v0.4/companies/search?q=&jurisdiction_code=&inactive=false with
 *      `per_page=100` (max). Each page = 1 API call → max 100 entities.
 *   3. Stop a jurisdiction once we hit `pagesPerJurisdiction` or HTTP 429.
 *   4. Throttle to 6 req/min (free tier observed limit) and back off on 429.
 *   5. Upsert by (primary_source, source_ids.opencorporates) — there is no
 *      universal CRN namespace across jurisdictions, so we key on the OC
 *      `company_number` *within* a jurisdiction and store both in source_ids.
 *
 * Bulk paid tier (debt): once budget is unlocked (~$1k/mo), swap this for the
 *   monthly snapshot endpoint and process via the Sirene/CH file pattern.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const OC_BASE = 'https://api.opencorporates.com/v0.4'
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

/** Jurisdiction code (OC convention, lowercase ISO-ish) → ISO 3166-1 alpha-3. */
const JURISDICTION_TO_ISO3: Record<string, string> = {
  // EU / EEA (we use OC for jurisdictions where we don't have a bulk source)
  ie: 'IRL', nl: 'NLD', be: 'BEL', lu: 'LUX', dk: 'DNK', se: 'SWE',
  fi: 'FIN', no: 'NOR', at: 'AUT', ch: 'CHE', pt: 'PRT', es: 'ESP',
  it: 'ITA', de: 'DEU', pl: 'POL', cz: 'CZE', gr: 'GRC',
  // North America
  us: 'USA', ca: 'CAN', mx: 'MEX',
  // APAC
  au: 'AUS', nz: 'NZL', sg: 'SGP', hk: 'HKG', jp: 'JPN', kr: 'KOR',
  in: 'IND', my: 'MYS', th: 'THA', id: 'IDN', ph: 'PHL',
  // MENA / Africa
  ae: 'ARE', sa: 'SAU', il: 'ISR', za: 'ZAF',
  // LatAm
  br: 'BRA', cl: 'CHL', ar: 'ARG', co: 'COL',
  // UK sub-jurisdictions occasionally surface — fall through to GBR
  gb: 'GBR',
}

/** Default jurisdictions we fill when `opts.jurisdictions` is not provided.
 *  Excludes FR (Sirene) and GB (Companies House) — we already own bulk there. */
const DEFAULT_JURISDICTIONS: string[] = [
  'us', 'ie', 'nl', 'de', 'es', 'it', 'be', 'au', 'sg', 'hk', 'ae',
]

/** Activity-code seeds (NACE rev2 + ISIC overlap) used as `q` when the
 *  /search endpoint accepts no native code filter on free tier. */
const IE_QUERY_SEEDS: string[] = [
  'import export', 'wholesale', 'logistics', 'freight forwarding',
  'trading company', 'distribution',
]

/** Tunables */
const DEFAULT_PAGES_PER_JURISDICTION = 5    // 5 pages × 100 = 500 rows max
const PER_PAGE = 100
const RATE_LIMIT_DELAY_MS = 11_000          // ~5.5 req/min, under the 6/min observed cap
const BACKOFF_429_MS = 60_000

type OcCompany = {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  incorporation_date?: string | null
  dissolution_date?: string | null
  inactive?: boolean
  registered_address_in_full?: string | null
  registered_address?: {
    street_address?: string | null
    locality?: string | null
    region?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
  industry_codes?: Array<{
    industry_code?: { code?: string; description?: string; code_scheme_id?: string }
  }>
  current_status?: string | null
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

function ocApiToken(): string | undefined {
  return process.env.OPENCORPORATES_API_TOKEN || undefined
}

function buildSearchUrl(query: string, jurisdiction: string, page: number): string {
  const params = new URLSearchParams({
    q: query,
    jurisdiction_code: jurisdiction,
    per_page: String(PER_PAGE),
    page: String(page),
    inactive: 'false',
    order: 'score',
  })
  const token = ocApiToken()
  if (token) params.set('api_token', token)
  return `${OC_BASE}/companies/search?${params.toString()}`
}

async function fetchPage(url: string): Promise<OcSearchResponse | { rateLimited: true }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (res.status === 429 || res.status === 403) {
    return { rateLimited: true }
  }
  if (!res.ok) throw new Error(`OC HTTP ${res.status}`)
  return (await res.json()) as OcSearchResponse
}

/** Heuristic I/E flag: scan industry codes (NAICS/SIC/NACE) + name tokens. */
function detectImportExport(c: OcCompany): boolean {
  const name = (c.name || '').toLowerCase()
  if (/\b(import|export|trading|wholesale|logistics|freight|forwarding|distrib)\b/.test(name)) {
    return true
  }
  for (const ic of c.industry_codes || []) {
    const code = ic.industry_code?.code || ''
    if (/^46/.test(code)) return true            // NACE/ISIC wholesale
    if (/^52(1|2)/.test(code)) return true       // warehousing & support
    if (/^(4231|4232|4233|4234|4235|4236|4237|4238|4239|4241|4242|4243|4244|4245|4246|4247|4248|4249|4881|4884|4885|4889)/.test(code)) {
      return true                                // NAICS wholesale + freight support
    }
    if (/^(50|51|42)/.test(code)) {
      const desc = (ic.industry_code?.description || '').toLowerCase()
      if (/wholesale|import|export|trade|freight|logistics/.test(desc)) return true
    }
  }
  return false
}

function pickNaceCode(c: OcCompany): string | null {
  for (const ic of c.industry_codes || []) {
    const scheme = (ic.industry_code?.code_scheme_id || '').toLowerCase()
    if (scheme.includes('nace') || scheme.includes('isic')) {
      return (ic.industry_code?.code || '').replace(/\./g, '') || null
    }
  }
  // fallback: first code, whatever the scheme
  const first = c.industry_codes?.[0]?.industry_code?.code
  return first ? first.replace(/\./g, '') : null
}

function rowToCompany(c: OcCompany): LvCompanyInsert | null {
  const legal = (c.name || '').trim()
  const num = (c.company_number || '').trim()
  const jur = (c.jurisdiction_code || '').toLowerCase()
  if (!legal || !num || !jur) return null
  if (c.inactive === true) return null

  // OC jurisdiction codes can be sub-national (us_de, ca_on…) — split on '_'.
  const root = jur.split('_')[0]
  const iso3 = JURISDICTION_TO_ISO3[root] || JURISDICTION_TO_ISO3[jur] || 'XXX'

  const nace = pickNaceCode(c)
  const ie = detectImportExport(c)

  const addr = c.registered_address || {}
  const addressLine = c.registered_address_in_full ||
    [addr.street_address, addr.locality].filter(Boolean).join(', ') ||
    null

  return {
    legal_name: legal,
    crn: num,                                  // jurisdiction-scoped CRN
    country_iso: iso3,
    region: addr.region || null,
    city: addr.locality || null,
    postal_code: addr.postal_code || null,
    address: addressLine,
    nace_code: nace,
    industry_tags: [`oc:${jur}`, nace ? `code:${nace.slice(0, 2)}` : null].filter(Boolean) as string[],
    is_import_export: ie,
    primary_source: 'opencorporates',
    source_ids: { opencorporates: `${jur}/${num}` },
    enrichment_score: 15,                      // legal_name + jurisdiction + CRN (no contact yet)
  }
}

export async function runOpenCorporatesIngest(
  opts: ConnectorOptions & { jurisdictions?: string[]; queries?: string[]; pagesPerJurisdiction?: number } = {},
): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      jurisdictions: [] as string[],
      api_calls: 0,
      rate_limited: false,
      monthly_quota_estimate: 500,
    },
  }
  const jurisdictions = (opts.jurisdictions && opts.jurisdictions.length > 0)
    ? opts.jurisdictions
    : DEFAULT_JURISDICTIONS
  const queries = (opts.queries && opts.queries.length > 0) ? opts.queries : IE_QUERY_SEEDS
  const pagesCap = opts.pagesPerJurisdiction ?? DEFAULT_PAGES_PER_JURISDICTION
  const meta = result.metadata as Record<string, unknown>
  const seenKeys = new Set<string>()

  try {
    const sb = vaultClient()
    let apiCalls = 0
    let rateLimitedAbort = false

    outer: for (const jur of jurisdictions) {
      ;(meta.jurisdictions as string[]).push(jur)
      for (const q of queries) {
        for (let page = 1; page <= pagesCap; page++) {
          const url = buildSearchUrl(q, jur, page)
          let resp: OcSearchResponse | { rateLimited: true }
          try {
            resp = await fetchPage(url)
          } catch (err) {
            console.error(`[opencorporates] fetch failed jur=${jur} q="${q}" p=${page}:`, err instanceof Error ? err.message : err)
            break
          }
          apiCalls++
          meta.api_calls = apiCalls

          if ('rateLimited' in resp) {
            console.warn(`[opencorporates] rate-limited at api_calls=${apiCalls}, backing off ${BACKOFF_429_MS}ms then aborting jurisdiction`)
            meta.rate_limited = true
            await sleep(BACKOFF_429_MS)
            rateLimitedAbort = true
            break outer
          }

          const list = resp.results?.companies || []
          if (list.length === 0) break

          const batch: LvCompanyInsert[] = []
          for (const item of list) {
            result.rows_processed++
            const row = rowToCompany(item.company)
            if (!row) {
              result.rows_skipped++
              continue
            }
            const dedupKey = (row.source_ids?.opencorporates as string) || `${row.country_iso}/${row.crn}`
            if (seenKeys.has(dedupKey)) {
              result.rows_skipped++
              continue
            }
            seenKeys.add(dedupKey)
            batch.push(row)
          }

          if (batch.length > 0) {
            if (opts.dryRun) {
              result.rows_inserted += batch.length
            } else {
              // No CRN-unique constraint across jurisdictions, so dedupe via
              // (primary_source, source_ids.opencorporates) — we use a 2-step
              // lookup-then-insert so we don't fight an ON CONFLICT we don't own.
              for (const row of batch) {
                const ocKey = row.source_ids?.opencorporates
                if (!ocKey) {
                  result.rows_skipped++
                  continue
                }
                const { data: existing } = await (sb.from as any)('lv_companies')
                  .select('id')
                  .contains('source_ids', { opencorporates: ocKey })
                  .maybeSingle()
                if (existing?.id) {
                  result.rows_updated++
                  continue
                }
                const { error } = await (sb.from as any)('lv_companies').insert(row)
                if (error) {
                  if (process.env.LEADS_VAULT_DEBUG === '1') {
                    console.error('[opencorporates] insert error', error.message, ocKey)
                  }
                  result.rows_skipped++
                } else {
                  result.rows_inserted++
                }
              }
            }
          }

          if (opts.limit && result.rows_inserted >= opts.limit) break outer

          const totalPages = resp.results?.total_pages ?? 1
          if (page >= totalPages) break
          await sleep(RATE_LIMIT_DELAY_MS)
        }
      }
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'opencorporates',
        delta_count: result.rows_inserted,
        is_full_pull: false,
      })
    }
    if (rateLimitedAbort) {
      result.error = result.error || 'rate_limited (free tier exhausted, retry next month)'
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({
        source_id: 'opencorporates',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }
  return result
}
