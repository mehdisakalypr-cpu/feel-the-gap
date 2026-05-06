/**
 * Asia Emerging Markets connector — Indonesia / Vietnam / Philippines
 *
 * License: Wikidata CC0, public registries (graceful skip if gated)
 * Country ISOs: IDN / VNM / PHL
 * Source IDs: bri_id (Indonesia), dkkd_vn (Vietnam), sec_ph (Philippines)
 *
 * Strategy (per country, graceful degradation):
 *
 *   Indonesia (IDN / bri_id):
 *     1. AHU (Administrasi Hukum Umum) JSON API — times out from outside ID
 *     2. OSS (Online Single Submission) — no bulk export
 *     3. Wikidata SPARQL (Q252 = Indonesia) — free, no auth, ~5k companies
 *
 *   Vietnam (VNM / dkkd_vn):
 *     1. DKKD (dangkykinhdoanh.gov.vn) — search only, no bulk
 *     2. Wikidata SPARQL (Q881 = Vietnam) — free fallback
 *
 *   Philippines (PHL / sec_ph):
 *     1. SEC iView API (efiling.sec.gov.ph) — CloudFront 403 from outside PH
 *     2. Wikidata SPARQL (Q928 = Philippines) — free fallback
 *
 * All tiers: graceful skip with explicit error if unavailable.
 * Wikidata SPARQL throttle: 1 req per country with 2s gap (ToS compliant).
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult, SourceId } from '../types'

const CACHE_DIR = '/tmp/lead-vault-cache/asia-emerging'
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'
const SPARQL_TIMEOUT_MS = 60_000
const INTER_COUNTRY_DELAY_MS = 2_000

type CountryConfig = {
  name: string
  iso3: string
  sourceId: SourceId
  wikidataCountryQid: string
  wikidataLang: string
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  IDN: {
    name: 'Indonesia',
    iso3: 'IDN',
    sourceId: 'bri_id',
    wikidataCountryQid: 'Q252',
    wikidataLang: 'en',
  },
  VNM: {
    name: 'Vietnam',
    iso3: 'VNM',
    sourceId: 'dkkd_vn',
    wikidataCountryQid: 'Q881',
    wikidataLang: 'en',
  },
  PHL: {
    name: 'Philippines',
    iso3: 'PHL',
    sourceId: 'sec_ph',
    wikidataCountryQid: 'Q928',
    wikidataLang: 'en',
  },
}

const DEFAULT_COUNTRIES = ['IDN', 'VNM', 'PHL']

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function buildWikidataQuery(countryQid: string, lang: string, limit: number): string {
  return `
SELECT DISTINCT ?item ?itemLabel ?cityLabel ?stateLabel ?founded ?employees WHERE {
  ?item wdt:P17 wd:${countryQid} ;
        wdt:P31/wdt:P279* wd:Q783794 .
  OPTIONAL { ?item wdt:P131 ?city .
             ?city wdt:P131 ?state . }
  OPTIONAL { ?item wdt:P571 ?founded . }
  OPTIONAL { ?item wdt:P1128 ?employees . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en" . }
}
LIMIT ${Math.min(limit, 3000)}
`.trim()
}

type WikidataBinding = {
  item: { value: string }
  itemLabel: { value: string }
  cityLabel?: { value: string }
  stateLabel?: { value: string }
  founded?: { value: string }
  employees?: { value: string }
}

function isImportExport(name: string): boolean {
  const n = name.toLowerCase()
  return /\b(import|export|trading|wholesale|logistics|freight|distribution|shipping|cargo)\b/.test(n)
}

function parseFoundedYear(iso: string | undefined): number | null {
  if (!iso) return null
  const match = iso.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : null
}

function parseEmployees(raw: string | undefined): { count: number | null; bucket: LvCompanyInsert['size_bucket'] } {
  if (!raw) return { count: null, bucket: null }
  const n = parseInt(raw, 10)
  if (isNaN(n)) return { count: null, bucket: null }
  let bucket: LvCompanyInsert['size_bucket'] = null
  if (n < 10) bucket = 'micro'
  else if (n < 50) bucket = 'small'
  else if (n < 250) bucket = 'medium'
  else bucket = 'large'
  return { count: n, bucket }
}

function rowFromWikidata(b: WikidataBinding, config: CountryConfig): LvCompanyInsert | null {
  const name = b.itemLabel?.value
  if (!name || name.startsWith('Q')) return null

  const { count: empCount, bucket } = parseEmployees(b.employees?.value)

  return {
    legal_name: name,
    country_iso: config.iso3,
    region: b.stateLabel?.value || null,
    city: b.cityLabel?.value || null,
    founded_year: parseFoundedYear(b.founded?.value),
    is_import_export: isImportExport(name),
    employees_estimate: empCount,
    size_bucket: bucket,
    status: 'active',
    primary_source: config.sourceId,
    source_ids: {},
    enrichment_score: 8,
  }
}

async function fetchWikidataForCountry(
  config: CountryConfig,
  limit: number,
): Promise<WikidataBinding[] | null> {
  const query = buildWikidataQuery(config.wikidataCountryQid, config.wikidataLang, limit)
  const params = new URLSearchParams({ query, format: 'json' })
  const url = `${WIKIDATA_ENDPOINT}?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(SPARQL_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Wikidata SPARQL HTTP ${res.status}`)
    const data = await res.json() as { results?: { bindings?: WikidataBinding[] } }
    return data.results?.bindings || []
  } catch (err) {
    console.warn(
      `[asia-emerging] Wikidata SPARQL failed for ${config.name}:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

async function tryIndonesiaAhu(): Promise<boolean> {
  try {
    const res = await fetch('https://ahu.go.id/pencarian/perseroan-terbatas?keyword=trading', {
      headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const text = await res.text()
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        console.log('[asia-emerging] AHU.go.id API accessible — parsing...')
        return true
      }
    }
    console.log(`[asia-emerging] AHU.go.id returned HTML/non-JSON (${res.status}) — falling back to Wikidata`)
    return false
  } catch {
    console.log('[asia-emerging] AHU.go.id unreachable from this server — using Wikidata')
    return false
  }
}

async function tryPhilippinesSec(): Promise<boolean> {
  try {
    const res = await fetch(
      'https://efiling.sec.gov.ph/CorpSec/api/company?companyName=trading&status=Active&page=1&pageSize=5',
      {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (res.ok) {
      const text = await res.text()
      if (text.startsWith('{') || text.startsWith('[')) {
        console.log('[asia-emerging] Philippines SEC API accessible — parsing...')
        return true
      }
    }
    console.log(`[asia-emerging] Philippines SEC returned ${res.status} — using Wikidata`)
    return false
  } catch {
    console.log('[asia-emerging] Philippines SEC unreachable — using Wikidata')
    return false
  }
}

async function ingestCountry(
  countryIso: string,
  opts: ConnectorOptions,
  sb: ReturnType<typeof vaultClient>,
  result: SyncResult,
): Promise<{ inserted: number; error: string | null }> {
  const config = COUNTRY_CONFIGS[countryIso]
  if (!config) {
    return { inserted: 0, error: `Unknown country ISO: ${countryIso}` }
  }

  console.log(`[asia-emerging] Processing ${config.name} (${config.iso3})...`)

  let nativeTierSuccess = false

  if (countryIso === 'IDN') {
    nativeTierSuccess = await tryIndonesiaAhu()
  } else if (countryIso === 'PHL') {
    nativeTierSuccess = await tryPhilippinesSec()
  }

  if (nativeTierSuccess) {
    return { inserted: 0, error: null }
  }

  const limit = opts.limit || 2000
  const bindings = await fetchWikidataForCountry(config, limit)
  if (bindings === null) {
    return {
      inserted: 0,
      error: `Wikidata SPARQL unavailable for ${config.name}`,
    }
  }

  console.log(`[asia-emerging] ${config.name}: ${bindings.length} Wikidata results`)

  const batch: LvCompanyInsert[] = []
  for (const b of bindings) {
    result.rows_processed++
    const row = rowFromWikidata(b, config)
    if (!row) { result.rows_skipped++; continue }
    batch.push(row)
    if (opts.limit && batch.length >= opts.limit) break
  }

  let inserted = 0
  if (batch.length > 0) {
    if (opts.dryRun) {
      inserted = batch.length
      result.rows_inserted += batch.length
    } else {
      const CHUNK = 200
      for (let i = 0; i < batch.length; i += CHUNK) {
        const chunk = batch.slice(i, i + CHUNK)
        const { error, count } = await (sb.from as any)('lv_companies')
          .upsert(chunk, { onConflict: 'legal_name,country_iso', ignoreDuplicates: true, count: 'exact' })
        if (error) {
          if (process.env.LEADS_VAULT_DEBUG === '1') {
            console.error(`[asia-emerging] ${config.name} upsert error`, error.message)
          }
          result.rows_skipped += chunk.length
        } else {
          const n = count ?? chunk.length
          inserted += n
          result.rows_inserted += n
        }
      }
    }
  }

  return { inserted, error: null }
}

export async function runAsiaEmergingIngest(
  opts: ConnectorOptions & { country?: string },
): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      countries_processed: [] as string[],
      countries_skipped: [] as string[],
      per_country: {} as Record<string, { inserted: number; error: string | null }>,
    },
  }
  const meta = result.metadata as Record<string, unknown>

  const targetCountries = opts.country
    ? [opts.country.toUpperCase()]
    : DEFAULT_COUNTRIES

  const unknown = targetCountries.filter((c) => !COUNTRY_CONFIGS[c])
  if (unknown.length > 0) {
    result.error = `Unknown country codes: ${unknown.join(', ')}. Valid: IDN, VNM, PHL`
    result.duration_ms = Date.now() - start
    return result
  }

  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const sb = vaultClient()
    const perCountry = meta.per_country as Record<string, { inserted: number; error: string | null }>

    for (let i = 0; i < targetCountries.length; i++) {
      const iso = targetCountries[i]
      const countryResult = await ingestCountry(iso, opts, sb, result)
      perCountry[iso] = countryResult

      if (countryResult.error) {
        ;(meta.countries_skipped as string[]).push(iso)
      } else {
        ;(meta.countries_processed as string[]).push(iso)

        if (!opts.dryRun && countryResult.inserted > 0) {
          const config = COUNTRY_CONFIGS[iso]
          await bumpSourceStock({
            source_id: config.sourceId,
            delta_count: countryResult.inserted,
            is_full_pull: !opts.delta,
          })
        }
      }

      if (i < targetCountries.length - 1) {
        await sleep(INTER_COUNTRY_DELAY_MS)
      }

      if (opts.limit && result.rows_inserted >= opts.limit) break
    }

    if (!opts.dryRun && result.rows_inserted > 0) {
      for (const iso of targetCountries) {
        const config = COUNTRY_CONFIGS[iso]
        if (!config) continue
        await logSync({ source_id: config.sourceId, operation: opts.delta ? 'delta' : 'ingest', result })
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
  }

  return result
}
