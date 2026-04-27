/**
 * Sirene FR connector — INSEE bulk CSV
 *
 * License: CC-BY 2.0 — free
 * Volume: ~28M établissements FR, post NAF 46/52 filter ~600k I/E entities
 *
 * Note: INSEE migrated the legacy bucket on 2025-08-06. The previous URL
 * https://files.data.gouv.fr/insee-sirene/StockEtablissement_utf8.zip now
 * 404s. We point at the data.gouv.fr resource API (stable UUID) which 302s
 * to the current snapshot on object.files.data.gouv.fr.
 */

import { createReadStream, existsSync, statfsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { publicClient, vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const STOCK_URL = 'https://www.data.gouv.fr/api/1/datasets/r/0651fb76-bcf3-4f6a-a38d-bc04fa708576'
const CACHE_DIR = '/root/leads-vault/cache/sirene'
const CACHE_FILE = `${CACHE_DIR}/StockEtablissement_utf8.csv`
const CACHE_ZIP = `${CACHE_DIR}/StockEtablissement_utf8.zip`
const CSV_NAME_IN_ZIP = 'StockEtablissement_utf8.csv'

// Disk-guard : zip ~2.8 GB + working overhead ~1 GB. Abort if free < 4 GB.
const MIN_FREE_BYTES = 4 * 1024 * 1024 * 1024

function checkFreeDisk(): { freeGB: number; ok: boolean } {
  const s = statfsSync('/root')
  const free = s.bavail * s.bsize
  return { freeGB: Math.round((free / 1024 / 1024 / 1024) * 10) / 10, ok: free >= MIN_FREE_BYTES }
}

const NAF_IMPORT_EXPORT_PREFIXES = [
  '46', // Commerce de gros (hors automobile)
  '52', // Entreposage et services auxiliaires des transports
  '49', // Transports terrestres
  '50', // Transports par eau
  '51', // Transports aériens
  '53', // Activités de poste et de courrier
]

type SireneRow = {
  siret: string
  siren: string
  nic: string
  enseigne1Etablissement: string
  denominationUsuelleEtablissement: string
  activitePrincipaleEtablissement: string
  numeroVoieEtablissement: string
  typeVoieEtablissement: string
  libelleVoieEtablissement: string
  codePostalEtablissement: string
  libelleCommuneEtablissement: string
  etatAdministratifEtablissement: string
  trancheEffectifsEtablissement: string
}

const FIELD_INDEX: Record<keyof SireneRow, number> = {} as Record<keyof SireneRow, number>

function parseHeader(line: string): void {
  const cols = parseCSVLine(line)
  cols.forEach((col, i) => {
    if (col in FIELD_INDEX || (FIELD_INDEX as Record<string, number>)[col] === undefined) {
      ;(FIELD_INDEX as Record<string, number>)[col] = i
    }
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

function rowToCompany(cols: string[]): LvCompanyInsert | null {
  const get = (k: keyof SireneRow): string => {
    const idx = FIELD_INDEX[k]
    if (idx === undefined) return ''
    return (cols[idx] ?? '').trim()
  }

  const etatAdmin = get('etatAdministratifEtablissement')
  if (etatAdmin && etatAdmin !== 'A') return null // Active only

  const naf = get('activitePrincipaleEtablissement').replace(/\./g, '')
  const naf2 = naf.slice(0, 2)
  if (!NAF_IMPORT_EXPORT_PREFIXES.includes(naf2)) return null

  const siren = get('siren')
  const siret = get('siret')
  if (!siren) return null

  const legalName =
    get('denominationUsuelleEtablissement') ||
    get('enseigne1Etablissement') ||
    `Établissement ${siret}`

  const addressParts = [
    get('numeroVoieEtablissement'),
    get('typeVoieEtablissement'),
    get('libelleVoieEtablissement'),
  ].filter(Boolean)
  const address = addressParts.join(' ').trim() || null

  const sizeMap: Record<string, LvCompanyInsert['size_bucket']> = {
    NN: null,
    '00': 'micro',
    '01': 'micro',
    '02': 'micro',
    '03': 'small',
    '11': 'small',
    '12': 'small',
    '21': 'medium',
    '22': 'medium',
    '31': 'medium',
    '32': 'large',
    '41': 'large',
    '42': 'large',
    '51': 'large',
    '52': 'large',
    '53': 'large',
  }
  const sizeBucket = sizeMap[get('trancheEffectifsEtablissement')] ?? null

  const isImportExport =
    naf2 === '46' || naf.startsWith('522') || naf.startsWith('521')

  return {
    siren,
    legal_name: legalName,
    country_iso: 'FRA',
    city: get('libelleCommuneEtablissement') || null,
    postal_code: get('codePostalEtablissement') || null,
    address,
    nace_code: naf,
    industry_tags: [`naf:${naf2}`],
    is_import_export: isImportExport,
    size_bucket: sizeBucket,
    primary_source: 'sirene',
    source_ids: { sirene: siret },
    enrichment_score: 10, // base — no email/phone yet
  }
}

async function ensureZip(): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })
  if (!existsSync(CACHE_ZIP)) {
    console.log(`[sirene] downloading ${STOCK_URL} → ${CACHE_ZIP}`)
    await new Promise<void>((resolve, reject) => {
      const p = spawn('curl', ['-L', '--fail', '-o', CACHE_ZIP, STOCK_URL], { stdio: 'inherit' })
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code}`))))
    })
  }
  return CACHE_ZIP
}

export async function runSireneIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }
  // Disk-guard before any download
  const disk = checkFreeDisk()
  if (!disk.ok) {
    result.error = `disk_guard: only ${disk.freeGB} GB free, need ≥4 GB. Aborting (would risk filling /).`
    result.duration_ms = Date.now() - start
    return result
  }
  console.log(`[sirene] disk guard OK (${disk.freeGB} GB free)`)

  let unzipProc: ReturnType<typeof spawn> | null = null
  try {
    const zipPath = await ensureZip()
    const sb = vaultClient()

    // Stream-from-zip : `unzip -p` pipes the CSV to stdout, never materialising
    // the 12 GB file on disk. Peak disk = zip only (~2.8 GB).
    console.log(`[sirene] streaming ${CSV_NAME_IN_ZIP} from zip via unzip -p`)
    unzipProc = spawn('unzip', ['-p', zipPath, CSV_NAME_IN_ZIP], { stdio: ['ignore', 'pipe', 'inherit'] })
    if (!unzipProc.stdout) throw new Error('unzip spawn failed: no stdout')

    const rl = createInterface({
      input: unzipProc.stdout,
      crlfDelay: Infinity,
    })

    const batch: LvCompanyInsert[] = []
    const FLUSH_SIZE = 500
    let isHeader = true

    const flush = async (): Promise<void> => {
      if (!batch.length || opts.dryRun) {
        if (opts.dryRun) result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      // Dedup intra-batch: a single SIREN has multiple SIRET établissements,
      // so the same conflict key can repeat in one batch. Postgres ON CONFLICT
      // refuses to update the same row twice — keep the last occurrence.
      const bySiren = new Map<string, LvCompanyInsert>()
      for (const row of batch) {
        const key = (row as any).siren as string | undefined
        if (!key) continue
        bySiren.set(key, row)
      }
      const deduped = Array.from(bySiren.values())
      const { error, count } = await (sb.from as any)('lv_companies')
        .upsert(deduped, { onConflict: 'siren', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('[sirene] upsert error', error.message, 'dedup_size=', deduped.length)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? deduped.length
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
      const company = rowToCompany(cols)
      if (!company) {
        result.rows_skipped++
        continue
      }
      batch.push(company)
      if (batch.length >= FLUSH_SIZE) await flush()
      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
    }
    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'sirene', delta_count: result.rows_inserted, is_full_pull: !opts.delta })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    // Tear down the unzip subprocess so it doesn't linger if we break early
    // (e.g. when --limit is reached).
    if (unzipProc && !unzipProc.killed) {
      try { unzipProc.kill('SIGTERM') } catch { /* already gone */ }
    }
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'sirene', operation: opts.delta ? 'delta' : 'ingest', result })
    }
    if (!opts.dryRun && result.rows_inserted > 0 && !result.error) {
      await cleanCache()
    }
  }
  return result
}

async function cleanCache(): Promise<void> {
  try {
    const { unlink } = await import('fs/promises')
    let removed = 0
    for (const f of [CACHE_FILE, CACHE_ZIP]) {
      try { await unlink(f); removed++ } catch { /* not present */ }
    }
    console.log(`[sirene] cache purged (${removed} files, ~3GB freed)`)
  } catch (err) {
    console.warn('[sirene] cache cleanup failed', (err as Error).message)
  }
}
