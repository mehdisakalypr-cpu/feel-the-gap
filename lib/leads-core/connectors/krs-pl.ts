/**
 * KRS Poland connector — Krajowy Rejestr Sądowy (National Court Register)
 *
 * Source  : Polish Ministry of Justice open REST API
 *           https://api-krs.ms.gov.pl/swagger-ui
 * Endpoint: GET /api/krs/OdpisAktualny/{krsNumber}?rejestr=P&format=json
 *           (rejestr=P = przedsiębiorcy / entrepreneurs section)
 * License : Public Polish government data, libre réutilisation (open government
 *           data, no explicit license required by Polish law).
 * Auth    : None
 * Volume  : ~600k–1M active companies registered under KRS rejestr P.
 *           KRS numbers are 10-digit zero-padded integers; most dense range
 *           is 0000001–0001000000; modern registrations go to ~1000000+.
 *           The API returns HTTP 204 (no content) for assigned-but-empty slots,
 *           HTTP 404 for unassigned numbers, HTTP 200 + JSON for valid entries.
 *
 * Strategy:
 *   1. Iterate KRS numbers from `start` (configurable) upward.
 *   2. On HTTP 200 → parse and upsert to lv_companies.
 *   3. On HTTP 404 → skip (number not assigned).
 *   4. On HTTP 204 → skip (assigned but no P-register data).
 *   5. On HTTP 429/503 → retry once after 5s back-off.
 *   6. Cache raw JSON responses to /tmp/lead-vault-cache/krs/ (TTL 7 days).
 *   7. Sleep 200ms between requests (~5 req/sec, polite).
 *   8. Upsert in chunks of 500 on conflict 'crn'.
 */

import { existsSync, statSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const KRS_BASE = 'https://api-krs.ms.gov.pl'
const CACHE_DIR = '/tmp/lead-vault-cache/krs'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SLEEP_MS = 200
const BATCH_SIZE = 500
const BACKOFF_MS = 5_000
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

type KrsAdres = {
  ulica?: string | null
  nrDomu?: string | null
  nrLokalu?: string | null
  miejscowosc?: string | null
  kodPocztowy?: string | null
  kraj?: string | null
  wojewodztwo?: string | null
  powiat?: string | null
  gmina?: string | null
}

type KrsSiedziba = {
  kraj?: string | null
  wojewodztwo?: string | null
  powiat?: string | null
  gmina?: string | null
  miejscowosc?: string | null
}

type KrsIdentyfikatory = {
  nip?: string | null
  regon?: string | null
  krs?: string | null
}

type KrsDanePodmiotu = {
  formaPrawna?: string | null
  identyfikatory?: KrsIdentyfikatory | null
  nazwa?: string | null
}

type KrsNaglowekA = {
  rejestr?: string | null
  numerKRS?: string | null
  dataRejestracjiWKRS?: string | null
}

type KrsSiedzibaIAdres = {
  siedziba?: KrsSiedziba | null
  adres?: KrsAdres | null
}

type KrsDzial1 = {
  danePodmiotu?: KrsDanePodmiotu | null
  siedzibaIAdres?: KrsSiedzibaIAdres | null
}

type KrsDzial6 = {
  likwidacja?: Array<{ otwarcieLikwidacji?: string }> | null
  rozwiazanieUniewaznienie?: { okreslenieOkolicznosci?: string } | null
  zawieszenieWznowienie?: Array<{ dataZawieszenia?: string; datumWznowienia?: string }> | null
}

type KrsOdpisAktualny = {
  odpis?: {
    naglowekA?: KrsNaglowekA | null
    dane?: {
      dzial1?: KrsDzial1 | null
      dzial6?: KrsDzial6 | null
    } | null
  } | null
}

function padKrs(n: number): string {
  return String(n).padStart(10, '0')
}

function cacheFile(krsNumber: string): string {
  return join(CACHE_DIR, `${krsNumber}.json`)
}

function isCacheFresh(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs < CACHE_TTL_MS
  } catch {
    return false
  }
}

type FetchResult = KrsOdpisAktualny | 'not_found' | 'no_content' | 'rate_limited' | null

async function fetchKrsOdpis(krsNumber: string): Promise<FetchResult> {
  const cached = cacheFile(krsNumber)
  if (isCacheFresh(cached)) {
    try {
      const raw = await readFile(cached, 'utf-8')
      if (raw === 'NOT_FOUND') return 'not_found'
      if (raw === 'NO_CONTENT') return 'no_content'
      return JSON.parse(raw) as KrsOdpisAktualny
    } catch {
    }
  }

  const url = `${KRS_BASE}/api/krs/OdpisAktualny/${encodeURIComponent(krsNumber)}?rejestr=P&format=json`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    console.error(`[krs-pl] network error krs=${krsNumber}:`, err instanceof Error ? err.message : err)
    return null
  }

  if (res.status === 404) {
    await writeFile(cached, 'NOT_FOUND', 'utf-8').catch(() => {})
    return 'not_found'
  }

  if (res.status === 204) {
    await writeFile(cached, 'NO_CONTENT', 'utf-8').catch(() => {})
    return 'no_content'
  }

  if (res.status === 429 || res.status === 503) {
    return 'rate_limited'
  }

  if (!res.ok) {
    console.warn(`[krs-pl] HTTP ${res.status} krs=${krsNumber}`)
    return null
  }

  let text: string
  try {
    text = await res.text()
  } catch {
    console.warn(`[krs-pl] failed to read body krs=${krsNumber}`)
    return null
  }

  if (!text || text.trim().length === 0) {
    await writeFile(cached, 'NO_CONTENT', 'utf-8').catch(() => {})
    return 'no_content'
  }

  let body: KrsOdpisAktualny
  try {
    body = JSON.parse(text) as KrsOdpisAktualny
  } catch {
    console.warn(`[krs-pl] invalid JSON krs=${krsNumber}`)
    return null
  }

  await writeFile(cached, text, 'utf-8').catch(() => {})

  return body
}

function buildAddress(adres: KrsAdres | null | undefined): string | null {
  if (!adres) return null
  const parts: string[] = []
  const street = (adres.ulica ?? '').trim()
  const nrDomu = (adres.nrDomu ?? '').trim()
  const nrLokalu = (adres.nrLokalu ?? '').trim()
  if (street) {
    const num = nrLokalu ? `${nrDomu}/${nrLokalu}` : nrDomu
    parts.push(num ? `${street} ${num}`.trim() : street)
  } else if (nrDomu) {
    parts.push(nrDomu)
  }
  const city = (adres.miejscowosc ?? '').trim()
  if (city && !parts.some((p) => p.includes(city))) parts.push(city)
  return parts.length > 0 ? parts.join(', ') : null
}

function parseOdpis(krsNumber: string, body: KrsOdpisAktualny): LvCompanyInsert | null {
  const odpis = body.odpis
  if (!odpis) return null

  const naglowek = odpis.naglowekA
  const dzial1 = odpis.dane?.dzial1
  const dzial6 = odpis.dane?.dzial6

  const danePodmiotu = dzial1?.danePodmiotu
  const nazwa = (danePodmiotu?.nazwa ?? '').trim()
  if (!nazwa) return null

  const identyfikatory = danePodmiotu?.identyfikatory ?? {}
  const nip = (identyfikatory.nip ?? '').trim() || null
  const regon = (identyfikatory.regon ?? '').trim() || null

  const siedzibaIAdres = dzial1?.siedzibaIAdres
  const siedziba = siedzibaIAdres?.siedziba
  const adres = siedzibaIAdres?.adres

  const city = (adres?.miejscowosc ?? siedziba?.miejscowosc ?? '').trim() || null
  const postalCode = (adres?.kodPocztowy ?? '').trim() || null
  const region = (siedziba?.wojewodztwo ?? adres?.wojewodztwo ?? '').trim() || null
  const addressStr = buildAddress(adres)

  let status: 'active' | 'dormant' | 'dissolved' = 'active'

  if (dzial6) {
    const rozwiazanie = dzial6.rozwiazanieUniewaznienie
    if (rozwiazanie?.okreslenieOkolicznosci) {
      const okolicznosci = rozwiazanie.okreslenieOkolicznosci.toUpperCase()
      if (okolicznosci.includes('ROZWI') || okolicznosci.includes('LIKWID') || okolicznosci.includes('UNIEWAZN')) {
        status = 'dissolved'
      }
    }
    if (status === 'active' && dzial6.zawieszenieWznowienie && dzial6.zawieszenieWznowienie.length > 0) {
      const last = dzial6.zawieszenieWznowienie[dzial6.zawieszenieWznowienie.length - 1]
      if (last.dataZawieszenia && !last.datumWznowienia) {
        status = 'dormant'
      }
    }
  }

  const dataRejestracji = (naglowek?.dataRejestracjiWKRS ?? '').trim()
  let foundedYear: number | null = null
  if (dataRejestracji) {
    const parts = dataRejestracji.split('.')
    const y = parts.length === 3 ? parseInt(parts[2], 10) : parseInt(dataRejestracji.slice(0, 4), 10)
    if (!isNaN(y) && y > 1900 && y <= new Date().getFullYear()) {
      foundedYear = y
    }
  }

  const sourceIds: Record<string, string> = { krs: krsNumber }
  if (nip) sourceIds.nip = nip
  if (regon) sourceIds.regon = regon

  return {
    crn: krsNumber,
    vat_number: nip,
    legal_name: nazwa,
    country_iso: 'POL',
    city,
    postal_code: postalCode,
    address: addressStr,
    region,
    status,
    founded_year: foundedYear,
    primary_source: 'krs_pl',
    source_ids: sourceIds,
    enrichment_score: 20,
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function runKrsPlIngest(
  opts: ConnectorOptions & { start?: number } = {},
): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 500
  const startNum = opts.start ?? 1

  await mkdir(CACHE_DIR, { recursive: true })

  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      krs_start: startNum,
      krs_last: startNum,
      not_found: 0,
      no_content: 0,
      rate_limited_retries: 0,
    },
  }

  const meta = result.metadata as Record<string, number>
  const sb = vaultClient()
  let batch: LvCompanyInsert[] = []
  let current = startNum

  const flushBatch = async (): Promise<void> => {
    if (batch.length === 0) return
    if (opts.dryRun) {
      result.rows_inserted += batch.length
      batch = []
      return
    }
    const { error } = await (sb.from as any)('lv_companies')
      .upsert(batch, { onConflict: 'crn', ignoreDuplicates: false })
    if (error) {
      if (process.env.LEADS_VAULT_DEBUG === '1') {
        console.error('[krs-pl] upsert error:', error.message)
      }
      result.rows_skipped += batch.length
    } else {
      result.rows_inserted += batch.length
    }
    batch = []
  }

  try {
    while (result.rows_inserted + batch.length < limit) {
      const krsNumber = padKrs(current)
      current++

      let resp = await fetchKrsOdpis(krsNumber)

      if (resp === 'rate_limited') {
        meta.rate_limited_retries++
        console.warn(`[krs-pl] rate-limited at krs=${krsNumber}, backing off ${BACKOFF_MS}ms`)
        await sleep(BACKOFF_MS)
        resp = await fetchKrsOdpis(krsNumber)
        if (resp === 'rate_limited') {
          result.error = `rate_limited after retry at krs=${krsNumber}`
          break
        }
      }

      result.rows_processed++

      if (resp === 'not_found') {
        meta.not_found++
        result.rows_skipped++
        meta.krs_last = current
        await sleep(SLEEP_MS)
        continue
      }

      if (resp === 'no_content' || resp === null) {
        if (resp === 'no_content') meta.no_content++
        result.rows_skipped++
        meta.krs_last = current
        await sleep(SLEEP_MS)
        continue
      }

      const row = parseOdpis(krsNumber, resp)
      if (!row) {
        result.rows_skipped++
        meta.krs_last = current
        await sleep(SLEEP_MS)
        continue
      }

      batch.push(row)
      meta.krs_last = current

      if (batch.length >= BATCH_SIZE) {
        await flushBatch()
      }

      if (result.rows_processed % 100 === 0) {
        console.log(
          `[krs-pl] krs=${krsNumber} processed=${result.rows_processed} inserted=${result.rows_inserted} skipped=${result.rows_skipped}`,
        )
      }

      await sleep(SLEEP_MS)
    }

    await flushBatch()

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'krs_pl',
        delta_count: result.rows_inserted,
        is_full_pull: false,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[krs-pl] fatal:', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
    if (!opts.dryRun) {
      try {
        await logSync({
          source_id: 'krs_pl',
          operation: opts.delta ? 'delta' : 'ingest',
          result,
        })
      } catch (e) {
        console.error('[krs-pl] logSync error:', (e as Error).message)
      }
    }
  }

  return result
}
