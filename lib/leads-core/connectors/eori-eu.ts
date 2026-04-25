/**
 * EORI EU connector — validate-only enrich
 *
 * License: free, public DDS2 endpoint, no auth, throttled politely
 * Source: EU Customs DDS2 EOS (Economic Operator System)
 *   Form: https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp
 *   Query: ?Lang=en&EoriNumb=<EORI>&action=validate
 *
 * Strategy v1 — VALIDATE-ONLY (not bulk ingest):
 *   1. Read existing lv_companies rows where eori IS NOT NULL (set by Sirene
 *      VAT-link, Companies House extras, Common Crawl scrape, etc).
 *   2. For each EORI, hit the public JSP form, parse the response HTML.
 *   3. If valid → set is_import_export=true, last_verified_at=now,
 *      source_ids.eori_eu=<EORI>, enrichment_score += 15.
 *   4. If invalid → mark in source_ids.eori_eu_invalid=<reason>, no flag flip.
 *
 * Why validate-only and not bulk:
 *   - No public bulk dump exists. The full ~1.5M EORI registry is sealed
 *     behind the per-record JSP form for GDPR + customs-secrecy reasons.
 *   - Some national customs authorities (DGDDI FR, Zoll DE, ADM IT) publish
 *     partial PDF lists, but no machine-readable bulk feed.
 *   - Apollo / OpenCorporates resell scraped EORI lists but cost €€.
 *   - Path to bulk: Common Crawl scrape of company "About"/"Imprint" pages
 *     for EORI patterns ([A-Z]{2}\d{6,17}) → fed back here for validation.
 *
 * Throttle: 1.2s between calls (~3000/h, ~70k/day). At 100k EORIs in DB
 * this is ~36h — schedule as nightly cron with limit=10000.
 *
 * EORI prefix country mapping: chars 1-2 = ISO2 of issuing member state
 * (e.g. FR9876543210 → France; the EORI does not necessarily mean
 * registration country == operating country, but it's a strong default).
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

const VALIDATE_URL = 'https://ec.europa.eu/taxation_customs/dds2/eos/eori_validation.jsp'
const THROTTLE_MS = 1200
const USER_AGENT = 'gapup-lead-vault/1.0 (+https://www.gapup.io)'

// EU27 + EFTA + UK (post-Brexit GB EORIs are issued by HMRC but not in EU EOS)
const EORI_PREFIX_TO_ISO3: Record<string, string> = {
  AT: 'AUT', BE: 'BEL', BG: 'BGR', CY: 'CYP', CZ: 'CZE', DE: 'DEU',
  DK: 'DNK', EE: 'EST', ES: 'ESP', FI: 'FIN', FR: 'FRA', GR: 'GRC',
  HR: 'HRV', HU: 'HUN', IE: 'IRL', IT: 'ITA', LT: 'LTU', LU: 'LUX',
  LV: 'LVA', MT: 'MLT', NL: 'NLD', PL: 'POL', PT: 'PRT', RO: 'ROU',
  SE: 'SWE', SI: 'SVN', SK: 'SVK',
  // Non-EU but issuable: Norway, Switzerland (via Liechtenstein), Iceland
  NO: 'NOR', CH: 'CHE', LI: 'LIE', IS: 'ISL',
  // GB is technically EU EOS post-Brexit only for NI XI prefix
  XI: 'GBR',
}

type EoriValidation = {
  valid: boolean
  iso2: string | null
  iso3: string | null
  legal_name?: string | null
  address?: string | null
  reason?: string
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function extractIso(eori: string): { iso2: string | null; iso3: string | null } {
  const prefix = eori.slice(0, 2).toUpperCase()
  const iso3 = EORI_PREFIX_TO_ISO3[prefix] ?? null
  return { iso2: iso3 ? prefix : null, iso3 }
}

async function validateEori(eori: string): Promise<EoriValidation> {
  const { iso2, iso3 } = extractIso(eori)
  const url = `${VALIDATE_URL}?Lang=en&EoriNumb=${encodeURIComponent(eori)}&action=validate`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { valid: false, iso2, iso3, reason: `http_${res.status}` }
    const html = await res.text()
    // Heuristic parse — DDS2 returns a results table. Two known phrasings:
    //   "is a valid EORI number" → valid
    //   "is not a valid EORI number" / "EORI number is invalid" → invalid
    const lower = html.toLowerCase()
    const isInvalid = lower.includes('not a valid') || lower.includes('eori number is invalid')
    const isValid = !isInvalid && lower.includes('valid eori number')
    if (!isValid) return { valid: false, iso2, iso3, reason: isInvalid ? 'invalid' : 'no_match' }

    // Best-effort name + address extraction from the HTML response table.
    // The form returns "Name and Address" cells when the operator opted in
    // to consent disclosure (~30% of EORI holders).
    const nameMatch = html.match(/Name(?:&nbsp;|\s)*<\/td>\s*<td[^>]*>([^<]+)</i)
    const addrMatch = html.match(/Address(?:&nbsp;|\s)*<\/td>\s*<td[^>]*>([^<]+)</i)
    return {
      valid: true,
      iso2,
      iso3,
      legal_name: nameMatch?.[1]?.trim() || null,
      address: addrMatch?.[1]?.trim() || null,
    }
  } catch (err) {
    return { valid: false, iso2, iso3, reason: err instanceof Error ? err.message : 'fetch_error' }
  }
}

type ExistingRow = {
  id: string
  eori: string
  country_iso: string
  source_ids: Record<string, string> | null
  enrichment_score: number | null
  is_import_export: boolean | null
}

export async function runEoriValidate(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { valid: 0, invalid: 0, errors: 0 },
  }
  const meta = result.metadata as { valid: number; invalid: number; errors: number }
  try {
    const sb = vaultClient()
    const limit = opts.limit ?? 1000
    // Pull rows with EORI not yet validated (or revalidate after 90d if delta).
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    let query = (sb.from as any)('lv_companies')
      .select('id,eori,country_iso,source_ids,enrichment_score,is_import_export')
      .not('eori', 'is', null)
      .limit(limit)
    if (opts.delta) query = query.or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`)
    else query = query.is('last_verified_at', null)

    const { data, error } = await query
    if (error) throw new Error(`select error: ${error.message}`)
    const rows = (data ?? []) as ExistingRow[]

    for (const row of rows) {
      result.rows_processed++
      if (!row.eori) {
        result.rows_skipped++
        continue
      }
      const v = await validateEori(row.eori)
      const sourceIds = { ...(row.source_ids ?? {}) }
      if (v.valid) {
        sourceIds.eori_eu = row.eori
        const baseScore = row.enrichment_score ?? 0
        const patch: Record<string, unknown> = {
          is_import_export: true,
          last_verified_at: new Date().toISOString(),
          source_ids: sourceIds,
          enrichment_score: Math.min(100, baseScore + 15),
        }
        if (v.iso3 && row.country_iso !== v.iso3) patch.region = `eori:${v.iso2}`
        if (v.legal_name && v.legal_name.length > 2) patch.trade_name = v.legal_name
        if (!opts.dryRun) {
          const { error: upErr } = await (sb.from as any)('lv_companies').update(patch).eq('id', row.id)
          if (upErr) {
            console.error('[eori-eu] update error', upErr.message)
            result.rows_skipped++
            meta.errors++
          } else {
            result.rows_updated++
            meta.valid++
          }
        } else {
          result.rows_updated++
          meta.valid++
        }
      } else {
        sourceIds.eori_eu_invalid = v.reason ?? 'unknown'
        if (!opts.dryRun) {
          await (sb.from as any)('lv_companies')
            .update({ source_ids: sourceIds, last_verified_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        result.rows_skipped++
        meta.invalid++
      }
      await sleep(THROTTLE_MS)
      if (opts.limit && result.rows_processed >= opts.limit) break
    }

    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'eori_eu', delta_count: meta.valid, is_full_pull: false })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'eori_eu', operation: 'verify', result })
    }
  }
  return result
}
