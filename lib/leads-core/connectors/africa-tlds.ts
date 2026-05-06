/**
 * Africa multi-source connector — slice of Common Crawl mailto + OpenOwnership BODS
 *
 * Two sub-connectors combined:
 *
 * 1. cc_mailto_africa — Common Crawl mailto extraction on African ccTLDs
 *    TLDs: .za .ng .ke .gh .eg .ma .tn .dz .et .tz .ug .rw .sn .ci
 *    Reuses runCommonCrawlMailto with custom patterns override.
 *    Yields lv_contacts (email/phone) cross-referenced by domain → lv_companies.
 *
 * 2. oo_africa — OpenOwnership BODS bulk dump filtered to African countries
 *    Countries: ZAF NGA KEN GHA EGY MAR TUN DZA ETH TZA UGA RWA SEN CIV
 *    Reuses the OpenOwnership BODS streaming logic, filtering by nationality/address country.
 *    Yields lv_persons (beneficial owners) linked to companies via sentinel.
 *
 * License:
 *   - Common Crawl: CC BY 4.0 — free commercial use with attribution
 *   - OpenOwnership BODS: ODC-BY — free commercial use with attribution
 *
 * Cost: €0 (no API key required for either source)
 */

import { createReadStream, existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { createGunzip } from 'zlib'
import { createWriteStream } from 'fs'
import { runCommonCrawlMailto } from './common-crawl-mailto'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const AFRICA_TLD_PATTERNS = [
  '*.co.za', '*.za',
  '*.com.ng', '*.ng',
  '*.co.ke', '*.ke',
  '*.com.gh', '*.gh',
  '*.com.eg', '*.eg',
  '*.ma',
  '*.tn',
  '*.dz',
  '*.et',
  '*.co.tz', '*.tz',
  '*.co.ug', '*.ug',
  '*.co.rw', '*.rw',
  '*.sn',
  '*.ci',
]

const AFRICA_ISO3_SET = new Set([
  'ZAF', 'NGA', 'KEN', 'GHA', 'EGY', 'MAR', 'TUN', 'DZA', 'ETH', 'TZA', 'UGA', 'RWA', 'SEN', 'CIV',
])

const OO_CACHE_DIR = '/root/leads-vault/cache/openownership'
const OO_GZ_FILE = join(OO_CACHE_DIR, 'statements.latest.jsonl.gz')
const OO_JSONL_FILE = join(OO_CACHE_DIR, 'statements.latest.jsonl')
const OO_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const OO_DUMP_URL = 'https://oo-register-production.s3-eu-west-1.amazonaws.com/public/exports/statements.latest.jsonl.gz'
const BATCH_SIZE = 500

type BodsName = {
  fullName?: string
  familyName?: string
  givenName?: string
  type?: string
}

type BodsPersonStatement = {
  statementType: string
  statementID?: string
  names?: BodsName[]
  birthDate?: string
  nationalities?: Array<{ name?: string; code?: string }>
  addresses?: Array<{ address?: string; country?: string; countryCode?: string }>
}

type AfricaOptions = ConnectorOptions & {
  mode?: 'both' | 'cc' | 'oo'
}

function ooFileAge(): number {
  try { return Date.now() - statSync(OO_GZ_FILE).mtimeMs } catch { return Infinity }
}

async function ensureOoDownload(): Promise<void> {
  await mkdir(OO_CACHE_DIR, { recursive: true })
  if (ooFileAge() < OO_CACHE_TTL_MS) {
    console.log('[oo-africa] using cached OO dump (< 24h)')
    return
  }
  console.log(`[oo-africa] downloading OpenOwnership dump: ${OO_DUMP_URL}`)
  await new Promise<void>((resolve, reject) => {
    const p = spawn('curl', ['-L', '--fail', '--retry', '3', '-o', OO_GZ_FILE, OO_DUMP_URL], { stdio: 'inherit' })
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`curl exit ${code}`)))
  })
}

function extractBestName(names: BodsName[] | undefined): { full: string; first: string | null; last: string | null } {
  if (!names || names.length === 0) return { full: '', first: null, last: null }
  const n = names.find((x) => x.type === 'individual') ?? names[0]
  if (n.fullName) {
    const parts = n.fullName.trim().split(/\s+/)
    return {
      full: n.fullName.trim(),
      first: parts.length > 1 ? parts.slice(0, -1).join(' ') : null,
      last: parts.length > 1 ? parts[parts.length - 1] : parts[0],
    }
  }
  const first = (n.givenName ?? '').trim() || null
  const last = (n.familyName ?? '').trim() || null
  const full = [first, last].filter(Boolean).join(' ')
  return { full, first, last }
}

function isAfricanPerson(stmt: BodsPersonStatement): boolean {
  const nats = stmt.nationalities ?? []
  for (const nat of nats) {
    const code = (nat.code ?? '').toUpperCase()
    if (AFRICA_ISO3_SET.has(code)) return true
    const iso2to3: Record<string, string> = {
      ZA: 'ZAF', NG: 'NGA', KE: 'KEN', GH: 'GHA', EG: 'EGY',
      MA: 'MAR', TN: 'TUN', DZ: 'DZA', ET: 'ETH', TZ: 'TZA',
      UG: 'UGA', RW: 'RWA', SN: 'SEN', CI: 'CIV',
    }
    if (iso2to3[code] && AFRICA_ISO3_SET.has(iso2to3[code])) return true
  }
  for (const addr of stmt.addresses ?? []) {
    const cc = (addr.countryCode ?? addr.country ?? '').toUpperCase().slice(0, 3)
    if (AFRICA_ISO3_SET.has(cc)) return true
    const twoChar = cc.slice(0, 2)
    const iso2to3: Record<string, string> = {
      ZA: 'ZAF', NG: 'NGA', KE: 'KEN', GH: 'GHA', EG: 'EGY',
      MA: 'MAR', TN: 'TUN', DZ: 'DZA', ET: 'ETH', TZ: 'TZA',
      UG: 'UGA', RW: 'RWA', SN: 'SEN', CI: 'CIV',
    }
    if (iso2to3[twoChar] && AFRICA_ISO3_SET.has(iso2to3[twoChar])) return true
  }
  return false
}

async function runOoAfricaIngest(opts: ConnectorOptions, sentinelId: string): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { source: 'oo_africa' },
  }

  try {
    await ensureOoDownload()

    const sb = vaultClient()

    const inputStream = existsSync(OO_JSONL_FILE)
      ? createReadStream(OO_JSONL_FILE)
      : createReadStream(OO_GZ_FILE).pipe(createGunzip())

    const rl = createInterface({ input: inputStream, crlfDelay: Infinity })
    const batch: LvPersonInsert[] = []

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (!opts.dryRun) {
        const { error } = await (sb.from as any)('lv_persons').insert(batch)
        if (error && !error.message.includes('duplicate')) {
          console.error('[oo-africa] insert error', error.message)
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
      result.rows_processed++

      let stmt: BodsPersonStatement
      try {
        stmt = JSON.parse(line) as BodsPersonStatement
      } catch {
        result.rows_skipped++
        continue
      }

      if (stmt.statementType !== 'personStatement') continue
      if (!isAfricanPerson(stmt)) { result.rows_skipped++; continue }

      const { full, first, last } = extractBestName(stmt.names)
      if (!full) { result.rows_skipped++; continue }

      batch.push({
        company_id: sentinelId,
        full_name: full,
        first_name: first,
        last_name: last,
        role: 'Beneficial Owner',
        role_seniority: 'c-level',
        decision_maker_score: 75,
        primary_source: 'opencorporates',
      })

      if (batch.length >= BATCH_SIZE) await flush()
      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break

      if (result.rows_processed % 100000 === 0) {
        console.log(`[oo-africa] processed=${result.rows_processed} african_inserted=${result.rows_inserted}`)
      }
    }

    await flush()
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[oo-africa] fatal', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
  }
  return result
}

async function ensureSentinelCompany(sb: any, dryRun: boolean): Promise<string | null> {
  const { data: existing } = await (sb.from as any)('lv_companies')
    .select('id')
    .eq('primary_source', 'opencorporates')
    .eq('crn', '__openownership_sentinel__')
    .maybeSingle()
  if (existing) return (existing as { id: string }).id
  if (dryRun) return '00000000-0000-0000-0000-000000000001'
  const { data: ins } = await (sb.from as any)('lv_companies')
    .insert({
      crn: '__openownership_sentinel__',
      legal_name: 'OpenOwnership Data — Aggregate',
      country_iso: 'GBR',
      primary_source: 'opencorporates',
      enrichment_score: 0,
    })
    .select('id')
    .single()
  return (ins as { id: string } | null)?.id ?? null
}

export async function runAfricaTldsIngest(opts: AfricaOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const mode = opts.mode ?? 'both'

  const combined: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { mode, africa_tld_patterns: AFRICA_TLD_PATTERNS.length, africa_countries: AFRICA_ISO3_SET.size },
  }

  if (mode === 'cc' || mode === 'both') {
    console.log('[africa] running Common Crawl mailto — African TLDs')
    try {
      const ccResult = await runCommonCrawlMailto({
        limit: opts.limit,
        dryRun: opts.dryRun,
        patterns: AFRICA_TLD_PATTERNS,
      })
      combined.rows_processed += ccResult.rows_processed
      combined.rows_inserted += ccResult.rows_inserted
      combined.rows_updated += ccResult.rows_updated
      combined.rows_skipped += ccResult.rows_skipped
      ;(combined.metadata!.cc_result as unknown) = {
        inserted: ccResult.rows_inserted,
        processed: ccResult.rows_processed,
        error: ccResult.error,
      }
    } catch (err) {
      console.error('[africa] cc_mailto sub-connector error:', err instanceof Error ? err.message : String(err))
    }
  }

  if (mode === 'oo' || mode === 'both') {
    console.log('[africa] running OpenOwnership BODS — Africa country filter')
    try {
      const sb = vaultClient()
      const sentinelId = await ensureSentinelCompany(sb, opts.dryRun ?? false)
      if (!sentinelId) {
        console.error('[africa] could not resolve sentinel company — skipping OO sub-connector')
      } else {
        const ooResult = await runOoAfricaIngest({ limit: opts.limit, dryRun: opts.dryRun }, sentinelId)
        combined.rows_processed += ooResult.rows_processed
        combined.rows_inserted += ooResult.rows_inserted
        combined.rows_updated += ooResult.rows_updated
        combined.rows_skipped += ooResult.rows_skipped
        ;(combined.metadata!.oo_result as unknown) = {
          inserted: ooResult.rows_inserted,
          processed: ooResult.rows_processed,
          error: ooResult.error,
        }

        if (!opts.dryRun && ooResult.rows_inserted > 0) {
          await bumpSourceStock({ source_id: 'opencorporates', delta_count: ooResult.rows_inserted })
          await logSync({ source_id: 'opencorporates', operation: 'ingest', result: ooResult })
        }
      }
    } catch (err) {
      console.error('[africa] oo_africa sub-connector error:', err instanceof Error ? err.message : String(err))
    }
  }

  combined.duration_ms = Date.now() - t0
  return combined
}
