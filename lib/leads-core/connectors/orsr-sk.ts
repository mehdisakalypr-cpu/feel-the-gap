/**
 * Slovakia ORSR connector — Obchodný register Slovenskej republiky
 *
 * Source  : Register účtovných závierok (Slovak Financial Statements Register)
 *           https://www.registeruz.sk/cruz-public/api/
 *           Backed by SUSR (Statistical Office) + Justice Ministry ORSR data.
 *           Same ICO / skNace / address data as the business register.
 * License : Slovak Open Data — libre réutilisation, no auth required
 * Auth    : none
 * Volume  : ~2.5M entities (active + dissolved). ~700k active companies.
 *
 * Strategy:
 *   1. Paginate via `pokracovat-za-id` cursor (up to 100 IDs per page).
 *   2. Bulk-fetch each page of IDs from /uctovne-jednotky, then
 *      fetch each entity detail from /uctovna-jednotka?id=N (JSON, fast).
 *   3. Cache raw JSON to /tmp/lead-vault-cache/orsr/ (TTL 7 days).
 *   4. Filter: skip NEVEREJNÁ (not public), keep all others.
 *   5. Map ICO → crn, skNace, mesto, psc, ulica, datumZalozenia → founded_year.
 *   6. Upsert chunks of 500 on conflict crn.
 *
 * Note: registeruz.sk does NOT expose datumZrusenia / dissolution date directly.
 *       Entities without stav field are assumed active (majority). NEVEREJNÁ
 *       (private/non-public) entities are skipped.
 */

import { existsSync, statSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const BASE_URL = 'https://www.registeruz.sk/cruz-public/api'
const CACHE_DIR = '/tmp/lead-vault-cache/orsr'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SLEEP_MS = 80
const BATCH_SIZE = 500
const PAGE_SIZE = 100
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

type RuzListResponse = {
  id: number[]
  existujeDalsieId: boolean
}

type RuzEntity = {
  id?: number
  nazovUJ?: string
  ico?: string
  ulica?: string
  psc?: string
  mesto?: string
  skNace?: string
  pravnaForma?: string
  datumZalozenia?: string
  stav?: string
  zdrojDat?: string
  datumPoslednejUpravy?: string
}

async function readCache<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null
  const stat = statSync(path)
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(15_000),
      })
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 5_000 * (i + 1)))
        continue
      }
      return res
    } catch (e) {
      if (i === retries - 1) throw e
      await new Promise((r) => setTimeout(r, 2_000))
    }
  }
  throw new Error(`fetchWithRetry: all retries exhausted for ${url}`)
}

async function fetchEntityPage(afterId: number): Promise<RuzListResponse> {
  const url = `${BASE_URL}/uctovne-jednotky?zmenene-od=2000-01-01&max-zaznamov=${PAGE_SIZE}&pokracovat-za-id=${afterId}`
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error(`RUZ list HTTP ${res.status}`)
  return (await res.json()) as RuzListResponse
}

async function fetchEntityDetail(id: number): Promise<RuzEntity | null> {
  const cachePath = join(CACHE_DIR, `${id}.json`)
  const cached = await readCache<RuzEntity>(cachePath)
  if (cached) return cached

  const url = `${BASE_URL}/uctovna-jednotka?id=${id}`
  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch (e) {
    console.error(`[orsr-sk] fetch entity ${id}:`, (e as Error).message)
    return null
  }
  if (res.status === 404) return null
  if (!res.ok) {
    console.error(`[orsr-sk] HTTP ${res.status} for entity ${id}`)
    return null
  }
  const data = (await res.json()) as RuzEntity
  try {
    await writeFile(cachePath, JSON.stringify(data), 'utf8')
  } catch {
    // cache write failure is non-fatal
  }
  return data
}

function entityToCompany(e: RuzEntity): LvCompanyInsert | null {
  if (!e.nazovUJ) return null
  if (e.stav === 'NEVEREJNÁ') return null

  const ico = e.ico?.replace(/\s/g, '').padStart(8, '0') ?? null
  const legal_name = e.nazovUJ.trim()
  if (!legal_name) return null

  const foundedYear = e.datumZalozenia
    ? parseInt(e.datumZalozenia.slice(0, 4), 10)
    : null

  const street = e.ulica?.trim() ?? null
  const city = e.mesto?.trim() ?? null
  const postal = e.psc?.replace(/\s/g, '')?.trim() ?? null

  const nace = e.skNace?.trim() ? e.skNace.trim() : null

  return {
    crn: ico ?? `ruz_${e.id}`,
    legal_name,
    country_iso: 'SVK',
    city,
    postal_code: postal ?? null,
    address: street,
    nace_code: nace,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    status: 'active',
    primary_source: 'orsr_sk',
    source_ids: { orsr: ico ?? String(e.id) },
    enrichment_score: 8,
  }
}

export async function runOrsrSkIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 500

  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const sb = vaultClient()
    const batch: LvCompanyInsert[] = []
    let cursor = 0

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (opts.dryRun) {
        result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      const { error, count } = await (sb.from as any)('lv_companies')
        .upsert(batch, { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('[orsr-sk] upsert error:', error.message)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? batch.length
      }
      batch.length = 0
    }

    outer: while (result.rows_processed < limit) {
      let page: RuzListResponse
      try {
        page = await fetchEntityPage(cursor)
      } catch (e) {
        console.error('[orsr-sk] page fetch error:', (e as Error).message)
        result.error = (e as Error).message
        break
      }

      const ids = page.id ?? []
      if (ids.length === 0) break

      for (const id of ids) {
        if (result.rows_processed >= limit) break outer

        result.rows_processed++
        const entity = await fetchEntityDetail(id)

        if (!entity) {
          result.rows_skipped++
          await new Promise((r) => setTimeout(r, SLEEP_MS))
          continue
        }

        const company = entityToCompany(entity)
        if (!company) {
          result.rows_skipped++
          await new Promise((r) => setTimeout(r, SLEEP_MS))
          continue
        }

        batch.push(company)
        if (batch.length >= BATCH_SIZE) await flush()

        await new Promise((r) => setTimeout(r, SLEEP_MS))

        if (result.rows_processed % 100 === 0) {
          console.log(
            `[orsr-sk] ${result.rows_processed}/${limit} processed, ${result.rows_inserted} inserted, cursor=${cursor}`
          )
        }
      }

      cursor = ids[ids.length - 1]
      if (!page.existujeDalsieId) break
    }

    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'orsr_sk',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
      await logSync({ source_id: 'orsr_sk', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[orsr-sk] fatal:', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
  }

  console.log(
    `[orsr-sk] done: ${result.rows_processed} processed, ${result.rows_inserted} inserted, ${result.rows_skipped} skipped, ${result.duration_ms}ms`
  )
  return result
}
