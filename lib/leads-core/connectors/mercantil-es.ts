/**
 * Registro Mercantil ES connector — BOE BORME daily summary API + pdftotext
 *
 * License: Free reuse — Real Decreto 1495/2011 (BOE open data, attribution).
 * Endpoint: https://www.boe.es/datosabiertos/api/borme/sumario/YYYYMMDD
 *           PDFs at https://www.boe.es/borme/dias/YYYY/MM/DD/pdfs/BORME-A-...pdf
 *
 * Why this source (research summary 2026-04-25):
 *   - rmc.es / sede.registradores.org → paywall since 2011, no per-company
 *     bulk download, only per-record paid certificates.
 *   - INE DIRCE → publishes only AGGREGATE counts by CNAE/region/CCAA, no
 *     per-entity records (verified on ine.es and datos.gob.es API ids
 *     2971, 39371, 39372, 49253, 3954).
 *   - opendata.registradores.org → quarterly statistical extracts only,
 *     no per-company list.
 *   - librebor.me → has 6M+ company DB parsed from BORME, but bulk pulls
 *     require paid plan.
 *   - BORME (Boletín Oficial del Registro Mercantil), accessible via
 *     boe.es/datosabiertos/api/borme/sumario/YYYYMMDD → free public daily
 *     summary listing each provincial Section A PDF. The Section A PDFs
 *     (one per province × day) carry every "acto inscrito" — incorporations,
 *     modifications of corporate purpose, dissolutions — with legal_name,
 *     NIF (CIF), and the act narrative containing CNAE / objeto social.
 *     Re-aggregated this is the only no-credential path to a per-company
 *     stock equivalent to ~3.5M ES companies.
 *
 * Pipeline:
 *   1. fetch JSON daily summary
 *   2. for each Section A item (one PDF per province) → curl PDF to cache
 *   3. shell out to `pdftotext` (poppler-utils, present on Ubuntu servers)
 *   4. regex-walk the text for "Datos registrales" blocks, each = 1 company
 *   5. dedup on NIF, upsert to lv_companies
 *
 * Volume strategy:
 *   - Full backfill 2009-01-01 → today: ~10M acts → ~3.5M unique companies
 *     (~25 GB of PDF in cache, runs in chunks).
 *   - I/E filter (CNAE 46xx prefix OR textual heuristic): ~6-12% match
 *     → 200-400k companies tagged is_import_export = true.
 *   - Delta mode: yesterday's summary only → ~4-8k acts/day, ~5 min run.
 *
 * Known limits / tech debt:
 *   - Requires `pdftotext` on PATH (apt: poppler-utils). Connector aborts
 *     gracefully with a clear error if missing.
 *   - CNAE extraction is best-effort regex — BORME wording is not 100%
 *     standardized; expect ~75% CNAE coverage. When CNAE is absent we fall
 *     back on Spanish I/E keywords ("importación", "exportación", "comercio
 *     al por mayor"…) for the is_import_export flag.
 *   - Address detail in BORME is just province + (sometimes) full street.
 *   - For richer schemas (objeto social, capital, administradores) consider
 *     swapping in librebor.me API path — see comment block at end of file.
 */

import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { spawn } from 'child_process'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const BORME_SUMMARY_API = 'https://www.boe.es/datosabiertos/api/borme/sumario'
const CACHE_DIR = '/root/leads-vault/cache/mercantil-es'

// Spanish CNAE 2009 prefixes flagged as import/export trade activities
// (same shape as Sirene NAF and Companies House SIC).
const CNAE_IMPORT_EXPORT_PREFIXES = [
  '46', // Comercio al por mayor (excl. vehículos)
  '49', // Transporte terrestre
  '50', // Transporte marítimo
  '51', // Transporte aéreo
  '52', // Almacenamiento y actividades anexas al transporte
  '53', // Actividades postales y de correos
]

// Textual heuristic — when CNAE absent, scan act text for trade markers.
const IMPORT_EXPORT_KEYWORDS_NORMALIZED = [
  'importacion',
  'exportacion',
  'comercio al por mayor',
  'comercio mayorista',
  'comercio internacional',
  'compraventa al por mayor',
  'logistica',
  'transporte de mercancias',
  'distribucion de mercancias',
  'almacenaje',
]

// Spanish province → autonomous community (region field on lv_companies).
const PROVINCE_REGION: Record<string, string> = {
  ALAVA: 'Pais Vasco',
  ALBACETE: 'Castilla-La Mancha',
  'ALICANTE/ALACANT': 'Comunidad Valenciana',
  ALMERIA: 'Andalucia',
  ASTURIAS: 'Asturias',
  AVILA: 'Castilla y Leon',
  BADAJOZ: 'Extremadura',
  BARCELONA: 'Cataluna',
  BURGOS: 'Castilla y Leon',
  CACERES: 'Extremadura',
  CADIZ: 'Andalucia',
  CANTABRIA: 'Cantabria',
  'CASTELLON/CASTELLO': 'Comunidad Valenciana',
  CEUTA: 'Ceuta',
  'CIUDAD REAL': 'Castilla-La Mancha',
  CORDOBA: 'Andalucia',
  CORUNA: 'Galicia',
  'A CORUNA': 'Galicia',
  CUENCA: 'Castilla-La Mancha',
  GIRONA: 'Cataluna',
  GRANADA: 'Andalucia',
  GUADALAJARA: 'Castilla-La Mancha',
  GUIPUZCOA: 'Pais Vasco',
  HUELVA: 'Andalucia',
  HUESCA: 'Aragon',
  'ILLES BALEARS': 'Baleares',
  JAEN: 'Andalucia',
  'LA RIOJA': 'La Rioja',
  'LAS PALMAS': 'Canarias',
  LEON: 'Castilla y Leon',
  LLEIDA: 'Cataluna',
  LUGO: 'Galicia',
  MADRID: 'Madrid',
  MALAGA: 'Andalucia',
  MELILLA: 'Melilla',
  MURCIA: 'Murcia',
  NAVARRA: 'Navarra',
  OURENSE: 'Galicia',
  PALENCIA: 'Castilla y Leon',
  PONTEVEDRA: 'Galicia',
  SALAMANCA: 'Castilla y Leon',
  'SANTA CRUZ DE TENERIFE': 'Canarias',
  SEGOVIA: 'Castilla y Leon',
  SEVILLA: 'Andalucia',
  SORIA: 'Castilla y Leon',
  TARRAGONA: 'Cataluna',
  TERUEL: 'Aragon',
  TOLEDO: 'Castilla-La Mancha',
  'VALENCIA/VALENCIA': 'Comunidad Valenciana',
  VALENCIA: 'Comunidad Valenciana',
  VALLADOLID: 'Castilla y Leon',
  VIZCAYA: 'Pais Vasco',
  ZAMORA: 'Castilla y Leon',
  ZARAGOZA: 'Aragon',
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function extractCnae(text: string): string | null {
  // BORME wording variants:
  // "CNAE 4690", "C.N.A.E.: 4690", "epígrafe 46.9", "actividad 46.90"
  const m1 = text.match(/CNAE[\s:.]*?(\d{2,4})/i)
  if (m1) return m1[1].replace(/\D/g, '').slice(0, 4)
  const m2 = text.match(/ep[íi]grafe[\s:]*?(\d{2})\.?(\d{0,2})/i)
  if (m2) return (m2[1] + (m2[2] ?? '')).slice(0, 4)
  return null
}

function isImportExport(cnae: string | null, body: string): boolean {
  if (cnae) {
    const prefix = cnae.slice(0, 2)
    if (CNAE_IMPORT_EXPORT_PREFIXES.includes(prefix)) return true
  }
  const haystack = normalizeText(body)
  return IMPORT_EXPORT_KEYWORDS_NORMALIZED.some((kw) => haystack.includes(kw))
}

function inferStatus(body: string): 'active' | 'dissolved' {
  const t = normalizeText(body)
  if (t.includes('disolucion') || t.includes('extincion') || t.includes('cancelacion de asientos')) return 'dissolved'
  return 'active'
}

// ---------- BOE summary API -------------------------------------------------

type BormeSummaryItem = {
  itemId: string // BORME-A-YYYY-NNN-PP
  province: string
  pdfUrl: string
}

async function fetchSummaryJson(yyyymmdd: string): Promise<BormeSummaryItem[] | null> {
  const url = `${BORME_SUMMARY_API}/${yyyymmdd}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`)
    const json = (await res.json()) as {
      data?: { sumario?: { diario?: unknown } }
    }
    const diario = json?.data?.sumario?.diario
    if (!diario) return []
    // diario can be an object or array depending on day
    const diarios = Array.isArray(diario) ? diario : [diario]
    const items: BormeSummaryItem[] = []
    for (const d of diarios) {
      const seccion = (d as { seccion?: unknown }).seccion
      const seccions = Array.isArray(seccion) ? seccion : seccion ? [seccion] : []
      for (const s of seccions) {
        if ((s as { codigo?: string }).codigo !== 'A') continue
        const item = (s as { item?: unknown }).item
        const it = Array.isArray(item) ? item : item ? [item] : []
        for (const i of it) {
          const ii = i as {
            identificador?: string
            titulo?: string
            url_pdf?: { texto?: string } | string
          }
          if (!ii.identificador || !ii.titulo) continue
          const pdfUrl =
            typeof ii.url_pdf === 'string'
              ? ii.url_pdf
              : ii.url_pdf?.texto ?? ''
          if (!pdfUrl) continue
          items.push({ itemId: ii.identificador, province: ii.titulo.trim(), pdfUrl })
        }
      }
    }
    return items
  } catch (err) {
    console.error('[mercantil-es] fetch summary error', yyyymmdd, err)
    return null
  }
}

// ---------- PDF download + pdftotext ---------------------------------------

async function ensurePdftotext(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn('pdftotext', ['-v'], { stdio: 'pipe' })
    p.on('error', () => reject(new Error('pdftotext binary not found — install poppler-utils (apt install poppler-utils)')))
    p.on('exit', () => resolve())
  })
}

async function downloadPdf(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return
  await new Promise<void>((resolve, reject) => {
    const p = spawn('curl', ['-sS', '-L', '--fail', '--max-time', '60', '-o', dest, url], { stdio: 'pipe' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code} on ${url}`))))
  })
}

async function pdfToText(pdfPath: string): Promise<string> {
  const txtPath = pdfPath.replace(/\.pdf$/, '.txt')
  if (!existsSync(txtPath)) {
    await new Promise<void>((resolve, reject) => {
      // -layout preserves "Datos registrales" block separation.
      const p = spawn('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, txtPath], { stdio: 'pipe' })
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`pdftotext exit ${code}`))))
    })
  }
  return readFile(txtPath, 'utf8')
}

// ---------- Per-act parser --------------------------------------------------

type BormeRecord = {
  itemId: string
  legal_name: string
  nif: string | null
  body: string
}

function splitActs(text: string): string[] {
  // BORME-A acts are delimited by a numbered header like
  // "12345 - ACME LOGISTICA SL." followed by the act narrative.
  // The "12345" is the BORME entry sequence.
  const lines = text.split('\n')
  const blocks: string[] = []
  let cur: string[] = []
  const headRe = /^\s*\d{4,7}\s*[-–]\s+[A-ZÁÉÍÓÚÑÜ0-9].+/
  for (const line of lines) {
    if (headRe.test(line) && cur.length) {
      blocks.push(cur.join('\n'))
      cur = []
    }
    cur.push(line)
  }
  if (cur.length) blocks.push(cur.join('\n'))
  return blocks
}

function parseAct(block: string, sectionItemId: string): BormeRecord | null {
  const headMatch = block.match(/^\s*(\d{4,7})\s*[-–]\s+(.+?)\s*\.?\s*$/m)
  if (!headMatch) return null
  const seq = headMatch[1]
  const headTail = headMatch[2].trim()
  // Legal name is the head minus parenthetical NIF.
  const nifMatch = headTail.match(/\((?:NIF[:\s]*)?([A-Z]\d{8}|\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9])\)/)
  const nifFromHead = nifMatch ? nifMatch[1] : null
  const legal_name = headTail.replace(/\s*\(.*?\)\s*$/, '').trim()
  // Sometimes NIF appears later in body as "Datos registrales … NIF: B12345678".
  const nifBodyMatch = !nifFromHead ? block.match(/\b(?:NIF|CIF)[:\s]*([A-Z]\d{8}|\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9])\b/) : null
  const nif = nifFromHead ?? (nifBodyMatch ? nifBodyMatch[1] : null)
  if (!legal_name) return null
  return {
    itemId: `${sectionItemId}#${seq}`,
    legal_name,
    nif,
    body: block,
  }
}

function recordToCompany(rec: BormeRecord, province: string): LvCompanyInsert | null {
  const cnae = extractCnae(rec.body)
  const ie = isImportExport(cnae, rec.body)
  // Apply same hard filter as Sirene/CH: when CNAE known but outside trade
  // scope, drop. When CNAE absent and no textual hit, drop too — keeps
  // the lv_companies table focused on import/export universe (~6-12%).
  if (cnae) {
    const prefix = cnae.slice(0, 2)
    if (!CNAE_IMPORT_EXPORT_PREFIXES.includes(prefix)) return null
  } else if (!ie) {
    return null
  }
  const provKey = province.toUpperCase()
  const region = PROVINCE_REGION[provKey] ?? null
  const city = province
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s*\/\s*/g, ' / ')
    .trim()

  return {
    crn: rec.nif || undefined,
    legal_name: rec.legal_name,
    country_iso: 'ESP',
    region,
    city,
    nace_code: cnae,
    industry_tags: cnae ? [`cnae:${cnae.slice(0, 2)}`] : ['cnae:unknown'],
    is_import_export: ie,
    status: inferStatus(rec.body),
    primary_source: 'mercantil_es',
    source_ids: { mercantil_es: rec.itemId, ...(rec.nif ? { nif: rec.nif } : {}) },
    enrichment_score: 8,
  }
}

// ---------- Date range driver ----------------------------------------------

function ymdRange(fromIso: string, toIso: string): string[] {
  const days: string[] = []
  const from = new Date(fromIso)
  const to = new Date(toIso)
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    days.push(`${y}${m}${dd}`)
  }
  return days
}

function defaultRange(opts: ConnectorOptions): { from: string; to: string } {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  if (opts.delta) {
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000)
    return { from: yesterday.toISOString().slice(0, 10), to }
  }
  const fromEnv = process.env.MERCANTIL_ES_FROM
  if (fromEnv) return { from: fromEnv, to }
  // Default full window: last 30 days. Wider backfill via env.
  const start = new Date(today.getTime() - 30 * 24 * 3600 * 1000)
  return { from: start.toISOString().slice(0, 10), to }
}

// ---------- Public entry ---------------------------------------------------

export async function runMercantilEsIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { from: '', to: '', days_fetched: 0, days_empty: 0, pdfs_processed: 0 },
  }
  const range = defaultRange(opts)
  ;(result.metadata as Record<string, unknown>).from = range.from
  ;(result.metadata as Record<string, unknown>).to = range.to

  try {
    await ensurePdftotext()
    await mkdir(CACHE_DIR, { recursive: true })
    const sb = vaultClient()
    const days = ymdRange(range.from, range.to)
    const batch: LvCompanyInsert[] = []
    const FLUSH = 500
    let daysFetched = 0
    let daysEmpty = 0
    let pdfsProcessed = 0

    const flush = async (): Promise<void> => {
      if (!batch.length || opts.dryRun) {
        if (opts.dryRun) result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      // Dedup intra-batch on NIF (preferred) else legal_name|region.
      const byKey = new Map<string, LvCompanyInsert>()
      for (const row of batch) {
        const key = row.crn ?? `${row.legal_name}|${row.region ?? ''}`
        byKey.set(key, row)
      }
      const deduped = Array.from(byKey.values())
      const withCrn = deduped.filter((r) => !!r.crn)
      const withoutCrn = deduped.filter((r) => !r.crn)

      if (withCrn.length) {
        const { error, count } = await (sb.from as any)('lv_companies').upsert(withCrn, {
          onConflict: 'crn',
          ignoreDuplicates: false,
          count: 'exact',
        })
        if (error) {
          console.error('[mercantil-es] upsert(crn) error', error.message, 'size=', withCrn.length)
          result.rows_skipped += withCrn.length
        } else {
          result.rows_inserted += count ?? withCrn.length
        }
      }
      if (withoutCrn.length) {
        const { error, count } = await (sb.from as any)('lv_companies').insert(withoutCrn, { count: 'exact' })
        if (error) {
          console.error('[mercantil-es] insert(no-crn) error', error.message, 'size=', withoutCrn.length)
          result.rows_skipped += withoutCrn.length
        } else {
          result.rows_inserted += count ?? withoutCrn.length
        }
      }
      batch.length = 0
    }

    for (const day of days) {
      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
      const items = await fetchSummaryJson(day)
      if (items === null) {
        daysEmpty++
        continue
      }
      if (items.length === 0) {
        daysEmpty++
        continue
      }
      daysFetched++

      for (const item of items) {
        if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
        const dayDir = `${CACHE_DIR}/${day}`
        await mkdir(dayDir, { recursive: true })
        const pdfPath = `${dayDir}/${item.itemId}.pdf`
        try {
          await downloadPdf(item.pdfUrl, pdfPath)
          const text = await pdfToText(pdfPath)
          pdfsProcessed++
          const blocks = splitActs(text)
          for (const block of blocks) {
            result.rows_processed++
            const rec = parseAct(block, item.itemId)
            if (!rec) {
              result.rows_skipped++
              continue
            }
            const company = recordToCompany(rec, item.province)
            if (!company) {
              result.rows_skipped++
              continue
            }
            batch.push(company)
            if (batch.length >= FLUSH) await flush()
            if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break
          }
        } catch (err) {
          console.error('[mercantil-es] pdf error', item.itemId, err)
          result.rows_skipped++
          continue
        }
      }
      // Be polite to BOE — 200ms between days.
      await new Promise((r) => setTimeout(r, 200))
    }
    await flush()
    ;(result.metadata as Record<string, unknown>).days_fetched = daysFetched
    ;(result.metadata as Record<string, unknown>).days_empty = daysEmpty
    ;(result.metadata as Record<string, unknown>).pdfs_processed = pdfsProcessed

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'mercantil_es',
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
        source_id: 'mercantil_es',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// OPTIONAL — librebor.me drop-in. Set LIBREBOR_TOKEN to swap.
//   - Endpoint: https://librebor.me/api/v1/company/?cnae=46&page=N
//   - Auth: HTTPBasic (user:token base64)
//   - Schema is richer (CNAE, objeto social, capital, administradores).
//   - Free tier: ~100 queries/day; bulk pulls require paid plan.
// Implementation deferred until paid plan provisioned.
// ---------------------------------------------------------------------------
