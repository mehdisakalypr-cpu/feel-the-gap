/**
 * India MCA21 connector — Ministry of Corporate Affairs company register
 *
 * License: Open Government Data Platform India (OGD) — free with API key
 * Volume: ~1.5M active companies (CIN-keyed, 21-char format)
 * Country: IND
 *
 * Strategy (multi-tier, graceful degradation):
 *   1. data.gov.in REST API (requires DATA_GOV_IN_API_KEY env var)
 *      Resource: MCA company master data dataset
 *      Endpoint: https://data.gov.in/api/1/datastore/resource.json
 *   2. Wikidata SPARQL — free, no auth, ~3k Indian companies with CIN
 *      Falls back automatically if data.gov.in is unreachable or key absent
 *   3. Graceful skip: rows_processed=0 + error message if both unavailable
 *
 * CIN format: {status}{industry5}{state2}{year4}{entity3}{seq6}
 *   e.g. L17110MH2009PLC123456 (Listed, Textile, Maharashtra, 2009, PLC)
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/tmp/lead-vault-cache/india-mca'
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

const DATA_GOV_IN_RESOURCE_IDS = [
  '3e9e65e4-5bb5-4f41-8b0a-1e7e6fb8dc83',
  'f55aba1c-26d4-4f42-88e7-34a7ce6f6af4',
]

const DATA_GOV_IN_BASE = 'https://data.gov.in/api/1/datastore/resource.json'

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'

const INDUSTRY_MAP: Record<string, string[]> = {
  '01': ['agriculture', 'farming'],
  '17': ['textile', 'manufacturing'],
  '24': ['chemicals', 'manufacturing'],
  '46': ['wholesale', 'import-export'],
  '47': ['retail', 'distribution'],
  '49': ['transport', 'logistics'],
  '50': ['shipping', 'transport'],
  '52': ['warehousing', 'logistics'],
  '61': ['telecom', 'services'],
  '62': ['software', 'technology'],
  '64': ['finance', 'banking'],
}

type DataGovRecord = {
  company_name?: string
  cin?: string
  company_status?: string
  registered_state?: string
  date_of_incorporation?: string
  authorised_cap?: string
  paid_up_capital?: string
  company_class?: string
  company_category?: string
  company_subcategory?: string
  [key: string]: string | undefined
}

type WikidataSparqlResult = {
  results: {
    bindings: Array<{
      item: { value: string }
      itemLabel: { value: string }
      cin?: { value: string }
      city?: { value: string }
      cityLabel?: { value: string }
      stateLabel?: { value: string }
      founded?: { value: string }
      industry?: { value: string }
    }>
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function parseCinIndustry(cin: string): { industryCode: string | null; industryTags: string[] } {
  if (!cin || cin.length < 8) return { industryCode: null, industryTags: [] }
  const industryRaw = cin.slice(1, 6).replace(/^0+/, '') || cin.slice(1, 3)
  const prefix2 = cin.slice(1, 3)
  const tags = INDUSTRY_MAP[prefix2] || []
  return { industryCode: industryRaw, industryTags: tags }
}

function isImportExport(cin: string, name: string): boolean {
  const nameLower = name.toLowerCase()
  if (/\b(import|export|trading|wholesale|logistics|freight|forwarding|distrib)\b/.test(nameLower)) {
    return true
  }
  const prefix2 = cin.slice(1, 3)
  return ['46', '49', '50', '52'].includes(prefix2)
}

function parseFoundedYear(raw: string | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : null
}

function rowFromDataGov(rec: DataGovRecord): LvCompanyInsert | null {
  const name = (rec.company_name || '').trim()
  const cin = (rec.cin || '').trim().toUpperCase()
  if (!name || !cin) return null

  const statusRaw = (rec.company_status || '').toLowerCase()
  if (statusRaw && statusRaw !== 'active') return null

  const { industryCode, industryTags } = parseCinIndustry(cin)
  const ie = isImportExport(cin, name)

  return {
    legal_name: name,
    country_iso: 'IND',
    region: rec.registered_state || null,
    founded_year: parseFoundedYear(rec.date_of_incorporation),
    sic_code: industryCode,
    industry_tags: industryTags.length > 0 ? industryTags : undefined,
    is_import_export: ie,
    status: 'active',
    primary_source: 'mca_in',
    source_ids: { mca_in: cin },
    enrichment_score: 12,
  }
}

async function fetchDataGovPage(
  resourceId: string,
  apiKey: string,
  offset: number,
  limit: number,
): Promise<{ records: DataGovRecord[]; total: number } | null> {
  const params = new URLSearchParams({
    'resource_id': resourceId,
    'api-key': apiKey,
    'limit': String(limit),
    'offset': String(offset),
    'filters[company_status]': 'Active',
  })
  const url = `${DATA_GOV_IN_BASE}?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 403 || res.status === 401) {
      console.warn(`[mca-in] data.gov.in auth failed (${res.status}) — check DATA_GOV_IN_API_KEY`)
      return null
    }
    if (res.status === 404) {
      console.warn(`[mca-in] resource ${resourceId} not found`)
      return null
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json() as { success?: boolean; records?: DataGovRecord[]; total?: number }
    if (!body.success || !Array.isArray(body.records)) return null
    return { records: body.records, total: body.total ?? 0 }
  } catch (err) {
    console.warn('[mca-in] data.gov.in fetch error:', err instanceof Error ? err.message : err)
    return null
  }
}

async function ingestDataGovIn(
  opts: ConnectorOptions,
  sb: ReturnType<typeof vaultClient>,
  result: SyncResult,
): Promise<boolean> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY
  if (!apiKey) {
    console.log('[mca-in] DATA_GOV_IN_API_KEY not set — skipping data.gov.in tier')
    return false
  }

  let activeResourceId: string | null = null
  for (const rid of DATA_GOV_IN_RESOURCE_IDS) {
    const probe = await fetchDataGovPage(rid, apiKey, 0, 1)
    if (probe !== null) {
      activeResourceId = rid
      break
    }
    await sleep(1000)
  }

  if (!activeResourceId) {
    console.log('[mca-in] No accessible data.gov.in resource found')
    return false
  }

  console.log(`[mca-in] Using data.gov.in resource: ${activeResourceId}`)
  const PAGE = 100
  let offset = 0
  let fetched = true

  while (fetched) {
    const page = await fetchDataGovPage(activeResourceId, apiKey, offset, PAGE)
    if (!page || page.records.length === 0) break

    const batch: LvCompanyInsert[] = []
    for (const rec of page.records) {
      result.rows_processed++
      const row = rowFromDataGov(rec)
      if (!row) { result.rows_skipped++; continue }
      batch.push(row)
    }

    if (batch.length > 0 && !opts.dryRun) {
      const { error, count } = await (sb.from as any)('lv_companies')
        .upsert(batch, { onConflict: 'source_ids->mca_in', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        if (process.env.LEADS_VAULT_DEBUG === '1') {
          console.error('[mca-in] upsert error', error.message)
        }
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? batch.length
      }
    } else if (opts.dryRun) {
      result.rows_inserted += batch.length
    }

    offset += PAGE
    if (opts.limit && result.rows_inserted >= opts.limit) break
    fetched = page.records.length >= PAGE
    if (fetched) await sleep(500)
  }

  return true
}

const WIKIDATA_INDIA_QUERY = `
SELECT DISTINCT ?item ?itemLabel ?cin ?cityLabel ?stateLabel ?founded WHERE {
  ?item wdt:P17 wd:Q668 ;
        wdt:P31/wdt:P279* wd:Q783794 .
  OPTIONAL { ?item wdt:P2062 ?cin . }
  OPTIONAL { ?item wdt:P131 ?city .
             ?city wdt:P131 ?state . }
  OPTIONAL { ?item wdt:P571 ?founded . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 2000
`

type WikidataBinding = WikidataSparqlResult['results']['bindings'][0]

function rowFromWikidata(b: WikidataBinding): LvCompanyInsert | null {
  const name = b.itemLabel?.value
  if (!name || name.startsWith('Q')) return null

  const cin = b.cin?.value?.trim() || null
  const ie = isImportExport(cin || '', name)

  let foundedYear: number | null = null
  if (b.founded?.value) {
    const match = b.founded.value.match(/(\d{4})/)
    foundedYear = match ? parseInt(match[1], 10) : null
  }

  return {
    legal_name: name,
    country_iso: 'IND',
    region: b.stateLabel?.value || null,
    city: b.cityLabel?.value || null,
    founded_year: foundedYear,
    is_import_export: ie,
    status: 'active',
    primary_source: 'mca_in',
    source_ids: cin ? { mca_in: cin } : {},
    enrichment_score: 8,
  }
}

async function ingestWikidata(
  opts: ConnectorOptions,
  sb: ReturnType<typeof vaultClient>,
  result: SyncResult,
): Promise<boolean> {
  console.log('[mca-in] Fetching from Wikidata SPARQL...')
  try {
    const params = new URLSearchParams({ query: WIKIDATA_INDIA_QUERY.trim(), format: 'json' })
    const res = await fetch(`${WIKIDATA_ENDPOINT}?${params.toString()}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`Wikidata SPARQL HTTP ${res.status}`)
    const data = (await res.json()) as WikidataSparqlResult
    const bindings = data.results?.bindings || []
    console.log(`[mca-in] Wikidata returned ${bindings.length} India company results`)

    const batch: LvCompanyInsert[] = []
    for (const b of bindings) {
      result.rows_processed++
      const row = rowFromWikidata(b)
      if (!row) { result.rows_skipped++; continue }
      batch.push(row)
      if (opts.limit && batch.length >= opts.limit) break
    }

    if (batch.length > 0 && !opts.dryRun) {
      const CHUNK = 200
      for (let i = 0; i < batch.length; i += CHUNK) {
        const chunk = batch.slice(i, i + CHUNK)
        const { error, count } = await (sb.from as any)('lv_companies')
          .upsert(chunk, { onConflict: 'legal_name,country_iso', ignoreDuplicates: true, count: 'exact' })
        if (error) {
          if (process.env.LEADS_VAULT_DEBUG === '1') {
            console.error('[mca-in] wikidata upsert error', error.message)
          }
          result.rows_skipped += chunk.length
        } else {
          result.rows_inserted += count ?? chunk.length
        }
      }
    } else if (opts.dryRun) {
      result.rows_inserted += batch.length
    }

    return bindings.length > 0
  } catch (err) {
    console.warn('[mca-in] Wikidata fallback failed:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function runMcaInIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { tiers_tried: [] as string[], tier_used: null as string | null },
  }
  const meta = result.metadata as Record<string, unknown>

  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const sb = vaultClient()

    ;(meta.tiers_tried as string[]).push('data.gov.in')
    const dataGovSuccess = await ingestDataGovIn(opts, sb, result)

    if (!dataGovSuccess) {
      ;(meta.tiers_tried as string[]).push('wikidata_sparql')
      const wikidataSuccess = await ingestWikidata(opts, sb, result)
      if (wikidataSuccess) {
        meta.tier_used = 'wikidata_sparql'
      } else {
        result.error = 'All MCA-IN tiers unavailable: data.gov.in (no key or 404), Wikidata SPARQL (timeout/error). Set DATA_GOV_IN_API_KEY for bulk access.'
        meta.tier_used = null
      }
    } else {
      meta.tier_used = 'data.gov.in'
    }

    if (!opts.dryRun && result.rows_inserted > 0) {
      await bumpSourceStock({
        source_id: 'mca_in',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'mca_in', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
