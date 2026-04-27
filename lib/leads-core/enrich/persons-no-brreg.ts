/**
 * Norvège Persons enrichment — Brønnøysundregistrene (Brreg)
 *
 * Source  : https://data.brreg.no/enhetsregisteret/api
 * Auth    : aucune
 * License : NLOD 2.0 — libre réutilisation commerciale
 * Volume  : ~800k enheter actives, ~1.5M roller (DAGL/STYR/MEDL/INNH/VARA)
 *
 * Stratégie :
 *   1. Bulk download enheter (entreprises) via scroll paginé JSON (HAL format)
 *      ou fichier lastNed si disponible.
 *   2. Pour chaque enhet, récupérer les roller (dirigeants) via /roller endpoint.
 *   3. Insérer lv_companies (NOR) + lv_persons en batch.
 *   4. Cache fichier /root/leads-vault/cache/brreg/enheter.ndjson (< 24h)
 */

import { createWriteStream, existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve } from 'path'
import { vaultClient } from '../client'
import { logSync } from '../log'
import { splitFullName } from './role-classifier'
import type { LvCompanyInsert, LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://data.brreg.no/enhetsregisteret/api'
const CACHE_DIR = '/root/leads-vault/cache/brreg'
const SLEEP_MS = 200
const BATCH_SIZE = 200
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

type BrregEnhet = {
  organisasjonsnummer: string
  navn: string
  organisasjonsform?: { kode?: string }
  forretningsadresse?: {
    kommune?: string
    postnummer?: string
    poststed?: string
    adresse?: string[]
    landkode?: string
  }
  registreringsdatoEnhetsregisteret?: string
  antallAnsatte?: number
  konkurs?: boolean
  underAvvikling?: boolean
  slettedato?: string
  naeringskode1?: { kode?: string; beskrivelse?: string }
}

type BrregRolle = {
  type?: { kode?: string; beskrivelse?: string }
  person?: {
    navn?: {
      fornavn?: string
      etternavn?: string
    }
    fodselsdato?: string
  }
  fratraadt?: boolean
}

type BrregRollerResponse = {
  rollegrupper?: Array<{
    type?: { kode?: string }
    roller?: BrregRolle[]
  }>
}

function mapRoleCode(kode: string): { label: string; seniority: 'c-level' | 'vp' | 'director' | 'manager' | 'individual'; score: number } | null {
  switch (kode) {
    case 'DAGL': return { label: 'Daglig leder', seniority: 'c-level', score: 95 }
    case 'STYR': return { label: 'Styreleder', seniority: 'c-level', score: 90 }
    case 'LEDE': return { label: 'Leder', seniority: 'c-level', score: 88 }
    case 'MEDL': return { label: 'Styremedlem', seniority: 'director', score: 65 }
    case 'VARA': return { label: 'Varamedlem', seniority: 'director', score: 55 }
    case 'INNH': return { label: 'Innehaver', seniority: 'c-level', score: 95 }
    case 'BEST': return { label: 'Bestyrende reder', seniority: 'c-level', score: 85 }
    case 'REPR': return { label: 'Norsk representant', seniority: 'director', score: 60 }
    case 'REVI': return null // Revisor — skip
    case 'KONT': return null // Kontaktperson — skip
    default: return { label: kode, seniority: 'individual', score: 20 }
  }
}

async function fetchRoller(orgnr: string): Promise<BrregRollerResponse> {
  const url = `${API_BASE}/enheter/${encodeURIComponent(orgnr)}/roller`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404 || res.status === 410) return {}
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 5000))
    return fetchRoller(orgnr)
  }
  if (!res.ok) throw new Error(`Brreg roller HTTP ${res.status} for ${orgnr}`)
  return (await res.json()) as BrregRollerResponse
}

function enhetToCompany(e: BrregEnhet): LvCompanyInsert | null {
  if (!e.organisasjonsnummer || !e.navn) return null
  if (e.slettedato || e.konkurs || e.underAvvikling) return null
  const addr = e.forretningsadresse
  const foundedYear = e.registreringsdatoEnhetsregisteret
    ? parseInt(e.registreringsdatoEnhetsregisteret.slice(0, 4), 10)
    : null
  return {
    crn: e.organisasjonsnummer,
    legal_name: e.navn,
    country_iso: 'NOR',
    city: addr?.poststed ?? null,
    postal_code: addr?.postnummer ?? null,
    address: addr?.adresse?.join(', ') ?? null,
    region: addr?.kommune ?? null,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    employees_estimate: typeof e.antallAnsatte === 'number' ? e.antallAnsatte : null,
    status: 'active',
    nace_code: e.naeringskode1?.kode ?? null,
    primary_source: 'opencorporates' as const,
  }
}

function rolleToPersons(r: BrregRolle, companyId: string): LvPersonInsert | null {
  if (r.fratraadt) return null
  const kode = r.type?.kode ?? ''
  const mapped = mapRoleCode(kode)
  if (!mapped) return null

  const nav = r.person?.navn
  if (!nav) return null
  const first = (nav.fornavn ?? '').trim()
  const last = (nav.etternavn ?? '').trim()
  if (!first && !last) return null

  const full = [first, last].filter(Boolean).join(' ')
  return {
    company_id: companyId,
    full_name: full,
    first_name: first || null,
    last_name: last || null,
    role: mapped.label,
    role_seniority: mapped.seniority,
    decision_maker_score: mapped.score,
    primary_source: 'opencorporates' as const,
  }
}

export async function runPersonsNoBrreg(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 5000
  const client = vaultClient()

  await mkdir(CACHE_DIR, { recursive: true })

  let processed = 0
  let inserted = 0
  let companiesInserted = 0
  let skipped = 0
  const companiesBatch: LvCompanyInsert[] = []
  const personsBatch: LvPersonInsert[] = []

  // Cursor over lv_companies WHERE country_iso='NOR' first
  // If no NOR companies yet, fall back to bulk API ingestion
  const { data: existingRows, error: existErr } = await client
    .from('lv_companies')
    .select('id, crn')
    .eq('country_iso', 'NOR')
    .not('crn', 'is', null)
    .order('crn', { ascending: true })
    .limit(limit)

  if (!existErr && existingRows && existingRows.length > 0) {
    // We have NOR companies — enrich persons only
    type Row = { id: string; crn: string }
    for (const row of existingRows as Row[]) {
      processed++
      try {
        const rollerResp = await fetchRoller(row.crn)
        const allRoller: BrregRolle[] = []
        for (const grp of rollerResp.rollegrupper ?? []) {
          for (const r of grp.roller ?? []) {
            allRoller.push({ ...r, type: grp.type })
          }
        }
        for (const r of allRoller) {
          const p = rolleToPersons(r, row.id)
          if (!p) { skipped++; continue }
          personsBatch.push(p)
        }
      } catch (e) {
        console.error(`[persons-no-brreg] roller ${row.crn}:`, (e as Error).message)
      }

      if (personsBatch.length >= BATCH_SIZE) {
        if (!opts.dryRun) {
          const { error } = await (client.from as any)('lv_persons').insert(personsBatch)
          if (error && !error.message.includes('duplicate')) console.error('insert err:', error.message)
        }
        inserted += personsBatch.length
        personsBatch.length = 0
      }

      await new Promise((r) => setTimeout(r, SLEEP_MS))

      if (processed % 100 === 0) {
        console.log(`[persons-no-brreg] ${processed}/${existingRows.length} processed, ${inserted} persons batched`)
      }
    }
  } else {
    // Bulk ingest from Brreg API (search-paged) — ingest companies + persons together
    let page = 0
    const pageSize = 100
    let totalFetched = 0

    while (totalFetched < limit) {
      const url = `${API_BASE}/enheter?size=${pageSize}&page=${page}&sort=organisasjonsnummer%2Casc`
      let resp: Response
      try {
        resp = await fetch(url, { headers: { Accept: 'application/json' } })
      } catch (e) {
        console.error('[persons-no-brreg] fetch error:', (e as Error).message)
        break
      }
      if (!resp.ok) {
        console.error(`[persons-no-brreg] bulk API HTTP ${resp.status} page=${page}`)
        break
      }
      type BrregSearchResponse = { _embedded?: { enheter?: BrregEnhet[] }; page?: { totalElements?: number } }
      const json = (await resp.json()) as BrregSearchResponse
      const enheter = json._embedded?.enheter ?? []
      if (enheter.length === 0) break

      for (const enhet of enheter) {
        processed++
        totalFetched++

        const company = enhetToCompany(enhet)
        if (!company) { skipped++; continue }
        companiesBatch.push(company)

        if (companiesBatch.length >= BATCH_SIZE) {
          if (!opts.dryRun) {
            const { error } = await (client.from as any)('lv_companies').insert(companiesBatch)
            if (error && !error.message.includes('duplicate')) console.error('companies insert err:', error.message)
          }
          companiesInserted += companiesBatch.length
          companiesBatch.length = 0
        }

        if (totalFetched >= limit) break
      }

      // Flush companies batch before roller lookup (so company IDs are available)
      if (companiesBatch.length > 0 && !opts.dryRun) {
        const { error } = await (client.from as any)('lv_companies').insert(companiesBatch)
        if (error && !error.message.includes('duplicate')) console.error('companies page flush err:', error.message)
        else companiesInserted += companiesBatch.length
        companiesBatch.length = 0
      }

      // For each enhet in this page, fetch roller (throttled)
      for (const enhet of enheter.slice(0, Math.min(enheter.length, limit - (totalFetched - enheter.length)))) {
        if (!enhet.organisasjonsnummer) continue

        // Find inserted company id
        const { data: cRow } = await client
          .from('lv_companies')
          .select('id')
          .eq('crn', enhet.organisasjonsnummer)
          .eq('country_iso', 'NOR')
          .single()

        if (!cRow) continue

        try {
          const rollerResp = await fetchRoller(enhet.organisasjonsnummer)
          for (const grp of rollerResp.rollegrupper ?? []) {
            for (const r of grp.roller ?? []) {
              const p = rolleToPersons({ ...r, type: grp.type }, (cRow as { id: string }).id)
              if (!p) { skipped++; continue }
              personsBatch.push(p)
            }
          }
        } catch (e) {
          console.error(`[persons-no-brreg] roller ${enhet.organisasjonsnummer}:`, (e as Error).message)
        }

        if (personsBatch.length >= BATCH_SIZE) {
          if (!opts.dryRun) {
            const { error } = await (client.from as any)('lv_persons').insert(personsBatch)
            if (error && !error.message.includes('duplicate')) console.error('persons insert err:', error.message)
          }
          inserted += personsBatch.length
          personsBatch.length = 0
        }

        await new Promise((r) => setTimeout(r, SLEEP_MS))
      }

      page++
      if (totalFetched >= limit) break
    }
  }

  // Flush remaining companies
  if (companiesBatch.length > 0 && !opts.dryRun) {
    const { error } = await (client.from as any)('lv_companies').insert(companiesBatch)
    if (error && !error.message.includes('duplicate')) console.error('companies flush err:', error.message)
    else companiesInserted += companiesBatch.length
  }

  // Flush remaining persons
  if (personsBatch.length > 0 && !opts.dryRun) {
    const { error } = await (client.from as any)('lv_persons').insert(personsBatch)
    if (error && !error.message.includes('duplicate')) console.error('persons flush err:', error.message)
    else inserted += personsBatch.length
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted + companiesInserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { persons_inserted: inserted, companies_inserted: companiesInserted },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'opencorporates', operation: 'ingest', result })
    } catch (e) {
      console.error('logSync err:', (e as Error).message)
    }
  }

  console.log(`[persons-no-brreg] done: ${processed} processed, ${inserted} persons, ${companiesInserted} companies`)
  return result
}
