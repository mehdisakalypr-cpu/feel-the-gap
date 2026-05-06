/**
 * Zefix Switzerland Federal Commercial Registry connector
 *
 * Strategy: Zefix REST API (zefix.ch/ZefixPublicREST) requires HTTP Basic auth
 * even for read operations. This connector uses the **cantonal Open Data portals**
 * that re-publish Zefix data freely without auth under OGD/Open Government Data
 * licences (CC BY 4.0 or equivalent). Covered cantons and their public JSON endpoints:
 *
 *   BS  Basel-Stadt     data.bs.ch  datasets/100330  ~19k companies
 *   TG  Thurgau         data.tg.ch  datasets/sk-stat-142  ~23k companies
 *   BL  Basel-Landschaft data.bl.ch datasets/12480  ~20k companies
 *
 * Total freely accessible without auth: ~62k companies.
 * Cantons using only the Zefix API (requires ZEFIX_USERNAME + ZEFIX_PASSWORD):
 *   ZH, BE, GE, VD, LU, VS, FR, SG, AG, SO, NE, TI, GR, ZG, AR, AI, GL, SH, SZ,
 *   OW, NW, JU, UR — accessed via POST /api/v1/company/search on zefix.ch.
 *
 * When ZEFIX_USERNAME + ZEFIX_PASSWORD are set, the connector also covers all 26
 * cantons via the Zefix API (50 req/min public, more with auth).
 *
 * License: OGD (Open Government Data) — cantonal portals CC BY 4.0.
 *          Zefix bulk data: Zefix Open Data Terms (free commercial use with attribution).
 *
 * Volume: ~62k (ODS cantons free) — up to ~600k with Zefix auth credentials.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'
const RATE_LIMIT_DELAY_MS = 500
const BACKOFF_429_MS = 5_000
const BATCH_UPSERT_SIZE = 500
const ODS_PAGE_SIZE = 100

const ZEFIX_BASE = 'https://www.zefix.ch/ZefixPublicREST'
const ZEFIX_PAGE_SIZE = 100
const ZEFIX_RATE_DELAY_MS = 1_300

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

type OdsSourceConfig = {
  canton: string
  url: string
  mapFn: (row: Record<string, unknown>) => LvCompanyInsert | null
}

function normalizeUid(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 9) return null
  return `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`
}

function nogaToNace(noga: string | null | undefined): string | null {
  if (!noga) return null
  const digits = noga.replace(/\D/g, '')
  if (digits.length < 4) return null
  return digits.slice(0, 4)
}

function extractYear(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d{4})/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  return y > 1800 && y <= new Date().getFullYear() + 1 ? y : null
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function mapBsRow(row: Record<string, unknown>): LvCompanyInsert | null {
  const legal = str(row.company_legal_name)
  const uid = normalizeUid(str(row.company_uid))
  if (!legal || !uid) return null

  return {
    legal_name: legal,
    crn: uid,
    country_iso: 'CHE',
    region: 'BS',
    city: str(row.locality) || str(row.municipality),
    postal_code: str(row.plz),
    address: str(row.street),
    status: 'active',
    primary_source: 'zefix_ch',
    source_ids: { uid },
    industry_tags: ['zefix:BS'],
    enrichment_score: 18,
  }
}

function mapTgRow(row: Record<string, unknown>): LvCompanyInsert | null {
  const legal = str(row.firmenname)
  const uid = normalizeUid(str(row.firmen_uid))
  if (!legal || !uid) return null

  const street = str(row.strassenname)
  const house = str(row.hausnummer)
  const address = street && house ? `${street} ${house}` : street || house

  return {
    legal_name: legal,
    crn: uid,
    country_iso: 'CHE',
    region: 'TG',
    city: str(row.ort) || str(row.gemeinde),
    postal_code: str(row.plz),
    address,
    status: 'active',
    primary_source: 'zefix_ch',
    source_ids: { uid },
    industry_tags: ['zefix:TG'],
    enrichment_score: 18,
  }
}

function mapBlRow(row: Record<string, unknown>): LvCompanyInsert | null {
  const legal = str(row.firmenname)
  const uid = normalizeUid(str(row.uid))
  if (!legal || !uid) return null

  const statusRaw = str(row.status)
  if (statusRaw && statusRaw !== 'ACTIVE') return null

  const street = str(row.strassenbezeichnung)
  const house = str(row.eingangsnummer_gebaeude)
  const address = street && house ? `${street} ${house}` : street || house

  const noga = str(row.rechtsform_code)

  return {
    legal_name: legal,
    crn: uid,
    country_iso: 'CHE',
    region: 'BL',
    city: str(row.ort) || str(row.firmensitz),
    postal_code: str(row.postleitzahl),
    address,
    nace_code: noga ? nogaToNace(noga) : null,
    status: 'active',
    primary_source: 'zefix_ch',
    source_ids: { uid },
    industry_tags: ['zefix:BL'],
    enrichment_score: 20,
  }
}

const ODS_SOURCES: OdsSourceConfig[] = [
  {
    canton: 'BS',
    url: 'https://data.bs.ch/api/v2/catalog/datasets/100330/exports/json',
    mapFn: mapBsRow,
  },
  {
    canton: 'TG',
    url: 'https://data.tg.ch/api/v2/catalog/datasets/sk-stat-142/exports/json',
    mapFn: mapTgRow,
  },
  {
    canton: 'BL',
    url: 'https://data.bl.ch/api/v2/catalog/datasets/12480/exports/json',
    mapFn: mapBlRow,
  },
]

/** All 26 canton codes for Zefix API (requires auth) */
const ZEFIX_CANTONS: string[] = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR',
  'SO', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TI', 'VD', 'VS',
  'NE', 'GE', 'JU',
]

function buildZefixAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  const user = process.env.ZEFIX_USERNAME
  const pass = process.env.ZEFIX_PASSWORD
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
  }
  return headers
}

function hasZefixAuth(): boolean {
  return !!(process.env.ZEFIX_USERNAME && process.env.ZEFIX_PASSWORD)
}

type ZefixRow = {
  name?: string | null
  uid?: string | null
  chid?: string | null
  legalForm?: { id?: string; name?: { fr?: string; de?: string } | null } | null
  address?: {
    street?: string | null
    houseNumber?: string | null
    swissZipCode?: string | null
    city?: string | null
    canton?: string | null
  } | null
  canton?: string | null
  mainNoga?: string | null
  shabDate?: string | null
}

function mapZefixRow(c: ZefixRow, canton: string): LvCompanyInsert | null {
  const legal = (c.name || '').trim()
  const uid = normalizeUid(c.uid)
  if (!legal || !uid) return null

  const addr = c.address || {}
  const street = str(addr.street)
  const house = str(addr.houseNumber)
  const address = street && house ? `${street} ${house}` : street || house

  const sourceIds: Record<string, string> = { uid }
  if (c.chid) sourceIds.chid = c.chid

  return {
    legal_name: legal,
    crn: uid,
    country_iso: 'CHE',
    region: canton,
    city: str(addr.city),
    postal_code: str(addr.swissZipCode),
    address,
    nace_code: nogaToNace(c.mainNoga),
    founded_year: extractYear(c.shabDate),
    status: 'active',
    primary_source: 'zefix_ch',
    source_ids: sourceIds,
    industry_tags: [`zefix:${canton}`],
    enrichment_score: 22,
  }
}

async function ingestOdsSource(
  source: OdsSourceConfig,
  sb: ReturnType<typeof vaultClient>,
  seenUids: Set<string>,
  result: SyncResult,
  limit: number,
  dryRun: boolean,
): Promise<boolean> {
  const meta = result.metadata as Record<string, unknown>
  let offset = 0
  let totalFetched = 0

  console.log(`[zefix-ch] ODS canton=${source.canton} url=${source.url}`)

  while (true) {
    const url = `${source.url}?limit=${ODS_PAGE_SIZE}&offset=${offset}`
    let res: Response
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    } catch (err) {
      console.error(`[zefix-ch] ODS fetch error canton=${source.canton}:`, err instanceof Error ? err.message : err)
      break
    }

    if (res.status === 429) {
      await sleep(BACKOFF_429_MS)
      meta.rate_limited = true
      break
    }
    if (!res.ok) {
      console.error(`[zefix-ch] ODS HTTP ${res.status} canton=${source.canton} offset=${offset}`)
      break
    }

    const rows = (await res.json()) as Record<string, unknown>[]
    if (!Array.isArray(rows) || rows.length === 0) break

    const batch: LvCompanyInsert[] = []
    for (const row of rows) {
      result.rows_processed++
      const mapped = source.mapFn(row)
      if (!mapped) { result.rows_skipped++; continue }
      const uid = mapped.crn!
      if (seenUids.has(uid)) { result.rows_skipped++; continue }
      seenUids.add(uid)
      batch.push(mapped)
    }

    if (batch.length > 0) {
      if (dryRun) {
        result.rows_inserted += batch.length
      } else {
        for (let i = 0; i < batch.length; i += BATCH_UPSERT_SIZE) {
          const chunk = batch.slice(i, i + BATCH_UPSERT_SIZE)
          const { error } = await (sb.from as any)('lv_companies')
            .upsert(chunk, { onConflict: 'crn', ignoreDuplicates: false })
          if (error) {
            console.error('[zefix-ch] upsert error:', error.message)
            result.rows_skipped += chunk.length
          } else {
            result.rows_inserted += chunk.length
          }
        }
      }
    }

    totalFetched += rows.length
    if (result.rows_inserted >= limit) return true

    if (rows.length < ODS_PAGE_SIZE) break
    offset += ODS_PAGE_SIZE
    await sleep(RATE_LIMIT_DELAY_MS)
  }

  console.log(`[zefix-ch] ODS canton=${source.canton} done, fetched=${totalFetched}`)
  return false
}

type ZefixSearchResponse = {
  list?: ZefixRow[]
  resultSize?: number
}

async function ingestZefixCanton(
  canton: string,
  sb: ReturnType<typeof vaultClient>,
  seenUids: Set<string>,
  result: SyncResult,
  limit: number,
  dryRun: boolean,
): Promise<boolean> {
  const meta = result.metadata as Record<string, unknown>
  let offset = 0
  let total: number | null = null

  console.log(`[zefix-ch] Zefix API canton=${canton}`)

  do {
    const body = JSON.stringify({ activeOnly: true, canton, maxEntries: ZEFIX_PAGE_SIZE, offset, name: '*' })
    let res: Response
    try {
      res = await fetch(`${ZEFIX_BASE}/api/v1/company/search`, {
        method: 'POST',
        headers: buildZefixAuthHeaders(),
        body,
      })
    } catch (err) {
      console.error(`[zefix-ch] API fetch error canton=${canton}:`, err instanceof Error ? err.message : err)
      break
    }

    if (res.status === 429) {
      await sleep(BACKOFF_429_MS)
      res = await fetch(`${ZEFIX_BASE}/api/v1/company/search`, {
        method: 'POST',
        headers: buildZefixAuthHeaders(),
        body,
      })
    }

    if (res.status === 429) { meta.rate_limited = true; break }
    if (res.status === 401) {
      console.error('[zefix-ch] Zefix API requires auth — set ZEFIX_USERNAME + ZEFIX_PASSWORD')
      break
    }
    if (!res.ok) {
      console.error(`[zefix-ch] Zefix API HTTP ${res.status} canton=${canton}`)
      break
    }

    const data = (await res.json()) as ZefixSearchResponse
    if (total === null) {
      total = data.resultSize ?? 0
      console.log(`[zefix-ch] Zefix API canton=${canton} total=${total}`)
    }

    const list = data.list || []
    if (list.length === 0) break

    const batch: LvCompanyInsert[] = []
    for (const c of list) {
      result.rows_processed++
      const row = mapZefixRow(c, canton)
      if (!row) { result.rows_skipped++; continue }
      const uid = row.crn!
      if (seenUids.has(uid)) { result.rows_skipped++; continue }
      seenUids.add(uid)
      batch.push(row)
    }

    if (batch.length > 0) {
      if (dryRun) {
        result.rows_inserted += batch.length
      } else {
        for (let i = 0; i < batch.length; i += BATCH_UPSERT_SIZE) {
          const chunk = batch.slice(i, i + BATCH_UPSERT_SIZE)
          const { error } = await (sb.from as any)('lv_companies')
            .upsert(chunk, { onConflict: 'crn', ignoreDuplicates: false })
          if (error) {
            console.error('[zefix-ch] upsert error:', error.message)
            result.rows_skipped += chunk.length
          } else {
            result.rows_inserted += chunk.length
          }
        }
      }
    }

    if (result.rows_inserted >= limit) return true
    offset += ZEFIX_PAGE_SIZE
    if (offset < (total ?? 0)) await sleep(ZEFIX_RATE_DELAY_MS)
  } while (offset < (total ?? 0))

  return false
}

export async function runZefixChIngest(
  opts: ConnectorOptions & { cantons?: string[] } = {},
): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      sources_processed: [] as string[],
      api_calls: 0,
      rate_limited: false,
      has_zefix_auth: hasZefixAuth(),
      ods_cantons: ODS_SOURCES.map((s) => s.canton),
      zefix_cantons_available: hasZefixAuth() ? ZEFIX_CANTONS.length : 0,
    },
  }

  const meta = result.metadata as Record<string, unknown>
  const seenUids = new Set<string>()
  const limit = opts.limit ?? Infinity

  try {
    const sb = vaultClient()

    const odsToRun = opts.cantons
      ? ODS_SOURCES.filter((s) => opts.cantons!.includes(s.canton))
      : ODS_SOURCES

    for (const source of odsToRun) {
      ;(meta.sources_processed as string[]).push(`ods:${source.canton}`)
      const done = await ingestOdsSource(source, sb, seenUids, result, limit, opts.dryRun ?? false)
      if (done) break
    }

    if (result.rows_inserted < limit && hasZefixAuth()) {
      const cantons = opts.cantons
        ? ZEFIX_CANTONS.filter((c) => opts.cantons!.includes(c))
        : ZEFIX_CANTONS

      for (const canton of cantons) {
        ;(meta.sources_processed as string[]).push(`zefix:${canton}`)
        const done = await ingestZefixCanton(canton, sb, seenUids, result, limit, opts.dryRun ?? false)
        if (done) break
      }
    } else if (!hasZefixAuth() && result.rows_inserted < limit) {
      console.log('[zefix-ch] Set ZEFIX_USERNAME + ZEFIX_PASSWORD to unlock ~600k companies via Zefix API')
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'zefix_ch',
        delta_count: result.rows_inserted,
        is_full_pull: false,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[zefix-ch] fatal:', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({
        source_id: 'zefix_ch',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }

  return result
}
