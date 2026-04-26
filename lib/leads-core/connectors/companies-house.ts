/**
 * Companies House UK connector — bulk CSV monthly
 *
 * License: OGL v3.0 — free
 * Volume: ~5M companies, post SIC 46xxx filter ~250k UK trade entities
 * URL: http://download.companieshouse.gov.uk/BasicCompanyDataAsOneFile-{YYYY-MM-DD}.zip
 */

import { createReadStream, existsSync } from 'fs'
import { mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/root/leads-vault/cache/companies-house'

const SIC_TRADE_PREFIXES = [
  '46', // Wholesale (excl. motor)
  '49', // Land transport
  '50', // Water transport
  '51', // Air transport
  '52', // Warehousing & support
  '53', // Postal & courier
]

const FIELD_INDEX: Record<string, number> = {}

function parseHeader(line: string): void {
  const cols = parseCSVLine(line)
  cols.forEach((col, i) => {
    FIELD_INDEX[col.trim()] = i
  })
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function get(cols: string[], key: string): string {
  const idx = FIELD_INDEX[key]
  if (idx === undefined) return ''
  return (cols[idx] ?? '').trim()
}

function rowToCompany(cols: string[]): LvCompanyInsert | null {
  const status = get(cols, 'CompanyStatus').toLowerCase()
  if (status && status !== 'active') return null

  const sicRaw = [
    get(cols, 'SICCode.SicText_1'),
    get(cols, 'SICCode.SicText_2'),
    get(cols, 'SICCode.SicText_3'),
    get(cols, 'SICCode.SicText_4'),
  ].filter(Boolean)

  const primarySic = sicRaw[0]?.split(' - ')[0]?.trim() || ''
  const sic2 = primarySic.slice(0, 2)
  if (!SIC_TRADE_PREFIXES.includes(sic2)) return null

  const crn = get(cols, 'CompanyNumber')
  const legalName = get(cols, 'CompanyName')
  if (!crn || !legalName) return null

  const addressParts = [
    get(cols, 'RegAddress.AddressLine1'),
    get(cols, 'RegAddress.AddressLine2'),
  ].filter(Boolean)
  const address = addressParts.join(', ') || null

  const isImportExport = sic2 === '46' || primarySic.startsWith('522')

  return {
    crn,
    legal_name: legalName,
    country_iso: 'GBR',
    city: get(cols, 'RegAddress.PostTown') || null,
    postal_code: get(cols, 'RegAddress.PostCode') || null,
    address,
    sic_code: primarySic,
    industry_tags: [`sic:${sic2}`],
    is_import_export: isImportExport,
    primary_source: 'companies_house',
    source_ids: { companies_house: crn },
    enrichment_score: 10,
  }
}

function latestStockUrl(): string {
  const d = new Date()
  d.setDate(1) // first of the current month
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `http://download.companieshouse.gov.uk/BasicCompanyDataAsOneFile-${yyyy}-${mm}-01.zip`
}

async function ensureCache(): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })
  const zip = `${CACHE_DIR}/BasicCompanyData.zip`
  // CSV file has dated suffix (e.g. BasicCompanyDataAsOneFile-2026-04-01.csv)
  const findCsv = (): string | null => {
    const fs = require('fs') as typeof import('fs')
    const entries = fs.readdirSync(CACHE_DIR).filter((f: string) => f.startsWith('BasicCompanyDataAsOneFile') && f.endsWith('.csv'))
    return entries.length > 0 ? `${CACHE_DIR}/${entries[0]}` : null
  }
  let existing = findCsv()
  if (existing) return existing
  if (!existsSync(zip)) {
    const url = latestStockUrl()
    console.log(`[companies-house] downloading ${url}`)
    await new Promise<void>((resolve, reject) => {
      const p = spawn('curl', ['-L', '--fail', '-o', zip, url], { stdio: 'inherit' })
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code}`))))
    })
  }
  console.log('[companies-house] unzipping')
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-j', zip, '-d', CACHE_DIR], { stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))))
  })
  existing = findCsv()
  if (!existing) throw new Error('CSV not found after unzip')
  return existing
}

export async function runCompaniesHouseIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }
  try {
    const csv = await ensureCache()
    const sb = vaultClient()
    const rl = createInterface({ input: createReadStream(csv, 'utf8'), crlfDelay: Infinity })
    const batch: LvCompanyInsert[] = []
    const FLUSH = 500
    let isHeader = true

    const flush = async (): Promise<void> => {
      if (!batch.length || opts.dryRun) {
        if (opts.dryRun) result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      const { error, count } = await (sb.from as any)('lv_companies')
        .upsert(batch, { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('[companies-house] upsert error', error.message)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? batch.length
      }
      batch.length = 0
    }

    for await (const line of rl) {
      if (isHeader) {
        parseHeader(line)
        isHeader = false
        continue
      }
      result.rows_processed++
      const cols = parseCSVLine(line)
      const c = rowToCompany(cols)
      if (!c) {
        result.rows_skipped++
        continue
      }
      batch.push(c)
      if (batch.length >= FLUSH) await flush()
      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
    }
    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'companies_house', delta_count: result.rows_inserted, is_full_pull: !opts.delta })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'companies_house', operation: opts.delta ? 'delta' : 'ingest', result })
    }
    if (!opts.dryRun && result.rows_inserted > 0 && !result.error) {
      await cleanCache()
    }
  }
  return result
}

async function cleanCache(): Promise<void> {
  try {
    const entries = await readdir(CACHE_DIR)
    for (const e of entries) {
      try { await unlink(join(CACHE_DIR, e)) } catch { /* ignore */ }
    }
    console.log(`[companies-house] cache purged (${entries.length} files)`)
  } catch (err) {
    console.warn('[companies-house] cache cleanup failed', (err as Error).message)
  }
}
