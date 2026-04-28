/**
 * RNPC-PT connector — Registo Nacional de Pessoas Coletivas (Portugal)
 *
 * Source primaire : RNPC via Portal de Justiça Portugal (publicacoes.mj.pt)
 * Accès bulk      : dados.gov.pt/pt/datasets/?q=empresas (license OGL-PT)
 *                   Banco de Portugal dataset CSV public — license OGL-PT-compatible
 * Stratégie v1    : RNPC ne dispose pas d'API publique directe ni de bulk dump
 *                   REST en accès libre. Ce connecteur utilise OpenCorporates
 *                   (country_code=pt) comme sliceur de registre officiel en
 *                   attendant qu'un vrai dump RNPC/IRN soit disponible sur
 *                   dados.gov.pt. Le code est documenté pour la migration future.
 * Auth            : OPENCORPORATES_API_TOKEN (env) — si absent, skip gracieux.
 * License         : OGL-PT-compatible (OpenCorporates intègre données publiques PT)
 * Volume cible    : ~400k entreprises actives PT
 * ISO             : PRT
 * source_id       : rnpc_pt
 *
 * Future migration (note): quand dados.gov.pt publie le dump RNPC complet,
 *   remplacer la boucle OC par un fetch CSV direct et parser le NIF/NIPC.
 *   Endpoint cible : https://dados.gov.pt/pt/datasets/registo-nacional-de-pessoas-coletivas/
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const OC_BASE = 'https://api.opencorporates.com/v0.4'
const COUNTRY_CODE = 'pt'
const COUNTRY_ISO3 = 'PRT'
const SOURCE_ID = 'rnpc_pt' as const
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'
const PER_PAGE = 100
const SLEEP_BETWEEN_PAGES_MS = 200
const BACKOFF_429_MS = 60_000
const BATCH_SIZE = 500

type OcAddress = {
  street_address?: string | null
  locality?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string | null
}

type OcCompany = {
  name?: string
  company_number?: string
  jurisdiction_code?: string
  incorporation_date?: string | null
  dissolution_date?: string | null
  inactive?: boolean
  current_status?: string | null
  registered_address_in_full?: string | null
  registered_address?: OcAddress | null
  previous_names?: Array<{ company_name?: string }>
  identifiers?: Array<{ identifier_system_code?: string; uid?: string }>
}

type OcSearchResponse = {
  results?: {
    companies?: Array<{ company: OcCompany }>
    page?: number
    total_pages?: number
    total_count?: number
    per_page?: number
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function ocToken(): string | undefined {
  return process.env.OPENCORPORATES_API_TOKEN || undefined
}

function buildUrl(page: number, inactive = false): string {
  const params = new URLSearchParams({
    country_code: COUNTRY_CODE,
    per_page: String(PER_PAGE),
    page: String(page),
    inactive: String(inactive),
  })
  const tok = ocToken()
  if (tok) params.set('api_token', tok)
  return `${OC_BASE}/companies/search?${params.toString()}`
}

async function fetchPage(url: string): Promise<OcSearchResponse | { rateLimited: true }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (res.status === 429 || res.status === 403) return { rateLimited: true }
  if (!res.ok) throw new Error(`OC HTTP ${res.status} for ${url}`)
  return (await res.json()) as OcSearchResponse
}

function extractNif(c: OcCompany): string | null {
  for (const id of c.identifiers || []) {
    const sys = (id.identifier_system_code || '').toLowerCase()
    if (sys === 'pt_nif' || sys === 'nif' || sys === 'nipc') {
      return id.uid?.trim() || null
    }
  }
  return null
}

function mapStatus(c: OcCompany): LvCompanyInsert['status'] {
  if (c.inactive === true || c.dissolution_date) return 'dissolved'
  const s = (c.current_status || '').toLowerCase()
  if (s.includes('activ') || s === 'live') return 'active'
  if (s.includes('dissol') || s.includes('cancel') || s.includes('struck')) return 'dissolved'
  if (s.includes('dormant') || s.includes('inactiv')) return 'dormant'
  return 'active'
}

function mapRow(c: OcCompany): LvCompanyInsert | null {
  const legal = (c.name || '').trim()
  const crn = (c.company_number || '').trim()
  if (!legal || !crn) return null
  if (c.inactive === true) return null

  const addr = c.registered_address || {}
  const addressLine =
    c.registered_address_in_full ||
    [addr.street_address, addr.locality].filter(Boolean).join(', ') ||
    null

  const foundedYear = c.incorporation_date
    ? parseInt(c.incorporation_date.slice(0, 4), 10) || null
    : null

  const nif = extractNif(c)

  const sourceIds: Record<string, string> = {
    oc_id: `${COUNTRY_CODE}/${crn}`,
  }
  if (nif) sourceIds.nif = nif
  if (nif) sourceIds.nipc = nif

  return {
    legal_name: legal,
    crn,
    vat_number: nif,
    country_iso: COUNTRY_ISO3,
    city: addr.locality || null,
    postal_code: addr.postal_code || null,
    region: addr.region || null,
    address: addressLine,
    founded_year: foundedYear,
    status: mapStatus(c),
    primary_source: SOURCE_ID,
    source_ids: sourceIds,
    enrichment_score: 20,
  }
}

export async function runRnpcPtIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      strategy: 'opencorporates_slice_pt',
      note: 'Primary: OC country_code=pt. Future: replace with RNPC bulk dump from dados.gov.pt when available.',
      api_calls: 0,
      total_pages: null,
      rate_limited: false,
    },
  }

  const tok = ocToken()
  if (!tok) {
    result.error = 'OC token missing — set OPENCORPORATES_API_TOKEN'
    result.duration_ms = Date.now() - t0
    console.warn('[rnpc-pt] OPENCORPORATES_API_TOKEN absent — skipping ingest')
    return result
  }

  const meta = result.metadata as Record<string, unknown>

  try {
    const sb = vaultClient()
    let apiCalls = 0
    let page = 1
    let totalPages: number | null = null
    const batch: LvCompanyInsert[] = []

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
        console.error('[rnpc-pt] upsert error', error.message)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += batch.length
      }
      batch.length = 0
    }

    outer: while (true) {
      const url = buildUrl(page)
      let resp: OcSearchResponse | { rateLimited: true }
      try {
        resp = await fetchPage(url)
      } catch (err) {
        console.error(`[rnpc-pt] fetch error page=${page}:`, err instanceof Error ? err.message : err)
        break
      }
      apiCalls++
      meta.api_calls = apiCalls

      if ('rateLimited' in resp) {
        console.warn(`[rnpc-pt] rate-limited at page=${page}, backing off ${BACKOFF_429_MS}ms`)
        meta.rate_limited = true
        await sleep(BACKOFF_429_MS)
        break
      }

      const companies = resp.results?.companies || []
      if (totalPages === null) {
        totalPages = resp.results?.total_pages ?? 1
        meta.total_pages = totalPages
        console.log(`[rnpc-pt] total_count=${resp.results?.total_count ?? '?'} total_pages=${totalPages}`)
      }

      if (companies.length === 0) break

      for (const item of companies) {
        result.rows_processed++
        const row = mapRow(item.company)
        if (!row) {
          result.rows_skipped++
          continue
        }
        batch.push(row)

        if (batch.length >= BATCH_SIZE) await flush()

        if (opts.limit && result.rows_inserted + batch.length >= opts.limit) {
          await flush()
          break outer
        }
      }

      if (page >= (totalPages ?? 1)) break
      page++
      await sleep(SLEEP_BETWEEN_PAGES_MS)
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
    console.error('[rnpc-pt] fatal', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
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
