/**
 * Registro Imprese IT connector — Italian Chamber of Commerce business registry
 *
 * Reality check (2026-04-25):
 *   - registroimprese.it / InfoCamere does NOT publish a free bulk dump.
 *     The pro tier ABDO (accessoallebanchedati.registroimprese.it/abdo) is
 *     pay-per-call (~€1-3 per visura) or paid bulk (~€20-40k one-shot).
 *   - ISTAT ASIA registry is statistical only (aggregates by ATECO/territory,
 *     no per-company rows).
 *   - dati.gov.it / opendata.marche.camcom.it expose Movimprese aggregates
 *     under CC-BY 4.0 — useful for sizing, not for per-row leads.
 *   - OpenCorporates mirrors the Italian Business Register (jurisdiction
 *     code `it`, register #120, ~6.5M IT entities) and is the only free
 *     per-row source. Anonymous = ~500/day, free token = ~50k/mo, paid
 *     bulk on request.
 *
 * Strategy:
 *   - Paginate OpenCorporates `/v0.4/companies/search` with
 *     `jurisdiction_code=it` and the ATECO 46 prefix as `q`.
 *   - Post-filter on `industry_codes[]` for ATECO 2007/2025 codes starting
 *     with 46 (commercio all'ingrosso).
 *   - Map to `lv_companies` with `primary_source = 'registroimprese_it'`.
 *
 * License: OpenCorporates data is sourced from the official Registro
 * Imprese under CC-BY-SA where redistributable. Always cite InfoCamere /
 * Camere di Commercio as the upstream source.
 *
 * Volume: 4M IT entities total · ATECO 46xx ~300-500k expected ·
 * realistically reachable on free tier ~50k/mo with token.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult, SourceId } from '../types'

const OC_BASE = 'https://api.opencorporates.com/v0.4'
const JURISDICTION = 'it'
const SOURCE_ID = 'registroimprese_it' as unknown as SourceId

// ATECO 46xx = commercio all'ingrosso (wholesale, the I/E core).
// Adjacent transport/logistics codes kept narrow to mirror sirene.ts.
const ATECO_IE_PREFIXES = ['46', '49', '50', '51', '52', '53']

// Italian P.IVA = 11 numeric chars. CRN in OpenCorporates is the REA or
// the company_number; both are exposed. P.IVA is in identifiers[] usually.
const PIVA_RE = /^\d{11}$/

type OcCompany = {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  incorporation_date?: string | null
  dissolution_date?: string | null
  current_status?: string | null
  registered_address_in_full?: string | null
  registered_address?: {
    street_address?: string | null
    locality?: string | null
    region?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
  industry_codes?: Array<{
    industry_code?: {
      code?: string
      description?: string
      code_scheme_id?: string
    }
  }>
  identifiers?: Array<{
    identifier?: { uid?: string; identifier_system_code?: string }
  }>
  homepage_url?: string | null
  registry_url?: string | null
}

type OcSearchResponse = {
  results?: {
    companies?: Array<{ company: OcCompany }>
    page?: number
    per_page?: number
    total_pages?: number
    total_count?: number
  }
}

function pickAtecoCode(codes: OcCompany['industry_codes']): string | null {
  if (!codes?.length) return null
  for (const c of codes) {
    const ic = c.industry_code
    if (!ic?.code) continue
    const scheme = ic.code_scheme_id ?? ''
    if (scheme.includes('ateco')) {
      const norm = ic.code.replace(/\./g, '').trim()
      if (norm) return norm
    }
  }
  // Fallback: first code regardless of scheme (some rows lack scheme tagging)
  for (const c of codes) {
    const code = c.industry_code?.code?.replace(/\./g, '').trim()
    if (code) return code
  }
  return null
}

function pickPiva(ids: OcCompany['identifiers']): string | null {
  if (!ids?.length) return null
  for (const wrap of ids) {
    const uid = wrap.identifier?.uid
    if (uid && PIVA_RE.test(uid)) return uid
  }
  return null
}

function mapCompany(c: OcCompany): LvCompanyInsert | null {
  const status = (c.current_status ?? '').toLowerCase()
  if (status && /(cessat|liquid|cancellat|dissolved|inactive)/.test(status)) return null

  const ateco = pickAtecoCode(c.industry_codes)
  if (!ateco) return null
  const ateco2 = ateco.slice(0, 2)
  if (!ATECO_IE_PREFIXES.includes(ateco2)) return null

  const legalName = (c.name ?? '').trim()
  if (!legalName) return null

  const crn = c.company_number?.trim() || null
  const piva = pickPiva(c.identifiers)
  // P.IVA preferred as `crn` for IT (it's the de-facto national ID).
  // Fallback to OpenCorporates company_number / REA.
  const crnFinal = piva ?? crn
  if (!crnFinal) return null

  const addr = c.registered_address ?? null
  const isImportExport = ateco2 === '46' || ateco.startsWith('522') || ateco.startsWith('521')

  return {
    crn: crnFinal,
    vat_number: piva ? `IT${piva}` : null,
    legal_name: legalName,
    domain: c.homepage_url ?? null,
    country_iso: 'ITA',
    region: addr?.region ?? null,
    city: addr?.locality ?? null,
    postal_code: addr?.postal_code ?? null,
    address: addr?.street_address ?? c.registered_address_in_full ?? null,
    nace_code: ateco,
    industry_tags: [`ateco:${ateco2}`],
    is_import_export: isImportExport,
    primary_source: SOURCE_ID,
    source_ids: {
      registroimprese_it: crn ?? piva ?? '',
      ...(piva ? { piva } : {}),
    },
    enrichment_score: 10,
  }
}

async function ocSearchPage(opts: {
  q: string
  page: number
  apiToken?: string
}): Promise<OcSearchResponse> {
  const url = new URL(`${OC_BASE}/companies/search`)
  url.searchParams.set('q', opts.q)
  url.searchParams.set('jurisdiction_code', JURISDICTION)
  url.searchParams.set('per_page', '100')
  url.searchParams.set('page', String(opts.page))
  url.searchParams.set('order', 'incorporation_date')
  if (opts.apiToken) url.searchParams.set('api_token', opts.apiToken)

  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'gapup-leadsvault/1.0' },
      })
      if (res.status === 429) {
        const wait = 2000 * (attempt + 1)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      if (!res.ok) throw new Error(`OC ${res.status} ${res.statusText}`)
      return (await res.json()) as OcSearchResponse
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw lastErr ?? new Error('OpenCorporates search failed')
}

export async function runRegistroimpreseItIngest(
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
  const apiToken = process.env.OPENCORPORATES_API_TOKEN ?? undefined

  try {
    const sb = vaultClient()
    const batch: LvCompanyInsert[] = []
    const FLUSH = 500

    const flush = async (): Promise<void> => {
      if (!batch.length || opts.dryRun) {
        if (opts.dryRun) result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      // Dedup by crn within batch (same P.IVA can appear across pages
      // when ordering by incorporation_date with ties).
      const byCrn = new Map<string, LvCompanyInsert>()
      for (const row of batch) {
        const k = row.crn ?? row.legal_name
        if (k) byCrn.set(k, row)
      }
      const deduped = Array.from(byCrn.values())
      const { error, count } = await (sb.from as any)('lv_companies').upsert(deduped, {
        onConflict: 'crn',
        ignoreDuplicates: false,
        count: 'exact',
      })
      if (error) {
        console.error('[registroimprese-it] upsert error', error.message, 'size=', deduped.length)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? deduped.length
      }
      batch.length = 0
    }

    // OpenCorporates caps `page` at 100 (10k results / query). To unlock
    // the full 4M IT entities we sweep one prefix per page-window. ATECO
    // 46 alone yields ~300-500k → use 4-digit ATECO buckets to stay
    // under the 10k/query ceiling.
    const queries: string[] = []
    for (let two = 46; two <= 46; two++) {
      // Primary target: 46xx. Add 4900-5300 only if explicitly broadened.
      for (let sub = 0; sub <= 99; sub++) {
        queries.push(`${two}${String(sub).padStart(2, '0')}`)
      }
    }

    outer: for (const q of queries) {
      let page = 1
      let totalPages = 1
      do {
        const json = await ocSearchPage({ q, page, apiToken })
        const items = json.results?.companies ?? []
        totalPages = json.results?.total_pages ?? 1
        for (const wrap of items) {
          result.rows_processed++
          const mapped = mapCompany(wrap.company)
          if (!mapped) {
            result.rows_skipped++
            continue
          }
          batch.push(mapped)
          if (batch.length >= FLUSH) await flush()
          if (opts.limit && result.rows_inserted + batch.length >= opts.limit) {
            await flush()
            break outer
          }
        }
        page++
        // Polite throttle: free tier ≈ 50 req/min
        await new Promise((r) => setTimeout(r, 1300))
      } while (page <= Math.min(totalPages, 100))
    }
    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: SOURCE_ID,
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
        source_id: SOURCE_ID,
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }
  return result
}
