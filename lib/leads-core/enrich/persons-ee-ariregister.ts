/**
 * Estonie Persons enrichment — Äriregister (Estonian Business Register)
 *
 * Source  : https://avaandmed.ariregister.rik.ee/en/downloading-open-data
 *           API REST : https://ariregister.rik.ee/eng/api
 *           Open Data JSON : https://avaandmed.eesti.ee/andmestikud/ariregister
 * Auth    : aucune pour les endpoints open data
 * License : Creative Commons CC BY 4.0 — réutilisation commerciale libre
 * Volume  : ~400k entreprises actives + officers (depuis oct 2022)
 *
 * Stratégie :
 *   1. Cursor sur lv_companies WHERE country_iso='EST' si déjà peuplé
 *   2. Sinon : bulk via API REST paginée
 *      GET https://ariregister.rik.ee/api/v1/company?pg=N&pg_size=100
 *   3. Pour chaque registrikood : GET /api/v1/company/{code} → officers (juhatus/nõukogu)
 *   4. Cache /root/leads-vault/cache/ariregister/
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync } from '../log'
import { splitFullName } from './role-classifier'
import type { LvCompanyInsert, LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://ariregister.rik.ee/api/v1'
const CACHE_DIR = '/root/leads-vault/cache/ariregister'
const SLEEP_MS = 200
const BATCH_SIZE = 200

type EeCompanySummary = {
  ariregistri_kood?: string
  nimi?: string
  ettevotja_oiguslik_vorm?: string
  asukoht_ettevotja_aadress_ads_oid?: string
  registreeritud?: string
  kustutatud?: string | null
  staatus?: string
  maakond?: string
  vald?: string
  linn?: string
  indeks?: string
  aadress?: string
}

type EeOfficer = {
  eesnimi?: string
  perekonnanimi?: string
  nimi?: string
  isikukood?: string | null
  amet?: string
  rolli_liik?: string
  algus_kpv?: string
  lopp_kpv?: string | null
}

type EeCompanyDetail = {
  ariregistri_kood?: string
  nimi?: string
  staatus?: string
  registreeritud?: string
  kustutatud?: string | null
  aadress?: string
  maakond?: string
  indeks?: string
  juhatus?: EeOfficer[]
  noukogu?: EeOfficer[]
  prokurist?: EeOfficer[]
  likvid?: EeOfficer[]
}

type EeSearchResponse = {
  data?: EeCompanySummary[]
  total?: number
  pg?: number
  pg_size?: number
}

function mapEeRole(amet: string | undefined, rolli_liik: string | undefined, boardType: 'juhatus' | 'noukogu' | 'prokurist'): { label: string; seniority: 'c-level' | 'vp' | 'director' | 'manager' | 'individual'; score: number } | null {
  const a = (amet ?? '').toLowerCase()
  const r = (rolli_liik ?? '').toLowerCase()

  if (boardType === 'juhatus') {
    if (a.includes('juhatuse esimees') || a.includes('chairman') || r.includes('esimees')) {
      return { label: 'Juhatuse esimees', seniority: 'c-level', score: 95 }
    }
    return { label: 'Juhatuse liige', seniority: 'director', score: 70 }
  }

  if (boardType === 'noukogu') {
    if (a.includes('nõukogu esimees') || r.includes('esimees')) {
      return { label: 'Nõukogu esimees', seniority: 'c-level', score: 85 }
    }
    return { label: 'Nõukogu liige', seniority: 'director', score: 55 }
  }

  if (boardType === 'prokurist') {
    return { label: 'Prokurist', seniority: 'vp', score: 75 }
  }

  // Generic fallback using amet
  if (a.includes('juhataja') || a.includes('director') || a.includes('ceo')) {
    return { label: amet ?? 'Juhataja', seniority: 'c-level', score: 90 }
  }
  if (a.includes('liige') || a.includes('member')) {
    return { label: amet ?? 'Liige', seniority: 'director', score: 60 }
  }
  if (!a && !r) return null
  return { label: amet ?? rolli_liik ?? 'Unknown', seniority: 'individual', score: 20 }
}

async function fetchCompanies(pg: number, pg_size: number): Promise<EeSearchResponse> {
  const url = `${API_BASE}/company?pg=${pg}&pg_size=${pg_size}&status=R`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'LeadVault/1.0 (gapup.io)' },
  })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return fetchCompanies(pg, pg_size)
  }
  if (!res.ok) throw new Error(`Äriregister companies HTTP ${res.status} pg=${pg}`)
  return (await res.json()) as EeSearchResponse
}

async function fetchCompanyDetail(code: string): Promise<EeCompanyDetail | null> {
  const url = `${API_BASE}/company/${encodeURIComponent(code)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'LeadVault/1.0 (gapup.io)' },
  })
  if (res.status === 404) return null
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return fetchCompanyDetail(code)
  }
  if (!res.ok) {
    console.error(`[persons-ee-ariregister] HTTP ${res.status} for code=${code}`)
    return null
  }
  return (await res.json()) as EeCompanyDetail
}

function summaryToCompany(s: EeCompanySummary): LvCompanyInsert | null {
  if (!s.ariregistri_kood || !s.nimi) return null
  if (s.kustutatud) return null // deleted
  const foundedYear = s.registreeritud ? parseInt(s.registreeritud.slice(0, 4), 10) : null
  return {
    crn: s.ariregistri_kood,
    legal_name: s.nimi,
    country_iso: 'EST',
    city: s.linn ?? s.vald ?? null,
    postal_code: s.indeks ?? null,
    address: s.aadress ?? null,
    region: s.maakond ?? null,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    status: 'active',
    primary_source: 'opencorporates' as const,
  }
}

function officerToPerson(o: EeOfficer, companyId: string, boardType: 'juhatus' | 'noukogu' | 'prokurist'): LvPersonInsert | null {
  if (o.lopp_kpv) return null // historical / resigned

  const first = (o.eesnimi ?? '').trim()
  const last = (o.perekonnanimi ?? '').trim()
  const fullRaw = (o.nimi ?? '').trim() || [first, last].filter(Boolean).join(' ')
  if (!fullRaw) return null

  const mapped = mapEeRole(o.amet, o.rolli_liik, boardType)
  if (!mapped) return null

  const names = fullRaw.includes(' ') ? splitFullName(fullRaw) : { first: first || null, last: last || null }

  return {
    company_id: companyId,
    full_name: fullRaw,
    first_name: first || names.first,
    last_name: last || names.last,
    role: mapped.label,
    role_seniority: mapped.seniority,
    decision_maker_score: mapped.score,
    primary_source: 'opencorporates' as const,
  }
}

function extractPersonsFromDetail(detail: EeCompanyDetail, companyId: string): LvPersonInsert[] {
  const persons: LvPersonInsert[] = []

  for (const o of detail.juhatus ?? []) {
    const p = officerToPerson(o, companyId, 'juhatus')
    if (p) persons.push(p)
  }
  for (const o of detail.noukogu ?? []) {
    const p = officerToPerson(o, companyId, 'noukogu')
    if (p) persons.push(p)
  }
  for (const o of detail.prokurist ?? []) {
    const p = officerToPerson(o, companyId, 'prokurist')
    if (p) persons.push(p)
  }

  return persons
}

export async function runPersonsEeAriregister(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 5000
  const client = vaultClient()

  await mkdir(CACHE_DIR, { recursive: true })

  let processed = 0
  let inserted = 0
  let companiesInserted = 0
  let skipped = 0
  const personsBatch: LvPersonInsert[] = []

  // Check if we have EST companies already
  const { data: existingRows, error: existErr } = await client
    .from('lv_companies')
    .select('id, crn')
    .eq('country_iso', 'EST')
    .not('crn', 'is', null)
    .order('crn', { ascending: true })
    .limit(limit)

  if (!existErr && existingRows && existingRows.length > 0) {
    // Enrich persons for existing EST companies
    type Row = { id: string; crn: string }
    for (const row of existingRows as Row[]) {
      processed++
      try {
        const detail = await fetchCompanyDetail(row.crn)
        if (!detail) { skipped++; continue }
        const persons = extractPersonsFromDetail(detail, row.id)
        for (const p of persons) personsBatch.push(p)
        if (persons.length === 0) skipped++
      } catch (e) {
        console.error(`[persons-ee-ariregister] ${row.crn}:`, (e as Error).message)
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
        console.log(`[persons-ee-ariregister] ${processed}/${existingRows.length} processed, ${inserted} persons batched`)
      }
    }
  } else {
    // Bulk ingest via Äriregister API
    let pg = 1
    const PG_SIZE = 100
    let totalFetched = 0

    while (totalFetched < limit) {
      let searchResp: EeSearchResponse
      try {
        searchResp = await fetchCompanies(pg, PG_SIZE)
      } catch (e) {
        console.error('[persons-ee-ariregister] search error:', (e as Error).message)
        break
      }
      const companies = searchResp.data ?? []
      if (companies.length === 0) break

      for (const s of companies) {
        if (totalFetched >= limit) break
        processed++
        totalFetched++

        if (!s.ariregistri_kood) { skipped++; continue }

        const company = summaryToCompany(s)
        if (!company) { skipped++; continue }

        let companyId: string | null = null
        if (!opts.dryRun) {
          const { data: existing } = await client
            .from('lv_companies')
            .select('id')
            .eq('crn', s.ariregistri_kood)
            .eq('country_iso', 'EST')
            .single()

          if (existing) {
            companyId = (existing as { id: string }).id
          } else {
            const insertRes = await (client.from as any)('lv_companies')
              .insert(company)
              .select('id')
              .single() as { data: { id: string } | null; error: { message: string } | null }
            if (!insertRes.error && insertRes.data) {
              companyId = insertRes.data.id
              companiesInserted++
            }
          }
        }

        if (companyId) {
          try {
            const detail = await fetchCompanyDetail(s.ariregistri_kood)
            if (detail) {
              const persons = extractPersonsFromDetail(detail, companyId)
              for (const p of persons) personsBatch.push(p)
              if (persons.length === 0) skipped++
            }
          } catch (e) {
            console.error(`[persons-ee-ariregister] detail ${s.ariregistri_kood}:`, (e as Error).message)
          }
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

      pg++
      if (totalFetched >= limit) break
    }
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

  console.log(`[persons-ee-ariregister] done: ${processed} processed, ${inserted} persons, ${companiesInserted} companies`)
  return result
}
