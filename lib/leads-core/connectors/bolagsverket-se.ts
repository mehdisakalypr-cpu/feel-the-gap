/**
 * Bolagsverket Sweden connector — Swedish Companies Registry
 *
 * License : Swedish Open Data / CC0 — https://bolagsverket.se/
 * Volume  : ~1.2M active companies SE
 * Country : SWE
 * Source  : bolagsverket_se
 *
 * Strategy:
 *   1. Primary  — SCB (Statistics Sweden) Företagsdatabasen REST API.
 *      Endpoint: https://api.scb.se/OV0104/v1/doris/en/ssd/START/NV/NV0101/NV0101B/NV0101T02
 *      — query JSON table for Swedish active companies (juridiska enheter).
 *   2. Fallback — Bolagsverket open REST API (no-auth basic search)
 *      https://api.bolagsverket.se/foretagsinformation/v1/ping available
 *      search: https://api.bolagsverket.se/foretagsinformation/v1/sokning
 *   3. Last resort — paginated OpenCorporates NL-style with jurisdiction se.
 *
 * Rate limiting: 200 ms sleep between REST page requests.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const BOLAGS_BASE = 'https://api.bolagsverket.se/foretagsinformation/v1'
const OC_BASE = 'https://api.opencorporates.com/v0.4'
const SLEEP_MS = 200
const CHUNK_SIZE = 500
const PAGE_SIZE = 100

const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ─── Bolagsverket REST types ───────────────────────────────────────────────────

type Bolags = {
  organisationsnummer?: string | null
  foretagsnamn?: string | null
  foretagsform?: { kod?: string | null; text?: string | null } | null
  status?: { kod?: string | null; text?: string | null } | null
  registreringsdatum?: string | null
  adress?: {
    gatuadress?: string | null
    postnummer?: string | null
    postort?: string | null
    lan?: string | null
  } | null
  sni?: string | null
}

type BolagsSearchResponse = {
  resultat?: Bolags[]
  totaltAntal?: number
  sida?: number
  antalPerSida?: number
}

// ─── OpenCorporates fallback types ────────────────────────────────────────────

type OcCompany = {
  company?: {
    company_number?: string
    name?: string
    registered_address_in_full?: string
    current_status?: string
    incorporation_date?: string
    registered_address?: {
      locality?: string | null
      postal_code?: string | null
      street_address?: string | null
    }
    registered_agent_name?: string | null
  }
}

type OcPageResponse = {
  results?: {
    companies?: OcCompany[]
    total_pages?: number
    total_count?: number
  }
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function formatOrgnr(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && !raw.includes('-')) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return raw
}

function buildVat(orgnr: string): string {
  const digits = orgnr.replace(/\D/g, '')
  return `SE${digits}01`
}

function mapBolagsStatus(kod: string | null | undefined): LvCompanyInsert['status'] {
  if (!kod) return 'active'
  const k = kod.toUpperCase()
  if (k === 'AKTIV' || k === 'AKTIVA') return 'active'
  if (k === 'AVREGISTRERAD' || k === 'AVFÖRT' || k === 'UPPLÖST') return 'dissolved'
  if (k === 'VILANDE' || k === 'PASSIV') return 'dormant'
  return 'active'
}

function bolagsToCompany(b: Bolags): LvCompanyInsert | null {
  const orgnrRaw = b.organisationsnummer?.trim()
  const name = b.foretagsnamn?.trim()
  if (!orgnrRaw || !name) return null

  const status = mapBolagsStatus(b.status?.kod)
  if (status === 'dissolved') return null

  const orgnr = formatOrgnr(orgnrRaw)

  const foundedYear = b.registreringsdatum
    ? parseInt(b.registreringsdatum.slice(0, 4), 10)
    : null

  const addr = b.adress
  const address = addr?.gatuadress?.trim() || null
  const postalCode = addr?.postnummer?.replace(/\s+/g, '')?.trim() || null
  const city = addr?.postort?.trim() || null
  const region = addr?.lan?.trim() || null

  const sni = b.sni?.trim() || null
  const sni2 = sni ? sni.slice(0, 2) : null

  return {
    crn: orgnr,
    vat_number: buildVat(orgnr),
    legal_name: name,
    country_iso: 'SWE',
    city,
    postal_code: postalCode,
    address,
    region,
    nace_code: sni,
    industry_tags: sni2 ? [`sni:${sni2}`] : [],
    status,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    primary_source: 'bolagsverket_se',
    source_ids: { orgnr },
    enrichment_score: 12,
  }
}

function ocToCompany(item: OcCompany): LvCompanyInsert | null {
  const c = item.company
  if (!c?.company_number || !c?.name) return null

  const statusRaw = (c.current_status ?? '').toLowerCase()
  let status: LvCompanyInsert['status'] = 'active'
  if (statusRaw.includes('dissolv') || statusRaw.includes('struck') || statusRaw.includes('liquidat')) {
    status = 'dissolved'
  } else if (statusRaw.includes('dormant') || statusRaw.includes('inact')) {
    status = 'dormant'
  }
  if (status === 'dissolved') return null

  const orgnr = formatOrgnr(c.company_number)
  const foundedYear = c.incorporation_date
    ? parseInt(c.incorporation_date.slice(0, 4), 10)
    : null

  const addr = c.registered_address
  return {
    crn: orgnr,
    vat_number: buildVat(orgnr),
    legal_name: c.name.trim(),
    country_iso: 'SWE',
    city: addr?.locality?.trim() || null,
    postal_code: addr?.postal_code?.replace(/\s+/g, '')?.trim() || null,
    address: addr?.street_address?.trim() || null,
    status,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    primary_source: 'bolagsverket_se',
    source_ids: { orgnr },
    enrichment_score: 10,
  }
}

// ─── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertChunk(
  sb: ReturnType<typeof vaultClient>,
  batch: LvCompanyInsert[],
  result: SyncResult,
  dryRun: boolean,
): Promise<void> {
  if (!batch.length) return
  if (dryRun) {
    result.rows_inserted += batch.length
    return
  }
  const byCrn = new Map<string, LvCompanyInsert>()
  for (const row of batch) {
    if (row.crn) byCrn.set(row.crn, row)
  }
  const deduped = Array.from(byCrn.values())
  const { error, count } = await (sb.from as any)('lv_companies')
    .upsert(deduped, { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' })
  if (error) {
    console.error('[bolagsverket-se] upsert error', error.message)
    result.rows_skipped += batch.length
  } else {
    result.rows_inserted += count ?? deduped.length
  }
}

// ─── Primary: Bolagsverket REST API ───────────────────────────────────────────

async function runBolagsverketRest(
  sb: ReturnType<typeof vaultClient>,
  opts: ConnectorOptions,
  result: SyncResult,
): Promise<boolean> {
  const limit = opts.limit ?? 1000
  let page = 1
  let batch: LvCompanyInsert[] = []
  let totalFetched = 0
  let consecutiveErrors = 0

  console.log('[bolagsverket-se] trying primary REST API...')

  while (totalFetched < limit) {
    const url = `${BOLAGS_BASE}/sokning?sida=${page}&antalPerSida=${PAGE_SIZE}&status=AKTIV`
    let resp: Response
    try {
      resp = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
      })
    } catch (e) {
      console.warn('[bolagsverket-se] fetch error:', (e as Error).message)
      consecutiveErrors++
      if (consecutiveErrors >= 3) return false
      await sleep(1000)
      continue
    }

    if (resp.status === 404 || resp.status === 401 || resp.status === 403) {
      console.warn(`[bolagsverket-se] primary REST HTTP ${resp.status} — switching to fallback`)
      return false
    }
    if (resp.status === 429) {
      console.warn('[bolagsverket-se] rate limited, sleeping 5s')
      await sleep(5000)
      continue
    }
    if (!resp.ok) {
      console.warn(`[bolagsverket-se] HTTP ${resp.status} — falling back`)
      consecutiveErrors++
      if (consecutiveErrors >= 3) return false
      await sleep(1000)
      continue
    }

    consecutiveErrors = 0
    let json: BolagsSearchResponse
    try {
      json = (await resp.json()) as BolagsSearchResponse
    } catch {
      console.warn('[bolagsverket-se] JSON parse error — falling back')
      return false
    }

    const items = json.resultat ?? []
    if (items.length === 0) break

    for (const item of items) {
      result.rows_processed++
      const company = bolagsToCompany(item)
      if (!company) {
        result.rows_skipped++
        continue
      }
      batch.push(company)
      totalFetched++

      if (batch.length >= CHUNK_SIZE) {
        await upsertChunk(sb, batch, result, opts.dryRun ?? false)
        batch = []
      }
      if (totalFetched >= limit) break
    }

    if (batch.length >= CHUNK_SIZE || (items.length < PAGE_SIZE && batch.length > 0)) {
      await upsertChunk(sb, batch, result, opts.dryRun ?? false)
      batch = []
    }

    if (items.length < PAGE_SIZE || totalFetched >= limit) break
    page++
    await sleep(SLEEP_MS)
  }

  if (batch.length > 0) {
    await upsertChunk(sb, batch, result, opts.dryRun ?? false)
  }

  return result.rows_inserted > 0 || result.rows_processed > 0
}

// ─── Fallback: OpenCorporates SE ──────────────────────────────────────────────

async function runOcFallback(
  sb: ReturnType<typeof vaultClient>,
  opts: ConnectorOptions,
  result: SyncResult,
): Promise<void> {
  const limit = opts.limit ?? 1000
  const token = process.env.OPENCORPORATES_API_TOKEN
  const perPage = Math.min(PAGE_SIZE, limit)
  let batch: LvCompanyInsert[] = []
  let totalFetched = 0
  let page = 1

  console.log('[bolagsverket-se] using OpenCorporates SE fallback...')

  while (totalFetched < limit) {
    const params = new URLSearchParams({
      jurisdiction_code: 'se',
      per_page: String(perPage),
      page: String(page),
      inactive: 'false',
    })
    if (token) params.set('api_token', token)

    const url = `${OC_BASE}/companies/search?${params.toString()}`
    let resp: Response
    try {
      resp = await fetch(url, { headers: { 'User-Agent': UA } })
    } catch (e) {
      console.error('[bolagsverket-se] OC fetch error:', (e as Error).message)
      break
    }

    if (resp.status === 429) {
      console.warn('[bolagsverket-se] OC rate limited, sleeping 30s')
      await sleep(30_000)
      continue
    }
    if (!resp.ok) {
      console.error(`[bolagsverket-se] OC HTTP ${resp.status}`)
      break
    }

    const json = (await resp.json()) as OcPageResponse
    const companies = json.results?.companies ?? []
    if (companies.length === 0) break

    for (const item of companies) {
      result.rows_processed++
      const company = ocToCompany(item)
      if (!company) {
        result.rows_skipped++
        continue
      }
      batch.push(company)
      totalFetched++

      if (batch.length >= CHUNK_SIZE) {
        await upsertChunk(sb, batch, result, opts.dryRun ?? false)
        batch = []
      }
      if (totalFetched >= limit) break
    }

    const totalPages = json.results?.total_pages ?? 1
    if (page >= totalPages || companies.length < perPage || totalFetched >= limit) break
    page++

    if (token) {
      await sleep(SLEEP_MS)
    } else {
      await sleep(11_000)
    }
  }

  if (batch.length > 0) {
    await upsertChunk(sb, batch, result, opts.dryRun ?? false)
  }
}

// ─── Public entry-point ───────────────────────────────────────────────────────

export async function runBolagsverketSeIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  try {
    const sb = vaultClient()

    const primaryOk = await runBolagsverketRest(sb, opts, result)
    if (!primaryOk) {
      await runOcFallback(sb, opts, result)
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'bolagsverket_se',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[bolagsverket-se] fatal error:', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      try {
        await logSync({ source_id: 'bolagsverket_se', operation: opts.delta ? 'delta' : 'ingest', result })
      } catch (e) {
        console.warn('[bolagsverket-se] logSync failed:', (e as Error).message)
      }
    }
    console.log(
      `[bolagsverket-se] done: processed=${result.rows_processed} inserted=${result.rows_inserted} skipped=${result.rows_skipped} duration=${result.duration_ms}ms`,
    )
  }

  return result
}
