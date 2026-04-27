/**
 * Tchéquie Persons enrichment — ARES (Administrativní registr ekonomických subjektů)
 *
 * Source  : https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/
 *           (ARES V2 REST API — gratuit, sans auth)
 * License : Volně dostupné — libre réutilisation
 * Volume  : ~3M sujets
 *
 * Stratégie :
 *   1. Cursor sur lv_companies WHERE country_iso='CZE' si déjà peuplé
 *   2. Sinon : bulk via ARES v2 recherche paginée (taille max 100 par page)
 *      GET /ekonomicke-subjekty?pocet=100&start=N
 *   3. Pour chaque ICO → GET /ekonomicke-subjekty/{ico}/zakladni-udaje → statutarniOrgany → osoby
 *   4. Cache /root/leads-vault/cache/ares/
 */

import { mkdir } from 'fs/promises'
import { vaultClient } from '../client'
import { logSync } from '../log'
import { splitFullName } from './role-classifier'
import type { LvCompanyInsert, LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'
const CACHE_DIR = '/root/leads-vault/cache/ares'
const SLEEP_MS = 200
const BATCH_SIZE = 200

type AresSubjekt = {
  ico?: string
  obchodniJmeno?: string
  sidlo?: {
    textovaAdresa?: string
    obec?: string
    psc?: string
    statNazev?: string
  }
  datumVzniku?: string
  datumZaniku?: string | null
  pravniForma?: string
}

type AresOsoba = {
  jmeno?: string
  prijmeni?: string
  funkce?: string
  datumNarozeni?: string
  clenstvi?: { datumVzniku?: string; datumZaniku?: string | null }
}

type AresOrgan = {
  nazev?: string
  clenove?: AresOsoba[]
}

type AresDetail = {
  ico?: string
  obchodniJmeno?: string
  sidlo?: AresSubjekt['sidlo']
  datumVzniku?: string
  datumZaniku?: string | null
  statutarniOrgany?: AresOrgan[]
  jednatele?: AresOsoba[]
  spolecnici?: AresOsoba[]
}

type AresSearchResponse = {
  ekonomickeSubjekty?: AresSubjekt[]
  pocet?: number
  start?: number
}

function mapCzRole(funkce: string | undefined, organNazev: string | undefined): { label: string; seniority: 'c-level' | 'vp' | 'director' | 'manager' | 'individual'; score: number } | null {
  const f = (funkce ?? '').toLowerCase()
  const o = (organNazev ?? '').toLowerCase()

  if (f.includes('jednatel') || o.includes('jednatel')) {
    return { label: 'Jednatel', seniority: 'c-level', score: 95 }
  }
  if (f.includes('předseda představenstva') || (f.includes('předseda') && o.includes('představenstvo'))) {
    return { label: 'Předseda představenstva', seniority: 'c-level', score: 92 }
  }
  if (f.includes('člen představenstva') || o.includes('představenstvo')) {
    return { label: 'Člen představenstva', seniority: 'director', score: 65 }
  }
  if (f.includes('předseda dozorčí') || (f.includes('předseda') && o.includes('dozorčí'))) {
    return { label: 'Předseda dozorčí rady', seniority: 'c-level', score: 85 }
  }
  if (f.includes('člen dozorčí') || o.includes('dozorčí')) {
    return { label: 'Člen dozorčí rady', seniority: 'director', score: 55 }
  }
  if (f.includes('společník') || f.includes('spolecnik')) {
    return { label: 'Společník', seniority: 'director', score: 60 }
  }
  if (f.includes('likvidátor') || f.includes('likvidator')) {
    return null // liquidator — skip
  }
  if (f.includes('insolvenční') || f.includes('správce')) {
    return null // insolvency admin — skip
  }
  if (f.includes('auditor') || f.includes('revizor')) {
    return null // auditor — skip
  }
  if (!f && !o) return null
  return { label: funkce ?? organNazev ?? 'Unknown', seniority: 'individual', score: 20 }
}

async function fetchSubjektDetail(ico: string): Promise<AresDetail | null> {
  const url = `${ARES_BASE}/${encodeURIComponent(ico)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return fetchSubjektDetail(ico)
  }
  if (!res.ok) {
    console.error(`[persons-cz-ares] ARES HTTP ${res.status} for ico=${ico}`)
    return null
  }
  return (await res.json()) as AresDetail
}

async function searchSubjekty(start: number, pocet: number): Promise<AresSearchResponse> {
  const url = `${ARES_BASE}?pocet=${pocet}&start=${start}&sort=ICO&sortDirection=ASC`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 10000))
    return searchSubjekty(start, pocet)
  }
  if (!res.ok) throw new Error(`ARES search HTTP ${res.status} start=${start}`)
  return (await res.json()) as AresSearchResponse
}

function subjektToCompany(s: AresSubjekt | AresDetail): LvCompanyInsert | null {
  if (!s.ico || !s.obchodniJmeno) return null
  if (s.datumZaniku) return null // zaniklá společnost
  const foundedYear = s.datumVzniku ? parseInt(s.datumVzniku.slice(0, 4), 10) : null
  return {
    crn: s.ico,
    legal_name: s.obchodniJmeno,
    country_iso: 'CZE',
    city: s.sidlo?.obec ?? null,
    postal_code: s.sidlo?.psc ?? null,
    address: s.sidlo?.textovaAdresa ?? null,
    founded_year: foundedYear && !isNaN(foundedYear) ? foundedYear : null,
    status: 'active',
    primary_source: 'opencorporates' as const,
  }
}

function osobaToPerson(osoba: AresOsoba, companyId: string, funkce: string | undefined, organNazev: string | undefined): LvPersonInsert | null {
  if (osoba.clenstvi?.datumZaniku) return null // historical / resigned

  const first = (osoba.jmeno ?? '').trim()
  const last = (osoba.prijmeni ?? '').trim()
  if (!first && !last) return null

  const mapped = mapCzRole(funkce ?? osoba.funkce, organNazev)
  if (!mapped) return null

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

function extractPersonsFromDetail(detail: AresDetail, companyId: string): LvPersonInsert[] {
  const persons: LvPersonInsert[] = []

  // Statutory organs (představenstvo, dozorčí rada, jednatelé, ...)
  for (const organ of detail.statutarniOrgany ?? []) {
    for (const clen of organ.clenove ?? []) {
      const p = osobaToPerson(clen, companyId, clen.funkce, organ.nazev)
      if (p) persons.push(p)
    }
  }

  // Explicit jednatele (SRO managers)
  for (const j of detail.jednatele ?? []) {
    const p = osobaToPerson(j, companyId, 'Jednatel', 'Jednatel')
    if (p) persons.push(p)
  }

  // Spolecnici (partners/shareholders who are also active in management)
  for (const s of detail.spolecnici ?? []) {
    const p = osobaToPerson(s, companyId, 'Společník', 'Společník')
    if (p) persons.push(p)
  }

  return persons
}

export async function runPersonsCzAres(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 5000
  const client = vaultClient()

  await mkdir(CACHE_DIR, { recursive: true })

  let processed = 0
  let inserted = 0
  let companiesInserted = 0
  let skipped = 0
  const personsBatch: LvPersonInsert[] = []

  // Check if we have CZE companies already
  const { data: existingRows, error: existErr } = await client
    .from('lv_companies')
    .select('id, crn')
    .eq('country_iso', 'CZE')
    .not('crn', 'is', null)
    .order('crn', { ascending: true })
    .limit(limit)

  if (!existErr && existingRows && existingRows.length > 0) {
    // Enrich persons for existing CZE companies
    type Row = { id: string; crn: string }
    for (const row of existingRows as Row[]) {
      processed++
      try {
        const detail = await fetchSubjektDetail(row.crn)
        if (!detail) { skipped++; continue }
        const persons = extractPersonsFromDetail(detail, row.id)
        for (const p of persons) personsBatch.push(p)
        if (persons.length === 0) skipped++
      } catch (e) {
        console.error(`[persons-cz-ares] ${row.crn}:`, (e as Error).message)
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
        console.log(`[persons-cz-ares] ${processed}/${existingRows.length} processed, ${inserted} persons batched`)
      }
    }
  } else {
    // Bulk ingest via ARES search + detail
    let start = 0
    const PAGE_SIZE = 100
    let totalFetched = 0

    while (totalFetched < limit) {
      let searchResp: AresSearchResponse
      try {
        searchResp = await searchSubjekty(start, PAGE_SIZE)
      } catch (e) {
        console.error('[persons-cz-ares] search error:', (e as Error).message)
        break
      }
      const subjekty = searchResp.ekonomickeSubjekty ?? []
      if (subjekty.length === 0) break

      for (const s of subjekty) {
        if (totalFetched >= limit) break
        processed++
        totalFetched++

        if (!s.ico) { skipped++; continue }

        // Fetch full detail (needed for persons)
        let detail: AresDetail | null = null
        try {
          detail = await fetchSubjektDetail(s.ico)
        } catch (e) {
          console.error(`[persons-cz-ares] detail ${s.ico}:`, (e as Error).message)
        }

        const company = subjektToCompany(detail ?? s)
        if (!company) { skipped++; continue }

        let companyId: string | null = null
        if (!opts.dryRun) {
          const { data: existing } = await client
            .from('lv_companies')
            .select('id')
            .eq('crn', s.ico)
            .eq('country_iso', 'CZE')
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

        if (companyId && detail) {
          const persons = extractPersonsFromDetail(detail, companyId)
          for (const p of persons) personsBatch.push(p)
          if (persons.length === 0) skipped++
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

      start += PAGE_SIZE
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

  console.log(`[persons-cz-ares] done: ${processed} processed, ${inserted} persons, ${companiesInserted} companies`)
  return result
}
