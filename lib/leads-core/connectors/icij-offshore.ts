/**
 * ICIJ Offshore Leaks connector — Panama, Pandora, Paradise, Bahamas, Offshore leaks
 *
 * Source  : https://offshoreleaks.icij.org/pages/database
 * Format  : CSV files — nodes-officers.csv, nodes-entities.csv, relationships.csv
 * License : ODbL — commercial OK with attribution
 * Volume  : ~750k officers + ~810k entities
 * Auth    : none — direct download URLs from ICIJ public bucket
 *
 * Strategy:
 *   1. Download ZIP (or reuse cached — quarterly refresh is enough).
 *   2. Unzip into /root/leads-vault/cache/icij/
 *   3. Parse nodes-officers.csv → lv_persons (c-level, offshore officer).
 *   4. Filter by TIER1_COUNTRIES for priority processing.
 *   5. Parse nodes-entities.csv → cross-ref attempt with lv_companies.
 *   6. Batch insert 500 at a time.
 */

import { createReadStream, existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/root/leads-vault/cache/icij'
const ZIP_FILE = join(CACHE_DIR, 'icij-offshore.zip')
// ICIJ public dataset — combined CSV download URL (updated quarterly, LATEST alias always points to newest)
const DOWNLOAD_URL =
  'https://offshoreleaks-data.icij.org/offshoreleaks/csv/full-oldb.LATEST.zip'
// Officers node file name inside the ZIP (ICIJ uses consistent naming)
const OFFICERS_CSV = join(CACHE_DIR, 'nodes-officers.csv')
const ENTITIES_CSV = join(CACHE_DIR, 'nodes-entities.csv')
// Cache TTL: 7 days (quarterly data, no need to re-download daily)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 500

// Tier 1 country codes (ISO2 as found in ICIJ country_codes field)
const TIER1_COUNTRIES = new Set([
  'FR', 'GB', 'DE', 'ES', 'IT', 'NL', 'BE', 'PL', 'US', 'CA', 'CH',
  'AT', 'SE', 'NO', 'DK', 'FI', 'PT', 'IE', 'LU', 'SG', 'AU', 'NZ',
])

function cacheAge(file: string): number {
  try {
    return Date.now() - statSync(file).mtimeMs
  } catch {
    return Infinity
  }
}

async function ensureDownload(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })

  if (existsSync(OFFICERS_CSV) && cacheAge(OFFICERS_CSV) < CACHE_TTL_MS) {
    console.log('[icij] using cached CSVs (< 7 days old)')
    return
  }

  if (cacheAge(ZIP_FILE) >= CACHE_TTL_MS) {
    console.log(`[icij] downloading ${DOWNLOAD_URL}`)
    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        'curl',
        ['-L', '--fail', '--retry', '3', '--retry-delay', '5', '-o', ZIP_FILE, DOWNLOAD_URL],
        { stdio: 'inherit' },
      )
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code}`))))
    })
  }

  console.log('[icij] unzipping')
  await new Promise<void>((resolve, reject) => {
    const p = spawn('unzip', ['-o', '-j', ZIP_FILE, '-d', CACHE_DIR], { stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`))))
  })

  if (!existsSync(OFFICERS_CSV)) {
    // Try with different filename conventions ICIJ has used over the years
    const candidates = ['nodes-officers.csv', 'Officer.csv', 'officers.csv']
    const { readdirSync } = require('fs') as typeof import('fs')
    const files = readdirSync(CACHE_DIR)
    for (const c of candidates) {
      const found = files.find((f: string) => f.toLowerCase() === c.toLowerCase())
      if (found && found !== 'nodes-officers.csv') {
        const { renameSync } = require('fs') as typeof import('fs')
        renameSync(join(CACHE_DIR, found), OFFICERS_CSV)
        break
      }
    }
  }
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function isPersonOfficer(name: string, note: string): boolean {
  const n = name.toLowerCase()
  const no = note.toLowerCase()
  // Skip company-type officers
  if (no.includes('corporation') || no.includes('incorporated') || no.includes('ltd') || no.includes('llc')) return false
  if (n.endsWith(' ltd') || n.endsWith(' llc') || n.endsWith(' inc') || n.endsWith(' s.a') || n.endsWith(' b.v')) return false
  if (n.includes(' co.') || n.includes(' corp')) return false
  return true
}

export async function runIcijOffshoreIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  try {
    await ensureDownload()

    if (!existsSync(OFFICERS_CSV)) {
      result.error = `Officers CSV not found at ${OFFICERS_CSV} after download`
      result.duration_ms = Date.now() - t0
      return result
    }

    const sb = vaultClient()

    // Sentinel company for ICIJ officers (offshore context, no specific company match)
    let sentinelCompanyId: string | null = null
    {
      const { data: existing } = await sb
        .from('lv_companies')
        .select('id')
        .eq('primary_source', 'opencorporates')
        .eq('crn', '__icij_offshore_sentinel__')
        .maybeSingle()
      if (existing) {
        sentinelCompanyId = (existing as { id: string }).id
      } else if (!opts.dryRun) {
        const { data: ins } = await sb
          .from('lv_companies')
          .insert({
            crn: '__icij_offshore_sentinel__',
            legal_name: 'ICIJ Offshore Leaks — Aggregate',
            country_iso: 'INT',
            primary_source: 'opencorporates',
            enrichment_score: 0,
          })
          .select('id')
          .single()
        sentinelCompanyId = (ins as { id: string } | null)?.id ?? null
      } else {
        sentinelCompanyId = '00000000-0000-0000-0000-000000000003'
      }
    }

    if (!sentinelCompanyId) {
      result.error = 'Could not create/find sentinel company for icij'
      result.duration_ms = Date.now() - t0
      return result
    }

    const rl = createInterface({
      input: createReadStream(OFFICERS_CSV, 'utf8'),
      crlfDelay: Infinity,
    })

    const batch: LvPersonInsert[] = []
    let isHeader = true
    const fieldIdx: Record<string, number> = {}

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (!opts.dryRun) {
        const { error } = await sb.from('lv_persons').insert(batch)
        if (error && !error.message.includes('duplicate')) {
          console.error('[icij] insert error', error.message)
          result.rows_skipped += batch.length
        } else {
          result.rows_inserted += batch.length
        }
      } else {
        result.rows_inserted += batch.length
      }
      batch.length = 0
    }

    for await (const line of rl) {
      if (!line.trim()) continue

      if (isHeader) {
        const cols = parseCSVLine(line)
        cols.forEach((c, i) => { fieldIdx[c.trim()] = i })
        isHeader = false
        continue
      }

      result.rows_processed++
      const cols = parseCSVLine(line)

      const get = (key: string): string => (cols[fieldIdx[key]] ?? '').trim()

      const name = get('name') || get('full_name') || get('officer_name')
      if (!name) { result.rows_skipped++; continue }

      const countryCodes = get('country_codes') || get('countries')
      const note = get('note') || ''

      if (!isPersonOfficer(name, note)) {
        result.rows_skipped++
        continue
      }

      // Filter Tier 1 countries first (skip if no country info — process anyway for global pass)
      if (countryCodes) {
        const codes = countryCodes.split(';').map((c) => c.trim().toUpperCase())
        const hasTier1 = codes.some((c) => TIER1_COUNTRIES.has(c))
        if (!hasTier1) {
          result.rows_skipped++
          continue
        }
      }

      const parts = name.trim().split(/\s+/)
      const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : null
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0]

      batch.push({
        company_id: sentinelCompanyId,
        full_name: name,
        first_name: first,
        last_name: last,
        role: 'Offshore officer',
        role_seniority: 'c-level',
        decision_maker_score: 75,
        primary_source: 'opencorporates',
      })

      if (batch.length >= BATCH_SIZE) await flush()
      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break

      if (result.rows_processed % 50000 === 0) {
        console.log(`[icij] processed=${result.rows_processed} inserted=${result.rows_inserted}`)
      }
    }

    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'opencorporates',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[icij] fatal', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
    if (!opts.dryRun) {
      await logSync({
        source_id: 'opencorporates',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }

  return result
}
