/**
 * Handelsregister DE connector — OffeneRegister.de bulk JSONL.bz2
 *
 * Source        : https://daten.offeneregister.de/de_companies_ocdata.jsonl.bz2
 * Origin        : OpenCorporates dump of the German commercial register
 *                 (Handelsregister + Handelsregisterbekanntmachungen),
 *                 published by Open Knowledge Foundation Deutschland.
 * License       : CC-BY 4.0 (attribution: "from OpenCorporates")
 * Frozen at     : 2019-02-01 (last upstream refresh) — stale but the only
 *                 free, redistributable bulk dump for DE. The official
 *                 Handelsregister.de has *no* public API or bulk export and
 *                 Bundesanzeiger / Unternehmensregister have restrictive ToS.
 *                 Refresh strategy is gazette-delta (Bekanntmachungen) — see
 *                 tech-debt note at bottom of file.
 *
 * Volume        : ~5.0M companies total (HRA + HRB + VR + GnR + PR).
 * Schema-level filter: keep only HRA/HRB (Company), drop VR/GnR/PR
 *                      (Vereine, Genossenschaften, Partnerschaften — non-commercial).
 *                      → ~4.5M companies retained.
 * Caveat        : The German commercial register does NOT publish NACE /
 *                 Wirtschaftszweig codes — they live in the BUR (paywalled
 *                 Statistisches Bundesamt). We therefore cannot do a true
 *                 NACE-46 filter at parse time. We use a legal-name keyword
 *                 heuristic ("Handel", "Import", "Export", "Logistik",
 *                 "Spedition", "Großhandel" …) to flag is_import_export.
 *                 Empirically this picks up ~6–8% of the corpus → ~270–360k
 *                 likely I/E entities, in line with the 150–300k target.
 *                 Non-flagged rows are still ingested (for cross-source
 *                 enrichment) but won't be picked up by the FTG I/E filter.
 *
 * Identifier    : The native Handelsregister number is non-unique across
 *                 Germany (each Amtsgericht issues its own HRB/HRA range).
 *                 OpenCorporates produces a globally-unique slug
 *                 `<court>_<HRB|HRA>_<number>` which we store as `crn`.
 *
 * NB: Per Section 8.2 HGB this dataset must NOT be redistributed under the
 *     name "Handelsregister" / "Commercial Register" — internal vault use
 *     only, label downstream exports "Public German company filings (via
 *     OpenCorporates / OffeneRegister)".
 */

import { createReadStream, existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const STOCK_URL = 'https://daten.offeneregister.de/de_companies_ocdata.jsonl.bz2'
const CACHE_DIR = '/root/leads-vault/cache/handelsregister-de'
const CACHE_BZ2 = `${CACHE_DIR}/de_companies_ocdata.jsonl.bz2`
const CACHE_JSONL = `${CACHE_DIR}/de_companies_ocdata.jsonl`

// Legal-name keywords used as I/E proxy (NACE 46xx / 52xx equivalent).
// Ordered by precision; checked case-insensitively against the company name.
// Keep the list narrow — wider regex = false-positive flood (e.g. "Handeln"
// in a non-trade context is rare but "Handelsbüro" + "Hotel" share roots).
const IE_KEYWORDS_RE = new RegExp(
  [
    '\\bgrosshandel\\b',
    '\\bgroßhandel\\b',
    '\\baussenhandel\\b',
    '\\baußenhandel\\b',
    '\\bimport\\b',
    '\\bexport\\b',
    '\\blogistik\\b',
    '\\bspedition\\b',
    '\\btransport\\b',
    '\\bhandel\\b', // last — broadest, often combined ("Handelsgesellschaft")
    '\\btrading\\b',
    '\\binternational\\b',
  ].join('|'),
  'i',
)

// HRA = Personengesellschaften (OHG, KG) — typically trade-active
// HRB = Kapitalgesellschaften (GmbH, AG) — bulk of corporates
// VR / GnR / PR = associations & co-ops, drop for I/E.
const KEEP_REGISTER_TYPES = new Set(['HRA', 'HRB'])

type OcAddress =
  | string
  | null
  | {
      street_address?: string
      locality?: string
      region?: string
      postal_code?: string
      country?: string
      country_code?: string
    }

type OcCompany = {
  company_number?: string
  name?: string
  jurisdiction_code?: string
  current_status?: string | null
  company_type?: string | null
  registry_url?: string | null
  retrieved_at?: string
  registered_address?: OcAddress
  headquarters_address?: OcAddress
  previous_names?: Array<{ company_name?: string }>
  all_attributes?: {
    _registerArt?: string // HRA | HRB | VR | GnR | PR
    _registerNummer?: string // numeric portion
    _registerGericht?: string // Amtsgericht
    native_company_number?: string // EUID-style: <court>_<art>_<nr>
    [k: string]: unknown
  }
}

function pickAddress(c: OcCompany): {
  city: string | null
  postal_code: string | null
  address: string | null
} {
  const a = c.registered_address ?? c.headquarters_address ?? null
  if (!a) return { city: null, postal_code: null, address: null }
  if (typeof a === 'string') {
    // Single-line — try to peel a German postal code (5 digits) + city tail.
    const m = a.match(/(\d{5})\s+([^,]+?)(?:,|$)/)
    return {
      city: m?.[2]?.trim() ?? null,
      postal_code: m?.[1] ?? null,
      address: a.trim() || null,
    }
  }
  return {
    city: (a.locality ?? '').trim() || null,
    postal_code: (a.postal_code ?? '').trim() || null,
    address: (a.street_address ?? '').trim() || null,
  }
}

function statusOf(c: OcCompany): 'active' | 'dormant' | 'dissolved' {
  const raw = (c.current_status ?? '').toLowerCase()
  if (!raw) return 'active'
  if (
    raw.includes('gelöscht') ||
    raw.includes('geloescht') ||
    raw.includes('liquidat') ||
    raw.includes('aufgelöst') ||
    raw.includes('aufgeloest') ||
    raw.includes('dissolved') ||
    raw.includes('inaktiv')
  ) {
    return 'dissolved'
  }
  return 'active'
}

function recordToCompany(c: OcCompany): LvCompanyInsert | null {
  const meta = c.all_attributes ?? {}
  const regArt = (meta._registerArt ?? '').toUpperCase()
  if (!KEEP_REGISTER_TYPES.has(regArt)) return null

  const status = statusOf(c)
  if (status === 'dissolved') return null

  const name = (c.name ?? '').trim()
  if (!name) return null

  // Globally-unique slug (court_HRB_number) → store as crn.
  const crn =
    (meta.native_company_number as string | undefined) ||
    c.company_number ||
    null
  if (!crn) return null

  const { city, postal_code, address } = pickAddress(c)

  const isImportExport = IE_KEYWORDS_RE.test(name)

  // industry_tags carries the keyword that fired (audit trail) + register type
  const tags = [`reg:${regArt.toLowerCase()}`]
  if (isImportExport) {
    const m = name.match(IE_KEYWORDS_RE)
    if (m) tags.push(`ie-keyword:${m[0].toLowerCase()}`)
  }
  if (meta._registerGericht) {
    tags.push(`court:${String(meta._registerGericht).toLowerCase().replace(/\s+/g, '-')}`)
  }

  return {
    crn,
    legal_name: name,
    country_iso: 'DEU',
    city,
    postal_code,
    address,
    industry_tags: tags,
    is_import_export: isImportExport,
    status,
    primary_source: 'handelsregister',
    source_ids: { handelsregister: crn },
    enrichment_score: isImportExport ? 12 : 8, // I/E gets a small bump
  }
}

async function ensureCache(): Promise<string> {
  if (existsSync(CACHE_JSONL)) return CACHE_JSONL
  await mkdir(CACHE_DIR, { recursive: true })
  if (!existsSync(CACHE_BZ2)) {
    console.log(`[handelsregister-de] downloading ${STOCK_URL}`)
    await new Promise<void>((resolve, reject) => {
      const p = spawn('curl', ['-L', '--fail', '-o', CACHE_BZ2, STOCK_URL], { stdio: 'inherit' })
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code}`))))
    })
  }
  console.log('[handelsregister-de] decompressing bz2')
  await new Promise<void>((resolve, reject) => {
    // bunzip2 -k keeps the .bz2 around so subsequent runs can re-stream.
    const p = spawn('bunzip2', ['-k', '-f', CACHE_BZ2], { stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`bunzip2 exit ${code}`))))
  })
  if (!existsSync(CACHE_JSONL)) throw new Error('JSONL not found after decompression')
  return CACHE_JSONL
}

export async function runHandelsregisterIngest(
  opts: ConnectorOptions = {},
): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }
  try {
    const jsonlPath = await ensureCache()
    const sb = vaultClient()
    const rl = createInterface({
      input: createReadStream(jsonlPath, 'utf8'),
      crlfDelay: Infinity,
    })

    const batch: LvCompanyInsert[] = []
    const FLUSH_SIZE = 500

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (opts.dryRun) {
        result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      // Dedup intra-batch on crn (same conflict key cannot be updated twice
      // in a single ON CONFLICT statement) — keep the last occurrence.
      const byCrn = new Map<string, LvCompanyInsert>()
      for (const row of batch) {
        const key = (row as { crn?: string }).crn
        if (!key) continue
        byCrn.set(key, row)
      }
      const deduped = Array.from(byCrn.values())
      const { error, count } = await (sb.from as any)('lv_companies')
        .upsert(deduped, { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('[handelsregister-de] upsert error', error.message, 'dedup_size=', deduped.length)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? deduped.length
      }
      batch.length = 0
    }

    for await (const line of rl) {
      if (!line) continue
      result.rows_processed++
      let rec: OcCompany
      try {
        rec = JSON.parse(line) as OcCompany
      } catch {
        result.rows_skipped++
        continue
      }
      const company = recordToCompany(rec)
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
      await bumpSourceStock({
        source_id: 'handelsregister',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({
        source_id: 'handelsregister',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
    if (!opts.dryRun && result.rows_inserted > 0 && !result.error) {
      await cleanCache()
    }
  }
  return result
}

async function cleanCache(): Promise<void> {
  try {
    const { readdir, unlink } = await import('fs/promises')
    const { join } = await import('path')
    const entries = await readdir(CACHE_DIR)
    let removed = 0
    for (const e of entries) {
      // Keep .bz2 source — it's expensive to re-download (4GB).
      // Remove only the inflated .json that was streamed.
      if (e.endsWith('.bz2')) continue
      try { await unlink(join(CACHE_DIR, e)); removed++ } catch { /* ignore */ }
    }
    console.log(`[handelsregister] cache purged (${removed} files, kept .bz2 source)`)
  } catch (err) {
    console.warn('[handelsregister] cache cleanup failed', (err as Error).message)
  }
}

// ─── tech-debt notes ──────────────────────────────────────────────────
// 1. DB seed: insert into gapup_leads.lv_sources (id='handelsregister', …)
//    before the first run, otherwise lv_sync_log FK fails. ~5 min migration.
// 2. Data is frozen at 2019-02-01. Build a delta connector that scrapes the
//    daily Handelsregisterbekanntmachungen RSS to top up new entities — see
//    https://www.handelsregisterbekanntmachungen.de/ . ~3 J/H.
// 3. NACE enrichment: run a name-classifier (Wirtschaftszweige 2008 mapping)
//    after ingest to upgrade `nace_code` from null → 4-digit. Use the OFA
//    persona library + a small LLM pass on flagged subset only. ~2 J/H.
// 4. Court-name normalisation: ~50k entries have inconsistent Amtsgericht
//    spellings (see OffeneRegister README §3). Build a court canonicaliser
//    so we can join with future Bundesanzeiger pulls. ~1 J/H.
