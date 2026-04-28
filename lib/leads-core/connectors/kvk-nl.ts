/**
 * KvK Netherlands connector — Kamer van Koophandel open data
 *
 * License:
 *   - OpenKvK (primary): CC0 1.0 — https://opendatahandelsregister.nl/
 *   - OpenCorporates (fallback): ODbL — https://opencorporates.com/
 *
 * Volume: ~2.2M active companies in NL; OpenKvK mirrors ~100-500k, OC ~200k.
 *
 * IMPORTANT: KvK official API is PAID (€1.45/lookup) — explicitly REJECTED per
 *   project_leads_500k_legal_stack_2026_04_25. This connector uses free sources only.
 *
 * Strategy:
 *   1. Try OpenKvK REST (https://opendatahandelsregister.nl/api/v1/inschrijvingen?page=N)
 *      — 1000 rows/page, up to ~12 pages. No auth required.
 *   2. If OpenKvK is unreachable/timeout, fall back to OpenCorporates /companies/search
 *      with jurisdiction_code=nl. Uses OPENCORPORATES_API_TOKEN if set (recommended
 *      to lift the 500 req/month free cap).
 *   3. If both fail, returns error with clear message.
 *
 * Country ISO: NLD
 * Source ID: kvk_nl
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const OPEN_KVK_BASE = 'https://opendatahandelsregister.nl/api/v1'
const OC_BASE = 'https://api.opencorporates.com/v0.4'
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

const CHUNK_SIZE = 500
const OPEN_KVK_PAGE_SIZE = 1000
const OC_PER_PAGE = 100
const OC_MAX_PAGES = 10
const OC_RATE_MS = 11_000

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ─── OpenKvK types ────────────────────────────────────────────────────────────

type OkvkAdres = {
  straat?: string | null
  huisnummer?: string | null
  huisnummerToevoeging?: string | null
  postcode?: string | null
  plaats?: string | null
  land?: string | null
}

type OkvkEntry = {
  kvkNummer?: string | null
  rsin?: string | null
  btwNummer?: string | null
  handelsnaam?: string | null
  statutaireNaam?: string | null
  startdatum?: string | null          // YYYY-MM-DD or YYYYMMDD
  beëindigd?: boolean | null          // true = dissolved
  actief?: boolean | null
  adres?: OkvkAdres | null
}

type OkvkPageResponse = {
  data?: OkvkEntry[]
  meta?: {
    total?: number
    per_page?: number
    current_page?: number
    last_page?: number
  }
  items?: OkvkEntry[]                 // alternate envelope some versions use
  total?: number
  page?: number
  pages?: number
}

// ─── OpenCorporates types ─────────────────────────────────────────────────────

type OcCompany = {
  name?: string
  company_number?: string
  incorporation_date?: string | null
  inactive?: boolean
  registered_address?: {
    street_address?: string | null
    locality?: string | null
    postal_code?: string | null
  } | null
  current_status?: string | null
}

type OcSearchResponse = {
  results?: {
    companies?: Array<{ company: OcCompany }>
    total_pages?: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null
  const clean = raw.replace(/-/g, '')
  const yr = parseInt(clean.slice(0, 4), 10)
  if (isNaN(yr) || yr < 1600 || yr > new Date().getFullYear()) return null
  return yr
}

function normalizeKvkNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.replace(/\D/g, '').padStart(8, '0')
  return clean.length >= 8 ? clean.slice(-8) : null
}

// ─── OpenKvK mapping ──────────────────────────────────────────────────────────

function okvkToCompany(entry: OkvkEntry): LvCompanyInsert | null {
  const kvkNr = normalizeKvkNumber(entry.kvkNummer)
  if (!kvkNr) return null

  const legalName = (entry.handelsnaam ?? entry.statutaireNaam ?? '').trim()
  if (!legalName) return null

  const dissolved = entry.beëindigd === true
  const status: LvCompanyInsert['status'] = dissolved ? 'dissolved' : 'active'

  const tradeName =
    entry.handelsnaam && entry.statutaireNaam && entry.handelsnaam !== entry.statutaireNaam
      ? entry.handelsnaam.trim()
      : null

  const adres = entry.adres ?? {}
  const streetParts = [adres.straat, adres.huisnummer, adres.huisnummerToevoeging].filter(Boolean)
  const address = streetParts.length > 0 ? streetParts.join(' ').trim() : null

  const sourceIds: Record<string, string> = { kvk: kvkNr }
  if (entry.rsin) sourceIds.rsin = entry.rsin

  return {
    crn: kvkNr,
    vat_number: entry.btwNummer ? entry.btwNummer.trim() : null,
    legal_name: legalName,
    trade_name: tradeName,
    country_iso: 'NLD',
    city: adres.plaats?.trim() ?? null,
    postal_code: adres.postcode?.trim() ?? null,
    address,
    founded_year: parseYear(entry.startdatum),
    status,
    primary_source: 'kvk_nl',
    source_ids: sourceIds,
    enrichment_score: 12,
  }
}

// ─── OpenCorporates mapping ───────────────────────────────────────────────────

function ocToCompany(c: OcCompany): LvCompanyInsert | null {
  const legal = (c.name ?? '').trim()
  const num = normalizeKvkNumber(c.company_number)
  if (!legal || !num) return null
  if (c.inactive === true) return null

  const addr = c.registered_address ?? {}
  const address = addr.street_address ?? null

  return {
    crn: num,
    legal_name: legal,
    country_iso: 'NLD',
    city: addr.locality ?? null,
    postal_code: addr.postal_code ?? null,
    address,
    founded_year: parseYear(c.incorporation_date),
    status: 'active',
    primary_source: 'kvk_nl',
    source_ids: { kvk: num, opencorporates: `nl/${c.company_number ?? num}` },
    enrichment_score: 10,
  }
}

// ─── OpenKvK fetcher ──────────────────────────────────────────────────────────

async function fetchOpenKvkPage(page: number): Promise<OkvkPageResponse | null> {
  const url = `${OPEN_KVK_BASE}/inschrijvingen?page=${page}&per_page=${OPEN_KVK_PAGE_SIZE}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.warn(`[kvk-nl] OpenKvK HTTP ${res.status} on page ${page}`)
      return null
    }
    return (await res.json()) as OkvkPageResponse
  } catch (err) {
    console.warn(`[kvk-nl] OpenKvK fetch error page ${page}:`, err instanceof Error ? err.message : err)
    return null
  }
}

function extractEntries(resp: OkvkPageResponse): OkvkEntry[] {
  if (Array.isArray(resp.data)) return resp.data
  if (Array.isArray(resp.items)) return resp.items
  return []
}

function extractLastPage(resp: OkvkPageResponse): number {
  if (resp.meta?.last_page) return resp.meta.last_page
  if (resp.pages) return resp.pages
  if (resp.meta?.total && resp.meta.per_page) {
    return Math.ceil(resp.meta.total / resp.meta.per_page)
  }
  return 1
}

// ─── OpenCorporates fallback ──────────────────────────────────────────────────

function ocApiToken(): string | undefined {
  return process.env.OPENCORPORATES_API_TOKEN || undefined
}

const OC_QUERIES = [
  'import export', 'wholesale', 'logistics', 'freight', 'trading', 'distribution',
]

async function runOcFallback(
  limit: number | undefined,
  dryRun: boolean,
  result: SyncResult,
  sb: ReturnType<typeof vaultClient>,
): Promise<void> {
  const seenCrn = new Set<string>()
  let apiCalls = 0

  outer: for (const q of OC_QUERIES) {
    for (let page = 1; page <= OC_MAX_PAGES; page++) {
      const params = new URLSearchParams({
        q,
        jurisdiction_code: 'nl',
        per_page: String(OC_PER_PAGE),
        page: String(page),
        inactive: 'false',
        order: 'score',
      })
      const token = ocApiToken()
      if (token) params.set('api_token', token)
      const url = `${OC_BASE}/companies/search?${params.toString()}`

      let resp: OcSearchResponse
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        })
        if (res.status === 429 || res.status === 403) {
          console.warn('[kvk-nl] OC rate-limited, stopping fallback')
          result.metadata = { ...(result.metadata ?? {}), oc_rate_limited: true }
          break outer
        }
        if (!res.ok) {
          console.warn(`[kvk-nl] OC HTTP ${res.status}`)
          break
        }
        resp = (await res.json()) as OcSearchResponse
      } catch (err) {
        console.warn('[kvk-nl] OC fetch error:', err instanceof Error ? err.message : err)
        break
      }
      apiCalls++

      const list = resp.results?.companies ?? []
      if (list.length === 0) break

      const batch: LvCompanyInsert[] = []
      for (const item of list) {
        result.rows_processed++
        const row = ocToCompany(item.company)
        if (!row || !row.crn || seenCrn.has(row.crn)) {
          result.rows_skipped++
          continue
        }
        seenCrn.add(row.crn)
        batch.push(row)
      }

      if (batch.length > 0) {
        if (dryRun) {
          result.rows_inserted += batch.length
        } else {
          const { error, count } = await (sb.from as any)('lv_companies').upsert(
            batch,
            { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' },
          )
          if (error) {
            console.error('[kvk-nl] OC upsert error', error.message)
            result.rows_skipped += batch.length
          } else {
            result.rows_inserted += count ?? batch.length
          }
        }
      }

      if (limit && result.rows_inserted >= limit) break outer

      const totalPages = resp.results?.total_pages ?? 1
      if (page >= totalPages) break
      await sleep(OC_RATE_MS)
    }
  }

  result.metadata = {
    ...(result.metadata ?? {}),
    oc_api_calls: apiCalls,
    source_used: 'opencorporates_fallback',
  }
}

// ─── Main connector ───────────────────────────────────────────────────────────

export async function runKvkNlIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { source_used: 'openkvik_primary' },
  }

  try {
    const sb = vaultClient()

    // ── Phase 1: probe OpenKvK ─────────────────────────────────────────────
    console.log('[kvk-nl] probing OpenKvK (page 1)...')
    const probe = await fetchOpenKvkPage(1)
    const openKvkAvailable = probe !== null && extractEntries(probe).length > 0

    if (openKvkAvailable && probe) {
      console.log('[kvk-nl] OpenKvK reachable — streaming pages...')
      result.metadata = { ...(result.metadata ?? {}), source_used: 'openkvik_primary' }

      const lastPage = extractLastPage(probe)
      console.log(`[kvk-nl] OpenKvK last_page=${lastPage}`)

      const batch: LvCompanyInsert[] = []

      const flush = async (): Promise<void> => {
        if (!batch.length) return
        if (opts.dryRun) {
          result.rows_inserted += batch.length
          batch.length = 0
          return
        }
        const { error, count } = await (sb.from as any)('lv_companies').upsert(
          batch,
          { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' },
        )
        if (error) {
          console.error('[kvk-nl] upsert error', error.message)
          result.rows_skipped += batch.length
        } else {
          result.rows_inserted += count ?? batch.length
        }
        batch.length = 0
      }

      const processPage = (entries: OkvkEntry[]): void => {
        for (const entry of entries) {
          result.rows_processed++
          const row = okvkToCompany(entry)
          if (!row) {
            result.rows_skipped++
            continue
          }
          batch.push(row)
        }
      }

      // Page 1 already fetched
      processPage(extractEntries(probe))
      if (batch.length >= CHUNK_SIZE) await flush()

      if (!opts.limit || result.rows_inserted + batch.length < opts.limit) {
        for (let page = 2; page <= lastPage; page++) {
          const resp = await fetchOpenKvkPage(page)
          if (!resp) {
            console.warn(`[kvk-nl] OpenKvK page ${page} failed, stopping early`)
            break
          }
          const entries = extractEntries(resp)
          if (entries.length === 0) break

          processPage(entries)
          if (batch.length >= CHUNK_SIZE) await flush()

          if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
          await sleep(500)
        }
      }

      await flush()
    } else {
      // ── Phase 2: fallback to OpenCorporates ───────────────────────────────
      console.log('[kvk-nl] OpenKvK unavailable — falling back to OpenCorporates NL slice...')
      result.metadata = { ...(result.metadata ?? {}), source_used: 'opencorporates_fallback', openkvik_down: true }

      await runOcFallback(opts.limit, opts.dryRun ?? false, result, sb)

      if (result.rows_inserted === 0 && result.rows_processed === 0) {
        result.error = '[kvk-nl] Both OpenKvK and OpenCorporates are unavailable or returned no data. ' +
          'OpenKvK may be down (https://opendatahandelsregister.nl). ' +
          'Set OPENCORPORATES_API_TOKEN to lift OC free-tier limits.'
        return result
      }
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'kvk_nl',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[kvk-nl]', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'kvk_nl', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
