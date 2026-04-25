/**
 * OpenStreetMap Overpass connector — office/industrial POI with contact data
 *
 * License: ODbL — free
 * Volume: ~10M global POI, ~15% have contact:email or contact:phone
 * Endpoint: Overpass API public mirror
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult, LvContactInsert } from '../types'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const COUNTRY_AREAS = {
  FRA: 3602202162,
  DEU: 3600051477,
  GBR: 3602323309,
  ITA: 3603600365,
  ESP: 3601311341,
  NLD: 3602323309,
  BEL: 3600052411,
  POL: 3600049715,
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

function buildQuery(countryIso: keyof typeof COUNTRY_AREAS): string {
  const areaId = COUNTRY_AREAS[countryIso]
  return `
[out:json][timeout:120];
area(${areaId})->.country;
(
  node["office"~"^(it|company|wholesale|logistics|export|import|trade)$"](area.country)["contact:email"];
  node["office"~"^(it|company|wholesale|logistics|export|import|trade)$"](area.country)["contact:phone"];
  node["industrial"](area.country)["contact:email"];
  node["industrial"](area.country)["contact:phone"];
  way["office"~"^(it|company|wholesale|logistics|export|import|trade)$"](area.country)["contact:email"];
  way["industrial"](area.country)["contact:email"];
);
out tags center;
`.trim()
}

async function overpassQuery(query: string): Promise<OverpassElement[]> {
  let lastErr: Error | null = null
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { elements?: OverpassElement[] }
      return json.elements ?? []
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      continue
    }
  }
  throw lastErr ?? new Error('all overpass endpoints failed')
}

function elementToCompany(el: OverpassElement, countryIso: string): { company: LvCompanyInsert; contacts: Omit<LvContactInsert, 'company_id'>[] } | null {
  const tags = el.tags || {}
  const name = tags['name'] || tags['operator']
  if (!name) return null

  const officeKind = tags['office'] || tags['industrial']
  const isImportExport = ['wholesale', 'export', 'import', 'trade', 'logistics'].includes(officeKind || '')

  const company: LvCompanyInsert = {
    legal_name: name,
    country_iso: countryIso,
    city: tags['addr:city'] || null,
    postal_code: tags['addr:postcode'] || null,
    address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null,
    domain: (tags['contact:website'] || tags['website'] || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || null,
    industry_tags: [`osm:${officeKind || 'unknown'}`],
    is_import_export: isImportExport,
    primary_source: 'osm',
    source_ids: { osm: `${el.type}/${el.id}` },
    enrichment_score: 30,
  }

  const contacts: Omit<LvContactInsert, 'company_id'>[] = []
  const email = tags['contact:email'] || tags['email']
  const phone = tags['contact:phone'] || tags['phone']
  if (email) {
    contacts.push({
      contact_type: 'email',
      contact_value: email.toLowerCase().trim(),
      is_personal: !email.startsWith('info@') && !email.startsWith('contact@'),
      verify_status: 'unverified',
      primary_source: 'osm',
    })
  }
  if (phone) {
    contacts.push({
      contact_type: 'phone',
      contact_value: phone.replace(/\s+/g, ''),
      verify_status: 'unverified',
      primary_source: 'osm',
    })
  }
  return { company, contacts }
}

export async function runOsmIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { countries: [] as string[] },
  }
  const countriesProcessed: string[] = []
  try {
    const sb = vaultClient()
    const targetCountries = Object.keys(COUNTRY_AREAS) as Array<keyof typeof COUNTRY_AREAS>

    for (const country of targetCountries) {
      console.log(`[osm] querying ${country}`)
      const elements = await overpassQuery(buildQuery(country))
      countriesProcessed.push(country)

      for (const el of elements) {
        result.rows_processed++
        const parsed = elementToCompany(el, country)
        if (!parsed) {
          result.rows_skipped++
          continue
        }

        if (opts.dryRun) {
          result.rows_inserted++
          continue
        }

        const { data: companyRow, error: companyErr } = await sb
          .from('lv_companies')
          .upsert(parsed.company, { onConflict: 'siren', ignoreDuplicates: true })
          .select('id')
          .maybeSingle()

        if (companyErr || !companyRow) {
          result.rows_skipped++
          continue
        }

        result.rows_inserted++

        for (const c of parsed.contacts) {
          await sb.from('lv_contacts').upsert(
            { ...c, company_id: companyRow.id },
            { onConflict: 'contact_value,contact_type', ignoreDuplicates: true },
          )
        }
        if (opts.limit && result.rows_inserted >= opts.limit) break
      }
      if (opts.limit && result.rows_inserted >= opts.limit) break
    }

    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'osm', delta_count: result.rows_inserted, is_full_pull: !opts.delta })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    result.metadata = { countries: countriesProcessed }
    if (!opts.dryRun) {
      await logSync({ source_id: 'osm', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }
  return result
}
