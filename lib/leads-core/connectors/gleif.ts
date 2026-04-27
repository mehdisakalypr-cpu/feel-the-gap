/**
 * GLEIF connector — Global Legal Entity Identifier registry
 *
 * License: CC0 1.0 Universal — public domain (gleif.org)
 * Endpoint: https://api.gleif.org/api/v1/lei-records (no auth, no rate-limit doc)
 * Volume: ~2.5M legal entities worldwide, jurisdiction-tagged.
 *
 * Strategy:
 *   - Iterate target countries (ISO-2), paginate page[size]=200, max 200
 *     pages per country (= 40k cap per country per run, configurable).
 *   - Map LEI record to lv_companies. crn = LEI (20-char). primary_source = 'gleif'.
 *   - Dedup naturally on crn (unique). Re-running upserts addresses if changed.
 *
 * Why GLEIF:
 *   - 0 auth, daily-refreshed golden copy, low overlap with national registries
 *     (GLEIF skews to financially-reporting entities — corp groups, subsidiaries,
 *     funds, large SMEs that issued securities or trade derivatives).
 *   - Provides legalAddress + headquartersAddress + registeredAt + status.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const GLEIF_BASE = 'https://api.gleif.org/api/v1/lei-records'

const ISO2_TO_ISO3: Record<string, string> = {
  FR: 'FRA', DE: 'DEU', GB: 'GBR', IT: 'ITA', ES: 'ESP',
  NL: 'NLD', BE: 'BEL', PL: 'POL', SE: 'SWE', NO: 'NOR',
  DK: 'DNK', FI: 'FIN', AT: 'AUT', CH: 'CHE', IE: 'IRL',
  PT: 'PRT', CZ: 'CZE', SK: 'SVK', HU: 'HUN', RO: 'ROU',
  GR: 'GRC', BG: 'BGR', HR: 'HRV', SI: 'SVN', EE: 'EST',
  LV: 'LVA', LT: 'LTU', LU: 'LUX', MT: 'MLT', CY: 'CYP',
  US: 'USA', CA: 'CAN', AU: 'AUS', NZ: 'NZL', JP: 'JPN',
  SG: 'SGP', HK: 'HKG', AE: 'ARE', IL: 'ISR', ZA: 'ZAF',
}

const DEFAULT_COUNTRIES = Object.keys(ISO2_TO_ISO3)

type GleifEntity = {
  legalName?: { name?: string }
  legalAddress?: {
    country?: string
    city?: string
    postalCode?: string
    addressLines?: string[]
    region?: string
  }
  headquartersAddress?: {
    city?: string
    addressLines?: string[]
  }
  status?: string
  registeredAt?: { id?: string }
  category?: string
}

type GleifRecord = {
  id: string
  attributes: { entity: GleifEntity }
}

type GleifResponse = {
  data: GleifRecord[]
  meta?: { pagination?: { total?: number; lastPage?: number } }
  links?: { next?: string }
}

function recordToCompany(r: GleifRecord): LvCompanyInsert | null {
  const ent = r.attributes?.entity
  if (!ent) return null
  const status = (ent.status ?? '').toUpperCase()
  if (status && status !== 'ACTIVE' && status !== 'ISSUED') return null

  const legalName = ent.legalName?.name?.trim()
  if (!legalName) return null

  const iso2 = (ent.legalAddress?.country ?? '').toUpperCase()
  const iso3 = ISO2_TO_ISO3[iso2]
  if (!iso3) return null // skip unknown jurisdictions

  const addr = ent.legalAddress
  const lines = (addr?.addressLines ?? []).filter(Boolean)
  const address = lines.join(', ') || null

  return {
    crn: r.id,
    legal_name: legalName,
    country_iso: iso3,
    city: addr?.city || null,
    postal_code: addr?.postalCode || null,
    address,
    region: addr?.region || null,
    status: 'active',
    primary_source: 'gleif',
    source_ids: { gleif: r.id, registration_authority: ent.registeredAt?.id ?? null },
    enrichment_score: 12,
  }
}

async function fetchPage(country: string, page: number, perPage = 200): Promise<GleifResponse> {
  const url = `${GLEIF_BASE}?filter%5Bentity.legalAddress.country%5D=${country}&page%5Bsize%5D=${perPage}&page%5Bnumber%5D=${page}`
  const res = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } })
  if (!res.ok) throw new Error(`GLEIF ${res.status} ${res.statusText} (${country} p${page})`)
  return res.json() as Promise<GleifResponse>
}

export type GleifIngestOptions = ConnectorOptions & {
  countries?: string[]
  maxPagesPerCountry?: number
}

export async function runGleifIngest(opts: GleifIngestOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }
  const countries = (opts.countries ?? DEFAULT_COUNTRIES).map((c) => c.toUpperCase())
  const maxPages = opts.maxPagesPerCountry ?? 200
  const limit = opts.limit ?? Number.POSITIVE_INFINITY
  const sb = vaultClient()
  const FLUSH = 500
  const batch: LvCompanyInsert[] = []

  const flush = async (): Promise<void> => {
    if (!batch.length || opts.dryRun) {
      if (opts.dryRun) result.rows_inserted += batch.length
      batch.length = 0
      return
    }
    const { error, count } = await (sb.from as any)('lv_companies').upsert(batch, {
      onConflict: 'crn',
      ignoreDuplicates: false,
      count: 'exact',
    })
    if (error) {
      console.error('[gleif] upsert error', error.message)
      result.rows_skipped += batch.length
    } else {
      result.rows_inserted += count ?? batch.length
    }
    batch.length = 0
  }

  try {
    for (const cc of countries) {
      if (result.rows_inserted >= limit) break
      let page = 1
      let consecutiveEmpty = 0
      while (page <= maxPages && result.rows_inserted < limit) {
        let resp: GleifResponse
        try {
          resp = await fetchPage(cc, page)
        } catch (e) {
          console.warn(`[gleif] ${cc} p${page} failed: ${(e as Error).message}`)
          break
        }
        const recs = resp.data ?? []
        if (recs.length === 0) {
          consecutiveEmpty++
          if (consecutiveEmpty >= 2) break
        } else {
          consecutiveEmpty = 0
        }
        for (const r of recs) {
          result.rows_processed++
          const c = recordToCompany(r)
          if (!c) {
            result.rows_skipped++
            continue
          }
          batch.push(c)
          if (batch.length >= FLUSH) await flush()
          if (result.rows_inserted + batch.length >= limit) break
        }
        if (!resp.links?.next) break
        page++
      }
      await flush()
      console.log(`[gleif] ${cc}: ${result.rows_inserted} cumulative inserts`)
    }
    await flush()
    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'gleif', delta_count: result.rows_inserted, is_full_pull: false })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'gleif', operation: 'ingest', result })
    }
  }
  return result
}
