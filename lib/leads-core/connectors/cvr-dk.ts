/**
 * CVR Denmark connector — Det Centrale Virksomhedsregister
 *
 * License: OGL-DK (Open Government Data) — free re-use
 *
 * Primary source: GLEIF LEI Records filtered by country=DK
 *   URL: https://api.gleif.org/api/v1/lei-records?filter[entity.legalAddress.country]=DK
 *   Auth: none
 *   Volume: ~111k companies with LEI (large/mid-cap DK entities)
 *   Field `registeredAs` = CVR number (8-digit)
 *
 * Fallback (individual lookup): https://cvrapi.dk/api?vat=<CVR>&country=dk
 *   Rate limit: 50 req/day on the free tier — used only for targeted lookups,
 *   NOT for bulk scanning.
 *
 * Note on distribution.virk.dk (Elasticsearch bulk):
 *   The endpoint requires a subscription API token from Erhvervsstyrelsen.
 *   It is NOT publicly accessible without auth. This connector uses GLEIF as
 *   the free bulk source covering the commercially-registered DK universe.
 *
 * Country ISO: DNK
 * Source ID: cvr_dk
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/tmp/lead-vault-cache/cvr'
const GLEIF_BASE = 'https://api.gleif.org/api/v1'
const GLEIF_PAGE_SIZE = 100
const CHUNK_SIZE = 500
const SLEEP_MS = 200
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ─── GLEIF types ──────────────────────────────────────────────────────────────

type GleifAddress = {
  city?: string | null
  postalCode?: string | null
  region?: string | null
  country?: string | null
  addressLines?: string[] | null
}

type GleifEntity = {
  legalName?: { name?: string | null } | null
  status?: string | null
  legalAddress?: GleifAddress | null
  registeredAddress?: GleifAddress | null
  registeredAs?: string | null
  legalForm?: { id?: string | null } | null
}

type GleifRegistration = {
  initialRegistrationDate?: string | null
  status?: string | null
}

type GleifRecord = {
  id?: string | null
  attributes?: {
    entity?: GleifEntity | null
    registration?: GleifRegistration | null
  }
}

type GleifResponse = {
  data?: GleifRecord[]
  meta?: {
    pagination?: {
      currentPage?: number
      lastPage?: number
      total?: number
      perPage?: number
    }
  }
  links?: {
    next?: string | null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null
  const m = String(raw).match(/^(\d{4})/)
  if (!m) return null
  const yr = parseInt(m[1], 10)
  return yr >= 1700 && yr <= new Date().getFullYear() ? yr : null
}

function normalizeCrn(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.replace(/\D/g, '')
  if (clean.length === 0) return null
  return clean.padStart(8, '0').slice(-8)
}

function buildAddress(addr: GleifAddress | null | undefined): string | null {
  if (!addr) return null
  const lines = addr.addressLines?.filter(Boolean) ?? []
  return lines.length > 0 ? lines.join(', ') : null
}

// ─── GLEIF mapper ─────────────────────────────────────────────────────────────

function gleifRecordToCompany(record: GleifRecord): LvCompanyInsert | null {
  const attr = record.attributes
  if (!attr) return null

  const entity = attr.entity ?? {}
  const reg = attr.registration ?? {}

  const cvrRaw = entity.registeredAs ?? null
  const crn = normalizeCrn(cvrRaw)
  const legalName = entity.legalName?.name?.trim() ?? null

  if (!legalName) return null

  const entityStatus = (entity.status ?? '').toUpperCase()
  const registrationStatus = (reg.status ?? '').toUpperCase()
  let status: LvCompanyInsert['status'] = 'active'
  if (entityStatus === 'INACTIVE' || registrationStatus === 'LAPSED' || registrationStatus === 'ANNULLED') {
    status = 'dissolved'
  } else if (entityStatus === 'PENDING_VALIDATION') {
    status = 'dormant'
  }

  const legalAddr = entity.legalAddress ?? entity.registeredAddress ?? null
  const address = buildAddress(legalAddr)
  const city = legalAddr?.city?.trim() ?? null
  const postal_code = legalAddr?.postalCode?.trim() ?? null
  const region = legalAddr?.region?.trim() ?? null
  const founded_year = parseYear(reg.initialRegistrationDate)

  const lei = record.id ?? null
  const source_ids: Record<string, string> = {}
  if (crn) source_ids.cvr = crn
  if (lei) source_ids.lei = lei

  return {
    crn: crn ?? lei ?? legalName.slice(0, 40),
    legal_name: legalName,
    country_iso: 'DNK',
    city,
    postal_code,
    region,
    address,
    founded_year,
    status,
    primary_source: 'cvr_dk',
    source_ids,
    enrichment_score: crn ? 14 : 10,
  }
}

// ─── GLEIF DK fetcher ─────────────────────────────────────────────────────────

async function fetchGleifDkPage(page: number, size: number): Promise<GleifResponse | null> {
  const params = new URLSearchParams({
    'filter[entity.legalAddress.country]': 'DK',
    'page[size]': String(size),
    'page[number]': String(page),
  })
  const url = `${GLEIF_BASE}/lei-records?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.warn(`[cvr-dk] GLEIF HTTP ${res.status} (page=${page})`)
      return null
    }
    return (await res.json()) as GleifResponse
  } catch (err) {
    console.warn(`[cvr-dk] GLEIF fetch error (page=${page}):`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Cache dir ────────────────────────────────────────────────────────────────

async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
}

// ─── Main connector ───────────────────────────────────────────────────────────

export async function runCvrDkIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { source: 'gleif_dk_slice' },
  }

  try {
    await ensureCacheDir()
    const sb = vaultClient()
    const targetLimit = opts.limit ?? 1000

    let page = 1
    let lastPage = 999
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
        console.error('[cvr-dk] upsert error', error.message)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? batch.length
      }
      batch.length = 0
    }

    while (page <= lastPage) {
      const pageSize = Math.min(GLEIF_PAGE_SIZE, targetLimit - result.rows_inserted - batch.length)
      if (pageSize <= 0) break

      const resp = await fetchGleifDkPage(page, pageSize)
      if (!resp) {
        console.warn(`[cvr-dk] no response at page=${page}, stopping`)
        break
      }

      const records = resp.data ?? []
      if (records.length === 0) {
        console.log(`[cvr-dk] empty page=${page}, done`)
        break
      }

      if (page === 1) {
        const pagination = resp.meta?.pagination
        lastPage = pagination?.lastPage ?? lastPage
        const total = pagination?.total ?? 0
        console.log(`[cvr-dk] GLEIF DK total=${total} lastPage=${lastPage}`)
        result.metadata = { ...result.metadata, gleif_dk_total: total, gleif_last_page: lastPage }
      }

      for (const record of records) {
        result.rows_processed++
        const row = gleifRecordToCompany(record)
        if (!row) {
          result.rows_skipped++
          continue
        }
        batch.push(row)
      }

      if (batch.length >= CHUNK_SIZE) await flush()

      const fetched = result.rows_inserted + batch.length
      console.log(`[cvr-dk] page=${page}/${lastPage} records=${records.length} total_inserted=${fetched}`)

      if (fetched >= targetLimit) break

      page++
      if (page <= lastPage) await sleep(SLEEP_MS)
    }

    await flush()

    if (!opts.dryRun && result.rows_inserted > 0) {
      await bumpSourceStock({
        source_id: 'cvr_dk',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[cvr-dk]', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'cvr_dk', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
