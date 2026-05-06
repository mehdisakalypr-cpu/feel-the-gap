/**
 * Finlande Persons enrichment — PRH / YTJ Open Data API v3
 *
 * Source  : https://avoindata.prh.fi/opendata-ytj-api/v3/
 * Auth    : aucune
 * License : CC BY 4.0 — réutilisation commerciale libre
 * Volume  : ~600k entreprises + officers
 *
 * Stratégie :
 *   1. Liste paginée des entreprises via GET /companies?maxResults=1000&page=N
 *   2. Pour chaque businessId : GET /companies/{businessId} → companyPersons[]
 *   3. Insérer lv_companies (FIN) + lv_persons en batch.
 *   4. Throttle 200ms entre calls.
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync } from '../log'
import { splitFullName } from './role-classifier'
import type { LvCompanyInsert, LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://avoindata.prh.fi/opendata-ytj-api/v3'
const CACHE_DIR = '/root/leads-vault/cache/prh'
const SLEEP_MS = 200
const BATCH_SIZE = 200

type PrhCompanySummary = {
  businessId?: string
  name?: string
  registrationDate?: string
  companyForm?: string
  detailsUri?: string
}

type PrhPerson = {
  name?: string
  role?: {
    name?: string
    type?: string
  }
  endDate?: string | null
  startDate?: string
}

type PrhCompanyDetail = {
  businessId?: string
  name?: string
  companyPersons?: PrhPerson[]
  mainBusinessLine?: {
    code?: string
    name?: string
  }
  registrationDate?: string
  companyForm?: string
  addresses?: Array<{
    city?: string
    postCode?: string
    street?: string
    type?: number
  }>
}

type PrhSearchResponse = {
  results?: PrhCompanySummary[]
  totalResults?: number
  nextResultsUri?: string | null
}

function mapPrhRole(roleType: string | undefined, roleName: string | undefined): { label: string; seniority: 'c-level' | 'vp' | 'director' | 'manager' | 'individual'; score: number } | null {
  const t = (roleType ?? '').toLowerCase()
  const n = (roleName ?? '').toLowerCase()

  if (t === 'md' || n.includes('toimitusjohtaja') || n.includes('managing director') || n === 'md') {
    return { label: 'Toimitusjohtaja (MD)', seniority: 'c-level', score: 95 }
  }
  if (t === 'chairman' || n.includes('hallituksen puheenjohtaja') || n.includes('chairman')) {
    return { label: 'Hallituksen puheenjohtaja (Chairman)', seniority: 'c-level', score: 90 }
  }
  if (t === 'boardmember' || n.includes('hallituksen jäsen') || n.includes('board member')) {
    return { label: 'Hallituksen jäsen (Board Member)', seniority: 'director', score: 65 }
  }
  if (n.includes('varajäsen') || n.includes('alternate')) {
    return { label: 'Varajäsen (Alternate)', seniority: 'director', score: 50 }
  }
  if (n.includes('tilintarkast') || n.includes('auditor') || t === 'auditor') {
    return null // skip auditors
  }
  if (n.includes('prokuristi') || n.includes('prokura')) {
    return { label: 'Prokuristi', seniority: 'vp', score: 75 }
  }
  if (n.includes('yhtiömies') || n.includes('partner')) {
    return { label: 'Yhtiömies (Partner)', seniority: 'c-level', score: 85 }
  }
  if (n.includes('vastuunalainen') || n.includes('responsible partner')) {
    return { label: 'Vastuunalainen yhtiömies', seniority: 'c-level', score: 88 }
  }
  if (!t && !n) return null
  return { label: roleName ?? roleType ?? 'Unknown', seniority: 'individual', score: 20 }
}

async function fetchCompanySummaries(page: number, maxResults: number): Promise<PrhSearchResponse> {
  const url = `${API_BASE}/companies?totalResults=true&maxResults=${maxResults}&page=${page}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return fetchCompanySummaries(page, maxResults)
  }
  if (!res.ok) throw new Error(`PRH companies HTTP ${res.status} page=${page}`)
  return (await res.json()) as PrhSearchResponse
}

async function fetchCompanyDetail(businessId: string): Promise<PrhCompanyDetail | null> {
  const url = `${API_BASE}/companies/${encodeURIComponent(businessId)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return fetchCompanyDetail(businessId)
  }
  if (!res.ok) {
    console.error(`PRH detail HTTP ${res.status} for ${businessId}`)
    return null
  }
  return (await res.json()) as PrhCompanyDetail
}

function summaryToCompany(s: PrhCompanySummary): LvCompanyInsert | null {
  if (!s.businessId || !s.name) return null
  const foundedYear = s.registrationDate
    ? parseInt(s.registrationDate.slice(0, 4), 10)
    : null
  return {
    crn: s.businessId,
    legal_name: s.name,
    country_iso: 'FIN',
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    status: 'active',
    primary_source: 'prh' as const,
  }
}

function detailToCompanyPatch(d: PrhCompanyDetail): Partial<LvCompanyInsert> {
  const regAddr = d.addresses?.find((a) => a.type === 1) ?? d.addresses?.[0]
  return {
    city: regAddr?.city ?? null,
    postal_code: regAddr?.postCode ?? null,
    address: regAddr?.street ?? null,
    nace_code: d.mainBusinessLine?.code ?? null,
  }
}

function personToPerson(p: PrhPerson, companyId: string): LvPersonInsert | null {
  if (p.endDate) return null // resigned / historical
  const fullRaw = (p.name ?? '').trim()
  if (!fullRaw) return null

  const mapped = mapPrhRole(p.role?.type, p.role?.name)
  if (!mapped) return null

  const { first, last } = splitFullName(fullRaw)
  return {
    company_id: companyId,
    full_name: fullRaw,
    first_name: first,
    last_name: last,
    role: mapped.label,
    role_seniority: mapped.seniority,
    decision_maker_score: mapped.score,
    primary_source: 'prh' as const,
  }
}

export async function runPersonsFiPrh(opts: ConnectorOptions = {}): Promise<SyncResult> {
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

  // Check if we have FIN companies already
  const { data: existingRows, error: existErr } = await client
    .from('lv_companies')
    .select('id, crn')
    .eq('country_iso', 'FIN')
    .not('crn', 'is', null)
    .order('crn', { ascending: true })
    .limit(limit)

  if (!existErr && existingRows && existingRows.length > 0) {
    // Enrich persons for existing FIN companies
    type Row = { id: string; crn: string }
    for (const row of existingRows as Row[]) {
      processed++
      try {
        const detail = await fetchCompanyDetail(row.crn)
        if (!detail) { skipped++; continue }
        for (const p of detail.companyPersons ?? []) {
          const person = personToPerson(p, row.id)
          if (!person) { skipped++; continue }
          personsBatch.push(person)
        }
      } catch (e) {
        console.error(`[persons-fi-prh] ${row.crn}:`, (e as Error).message)
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
        console.log(`[persons-fi-prh] ${processed}/${existingRows.length} processed, ${inserted} persons batched`)
      }
    }
  } else {
    // Bulk ingest: companies + persons together
    let page = 0
    const PAGE_SIZE = 100
    let totalFetched = 0

    while (totalFetched < limit) {
      let summaries: PrhSearchResponse
      try {
        summaries = await fetchCompanySummaries(page, PAGE_SIZE)
      } catch (e) {
        console.error('[persons-fi-prh] summaries error:', (e as Error).message)
        break
      }
      const results = summaries.results ?? []
      if (results.length === 0) break

      for (const s of results) {
        if (totalFetched >= limit) break
        processed++
        totalFetched++

        const company = summaryToCompany(s)
        if (!company) { skipped++; continue }

        let companyId: string | null = null

        if (!opts.dryRun) {
          const { data: existing } = await client
            .from('lv_companies')
            .select('id')
            .eq('crn', s.businessId!)
            .eq('country_iso', 'FIN')
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

        if (!companyId) {
          await new Promise((r) => setTimeout(r, SLEEP_MS))
          continue
        }

        // Fetch detail for persons
        try {
          const detail = await fetchCompanyDetail(s.businessId!)
          if (detail) {
            for (const p of detail.companyPersons ?? []) {
              const person = personToPerson(p, companyId)
              if (!person) { skipped++; continue }
              personsBatch.push(person)
            }
          }
        } catch (e) {
          console.error(`[persons-fi-prh] detail ${s.businessId}:`, (e as Error).message)
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

  console.log(`[persons-fi-prh] done: ${processed} processed, ${inserted} persons, ${companiesInserted} companies`)
  return result
}
