/**
 * ONRC Romania connector — Oficiul Naţional al Registrului Comerţului
 *
 * Source primaire  : data.gov.ro datasets ONRC (Open Data Romania)
 *   - Dataset "Lista persoanelor juridice înregistrate" / "Companii active"
 *   - URL catalogue : https://data.gov.ro/dataset?tags=onrc
 *   - Formats : CSV/JSON, licence Open Government Licence Romania (OGL-RO)
 * Fallback          : scraping ONRC search public (https://www.onrc.ro/)
 *                     Throttle strict 200ms entre requêtes, limite 1000 par run.
 * Auth              : aucune
 * Country ISO       : ROU
 * source_id         : onrc_ro
 * Volume cible      : ~1.5M entreprises actives RO
 *
 * STATUT 2026-04 :
 *   data.gov.ro ne publie pas encore de dump CSV/JSON bulk ONRC stable
 *   (les datasets référencés pointent vers des PDF ou des exports partiels).
 *   Ce connecteur implémente :
 *     1. Tentative download CSV data.gov.ro (CKAN API resource lookup)
 *     2. Fallback : scraping paginé ONRC search public
 *     3. Si aucune source disponible → retour { error: 'no_public_bulk_source_yet' }
 *        pour permettre reprise future sans crash.
 *
 * Mapping CUI/numar_inreg :
 *   crn          = numar_inreg (ex: J40/12345/2018)
 *   vat_number   = "RO" + cui
 *   legal_name   = denumire
 *   city         = localitate
 *   postal_code  = cod_postal
 *   address      = adresa
 *   nace_code    = caen (CAEN ≅ NACE européen)
 *   status       = ACTIVA→active, DIZOLVATA→dissolved, autres→dormant
 *   founded_year = année extraite de data_inreg
 */

import { createReadStream, existsSync } from 'fs'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const SOURCE_ID = 'onrc_ro' as const
const COUNTRY_ISO = 'ROU'
const CACHE_DIR = '/root/leads-vault/cache/onrc-ro'
const SLEEP_MS = 200
const BATCH_SIZE = 500
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── data.gov.ro CKAN API ────────────────────────────────────────────────────
// Known dataset IDs for ONRC data on data.gov.ro
// Searched via: https://data.gov.ro/api/3/action/package_search?q=onrc&rows=20
const CKAN_SEARCH_URL =
  'https://data.gov.ro/api/3/action/package_search?q=onrc+companii&rows=20&sort=score+desc'

type CkanResource = {
  id: string
  url: string
  format: string
  name: string
}

type CkanPackage = {
  id: string
  name: string
  title: string
  resources: CkanResource[]
}

type CkanSearchResult = {
  success: boolean
  result: {
    count: number
    results: CkanPackage[]
  }
}

async function findBulkCsvUrl(): Promise<string | null> {
  try {
    console.log('[onrc-ro] searching data.gov.ro for ONRC bulk CSV...')
    const res = await fetch(CKAN_SEARCH_URL, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[onrc-ro] CKAN search HTTP ${res.status}`)
      return null
    }
    const json = (await res.json()) as CkanSearchResult
    if (!json.success || !json.result?.results?.length) {
      console.warn('[onrc-ro] CKAN search returned 0 results')
      return null
    }

    // Score packages: prefer those with "activ" or "active" in title/name
    const scored = json.result.results.map((pkg) => {
      const titleLower = (pkg.title || '').toLowerCase()
      const nameLower = (pkg.name || '').toLowerCase()
      let score = 0
      if (titleLower.includes('activ') || nameLower.includes('activ')) score += 10
      if (titleLower.includes('firme') || nameLower.includes('firme')) score += 5
      if (titleLower.includes('radiat') || nameLower.includes('radiat')) score -= 20
      if (titleLower.includes('dizolv') || nameLower.includes('dizolv')) score -= 15
      return { pkg, score }
    }).sort((a, b) => b.score - a.score)

    for (const { pkg } of scored) {
      console.log(`[onrc-ro] candidate package: ${pkg.name} — ${pkg.title}`)
      for (const r of pkg.resources || []) {
        const fmt = (r.format || '').toLowerCase()
        const name = (r.name || '').toLowerCase()
        const url = r.url || ''
        const nameLower = name.toLowerCase()
        // Skip resources that are clearly dissolved/radiate lists
        if (nameLower.includes('radiat') || nameLower.includes('dizolv')) continue
        // Accept CSV or ZIP containing CSV; skip PDFs, XLS, SHP
        if ((fmt === 'csv' || fmt === 'zip' || name.endsWith('.csv') || name.endsWith('.zip')) &&
            !fmt.includes('pdf') &&
            url.startsWith('http')) {
          console.log(`[onrc-ro] found candidate resource: ${r.name} (${r.format}) → ${url}`)
          return url
        }
      }
    }
    // Second pass: accept any CSV even if from dissolved dataset (for scaffold testing)
    for (const { pkg } of scored) {
      for (const r of pkg.resources || []) {
        const fmt = (r.format || '').toLowerCase()
        const url = r.url || ''
        if ((fmt === 'csv' || fmt === 'zip') && !fmt.includes('pdf') && url.startsWith('http')) {
          console.log(`[onrc-ro] fallback resource: ${r.name} (${r.format}) → ${url}`)
          return url
        }
      }
    }
    console.warn('[onrc-ro] no CSV/ZIP resource found in CKAN packages')
    return null
  } catch (err) {
    console.warn('[onrc-ro] CKAN lookup error:', (err as Error).message)
    return null
  }
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  console.log(`[onrc-ro] downloading ${url}`)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      console.warn(`[onrc-ro] download HTTP ${res.status}`)
      return false
    }
    const buf = await res.arrayBuffer()
    await writeFile(dest, Buffer.from(buf))
    return true
  } catch (err) {
    console.warn('[onrc-ro] download error:', (err as Error).message)
    return false
  }
}

// ── CSV parsing ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string, sep = ','): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function detectSeparator(header: string): string {
  const commas = (header.match(/,/g) || []).length
  const semis = (header.match(/;/g) || []).length
  const carets = (header.match(/\^/g) || []).length
  const tabs = (header.match(/\t/g) || []).length
  const max = Math.max(commas, semis, carets, tabs)
  if (carets === max && carets > 0) return '^'
  if (tabs === max && tabs > 0) return '\t'
  if (semis === max && semis > 0) return ';'
  return ','
}

type FieldMap = Record<string, number>

function buildFieldMap(header: string[]): FieldMap {
  const map: FieldMap = {}
  header.forEach((h, i) => { map[h.toLowerCase().trim()] = i })
  return map
}

function get(cols: string[], map: FieldMap, ...keys: string[]): string {
  for (const k of keys) {
    const idx = map[k]
    if (idx !== undefined && cols[idx]) return cols[idx].trim()
  }
  return ''
}

function mapStatus(stare: string): LvCompanyInsert['status'] {
  const s = stare.toUpperCase()
  if (s.includes('ACTIV')) return 'active'
  if (s.includes('DIZOLV') || s.includes('LICHIDAT') || s.includes('RADIAT')) return 'dissolved'
  return 'dormant'
}

function parseRow(cols: string[], map: FieldMap): LvCompanyInsert | null {
  const legalName = get(cols, map, 'denumire', 'denumire_firma', 'company_name', 'nume')
  const numarInreg = get(cols, map,
    'numar_inreg', 'nr_inreg', 'numar_inregistrare', 'j_numar', 'j',
    'cod_inmatriculare', 'nr_inmatriculare', 'euid'
  )
  const cui = get(cols, map, 'cui', 'cod_unic_inregistrare', 'cod_fiscal', 'cif')
  if (!legalName) return null

  // Use cod_inmatriculare (J40/12345/2018 format) as crn if numar_inreg absent
  const crn = numarInreg || cui || null
  if (!crn) return null

  const stare = get(cols, map, 'stare', 'stare_firma', 'status', 'stare_inregistrare')
  const dataInreg = get(cols, map, 'data_inreg', 'data_inregistrare', 'data_constituire', 'data')
  const localitate = get(cols, map, 'localitate', 'oras', 'municipiu', 'locality', 'city')
  const codPostal = get(cols, map, 'cod_postal', 'postal_code', 'zip')
  const adresa = get(cols, map, 'adresa', 'adresa_sediu', 'address', 'sediu')
  const caen = get(cols, map, 'caen', 'cod_caen', 'cod_activitate', 'nace')

  const foundedYear = dataInreg
    ? (() => {
        const m = dataInreg.match(/(\d{4})/)
        return m ? parseInt(m[1], 10) : null
      })()
    : null

  const status = stare ? mapStatus(stare) : 'active'
  if (status === 'dissolved') return null

  const sourceIds: Record<string, string> = {}
  if (numarInreg) sourceIds.onrc = numarInreg
  if (cui) sourceIds.cui = cui

  return {
    crn,
    vat_number: cui ? `RO${cui}` : null,
    legal_name: legalName,
    country_iso: COUNTRY_ISO,
    city: localitate || null,
    postal_code: codPostal || null,
    address: adresa || null,
    nace_code: caen || null,
    status,
    founded_year: foundedYear && foundedYear > 1800 && foundedYear <= new Date().getFullYear() ? foundedYear : null,
    primary_source: SOURCE_ID,
    source_ids: Object.keys(sourceIds).length ? sourceIds : undefined,
    enrichment_score: 15,
  }
}

// ── ONRC public search scraping (fallback) ──────────────────────────────────
// ONRC provides a public company search at:
// https://www.onrc.ro/index.php/ro/informatii/interogare-informatii-entitati
// The actual search results are served via a captcha-protected form.
// Rate-limited scraping is therefore not reliably automatable without a solver.
// This function documents the endpoint for future implementation.

async function scrapeOnrcSearch(limit: number): Promise<LvCompanyInsert[]> {
  console.warn('[onrc-ro] ONRC public search requires form submission + CAPTCHA — scraping not feasible without solver')
  console.warn('[onrc-ro] Fallback scrape skipped. Returning empty set.')
  // Future: integrate 2Captcha/AntiCaptcha or use a headless browser with stealth
  // Endpoint: POST https://www.onrc.ro/index.php/ro/informatii/interogare-informatii-entitati
  // Params: denumire, j_prefix (J01-J52), cui, etc.
  // Rate limit: max 1 req/200ms, respecte robots.txt ONRC
  void limit
  return []
}

// ── Ingest from CSV ─────────────────────────────────────────────────────────

async function ingestCsv(csvPath: string, opts: ConnectorOptions, result: SyncResult): Promise<void> {
  const sb = vaultClient()
  const rl = createInterface({ input: createReadStream(csvPath, 'utf8'), crlfDelay: Infinity })
  const batch: LvCompanyInsert[] = []
  let fieldMap: FieldMap | null = null
  let sep = ','

  const flush = async (): Promise<void> => {
    if (!batch.length) return
    if (opts.dryRun) {
      result.rows_inserted += batch.length
      batch.length = 0
      return
    }
    const { error } = await (sb.from as any)('lv_companies')
      .upsert(batch, { onConflict: 'crn', ignoreDuplicates: false })
    if (error) {
      console.error('[onrc-ro] upsert error', error.message)
      result.rows_skipped += batch.length
    } else {
      result.rows_inserted += batch.length
    }
    batch.length = 0
  }

  let firstLine = true
  for await (const rawLine of rl) {
    const line = rawLine.trim()
    if (!line) continue

    if (firstLine) {
      sep = detectSeparator(line)
      const headers = line.split(sep).map((h) => h.replace(/"/g, '').toLowerCase().trim())
      fieldMap = buildFieldMap(headers)
      console.log(`[onrc-ro] CSV columns (sep='${sep}'): ${headers.slice(0, 10).join(', ')}`)
      firstLine = false
      continue
    }

    result.rows_processed++
    if (!fieldMap) { result.rows_skipped++; continue }

    const cols = parseCSVLine(line, sep)
    const row = parseRow(cols, fieldMap)
    if (!row) { result.rows_skipped++; continue }

    batch.push(row)
    if (batch.length >= BATCH_SIZE) await flush()

    if (opts.limit && result.rows_inserted + batch.length >= opts.limit) {
      await flush()
      break
    }
  }
  await flush()
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function runOnrcRoIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      strategy: 'none',
      source_url: null,
      note: '',
    },
  }
  const meta = result.metadata as Record<string, unknown>

  await mkdir(CACHE_DIR, { recursive: true })

  try {
    // Step 1 — attempt data.gov.ro CKAN bulk CSV
    const cachedCsv = join(CACHE_DIR, 'onrc-companies.csv')
    let csvAvailable = existsSync(cachedCsv)

    if (!csvAvailable) {
      const bulkUrl = await findBulkCsvUrl()
      if (bulkUrl) {
        meta.source_url = bulkUrl
        const destFile = bulkUrl.toLowerCase().endsWith('.zip')
          ? join(CACHE_DIR, 'onrc-companies.zip')
          : cachedCsv
        const ok = await downloadFile(bulkUrl, destFile)
        if (ok) {
          if (destFile.endsWith('.zip')) {
            // Try to unzip and find CSV inside
            const { spawn } = await import('child_process')
            await new Promise<void>((resolve) => {
              const p = spawn('unzip', ['-o', '-j', destFile, '*.csv', '-d', CACHE_DIR], { stdio: 'inherit' })
              p.on('exit', () => resolve())
            })
            // Rename first found csv to canonical name
            const { readdirSync } = await import('fs')
            const csvFiles = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.csv') && f !== 'onrc-companies.csv')
            if (csvFiles.length > 0) {
              const { rename } = await import('fs/promises')
              await rename(join(CACHE_DIR, csvFiles[0]), cachedCsv)
            }
          }
          csvAvailable = existsSync(cachedCsv)
        }
      }
    }

    if (csvAvailable) {
      meta.strategy = 'data_gov_ro_csv'
      console.log('[onrc-ro] ingesting from CSV', cachedCsv)
      await ingestCsv(cachedCsv, opts, result)

      if (!opts.dryRun && result.rows_inserted > 0) {
        await bumpSourceStock({
          source_id: SOURCE_ID,
          delta_count: result.rows_inserted,
          is_full_pull: !opts.delta,
        })
        // Clean cache after successful full ingest
        if (!opts.delta) {
          try { await unlink(cachedCsv) } catch { /* ignore */ }
        }
      }
      meta.note = 'Ingested from data.gov.ro ONRC bulk CSV'
    } else {
      // Step 2 — fallback: ONRC public search scraping
      meta.strategy = 'onrc_scrape_fallback'
      console.log('[onrc-ro] no bulk CSV found — attempting ONRC search scrape')
      const scraped = await scrapeOnrcSearch(opts.limit ?? 1000)

      if (scraped.length > 0) {
        const sb = vaultClient()
        for (let i = 0; i < scraped.length; i += BATCH_SIZE) {
          const batch = scraped.slice(i, i + BATCH_SIZE)
          result.rows_processed += batch.length
          if (!opts.dryRun) {
            const { error } = await (sb.from as any)('lv_companies')
              .upsert(batch, { onConflict: 'crn', ignoreDuplicates: false })
            if (error) {
              console.error('[onrc-ro] upsert error', error.message)
              result.rows_skipped += batch.length
            } else {
              result.rows_inserted += batch.length
            }
          } else {
            result.rows_inserted += batch.length
          }
          await sleep(SLEEP_MS)
        }
        if (!opts.dryRun && result.rows_inserted > 0) {
          await bumpSourceStock({ source_id: SOURCE_ID, delta_count: result.rows_inserted, is_full_pull: false })
        }
        meta.note = 'Ingested via ONRC search scrape'
      } else {
        // Step 3 — no source available, document and return gracefully
        meta.strategy = 'no_source'
        meta.note =
          'Neither data.gov.ro bulk CSV nor ONRC search scrape is currently available. ' +
          'Monitor https://data.gov.ro/dataset?tags=onrc for future CSV dataset release. ' +
          'Scaffold ready: re-run when dataset is published.'
        result.error = 'no_public_bulk_source_yet'
        console.warn('[onrc-ro] No public bulk source available yet. Returning scaffold result.')
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[onrc-ro] fatal error', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
    if (!opts.dryRun) {
      try {
        await logSync({
          source_id: SOURCE_ID,
          operation: opts.delta ? 'delta' : 'ingest',
          result,
        })
      } catch (e) {
        console.error('[onrc-ro] logSync error', (e as Error).message)
      }
    }
  }

  console.log(
    `[onrc-ro] done: strategy=${meta.strategy} processed=${result.rows_processed} inserted=${result.rows_inserted} skipped=${result.rows_skipped} ${result.error ? 'error=' + result.error : ''}`
  )
  return result
}
