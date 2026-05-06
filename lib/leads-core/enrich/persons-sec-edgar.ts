/**
 * SEC EDGAR persons enrichment
 *
 * Source : https://data.sec.gov (JSON submissions) + Form 4 XML (insider transactions)
 * Auth   : none (User-Agent required, must include contact info)
 * Rate   : 10 req/sec max per SEC guidance → 120ms between requests
 * License: US government works — public domain
 *
 * Strategy:
 *   1. Cursor lv_companies WHERE country_iso='USA' ORDER BY id
 *   2. For each US company, look up CIK via EDGAR full-text company search
 *   3. Fetch /submissions/CIK{n}.json → recent Form 4 filings
 *   4. Parse Form 4 XML for Section 16 officers: rptOwnerName + officerTitle
 *   5. Insert lv_persons
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const EDGAR_DATA = 'https://data.sec.gov'
const EDGAR_WWW = 'https://www.sec.gov'
const SLEEP_MS = 120
const BATCH_SIZE = 100
const UA = 'feel-the-gap-leadsvault/1.0 Mehdi Sakaly mehdi.sakalypr@gmail.com'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function edgarGet<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 404) return null
  if (res.status === 429) {
    console.warn('[persons-sec-edgar] rate limited, sleeping 30s')
    await sleep(30_000)
    return edgarGet<T>(url)
  }
  if (!res.ok) {
    console.error(`[persons-sec-edgar] HTTP ${res.status} ${url}`)
    return null
  }
  return (await res.json()) as T
}

async function edgarGetText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  return res.text()
}

type EdgarCompanyMatch = {
  cik: string
  name: string
  tickers?: string[]
}

type EdgarSearchResult = {
  hits?: {
    hits?: Array<{
      _source?: EdgarCompanyMatch
    }>
  }
}

async function findCik(legalName: string): Promise<string | null> {
  const q = encodeURIComponent(legalName.replace(/[,\.]/g, ' ').trim())
  const url = `${EDGAR_WWW}/cgi-bin/browse-edgar?company=${q}&CIK=&type=&dateb=&owner=include&count=5&search_text=&action=getcompany&output=atom`
  const text = await edgarGetText(url)
  if (!text) return null

  // Parse CIK from Atom feed: <cik>0001234567</cik>
  const m = text.match(/<cik>(\d+)<\/cik>/)
  if (!m) {
    // Try EFTS search as fallback
    const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${q}%22&dateRange=custom&startdt=2020-01-01&forms=4&hits.hits._source=cik,name&hits.hits.total=1`
    const efts = await edgarGet<EdgarSearchResult>(eftsUrl)
    await sleep(SLEEP_MS)
    const cik = efts?.hits?.hits?.[0]?._source?.cik
    return cik ?? null
  }
  return m[1]
}

type EdgarSubmissions = {
  name?: string
  cik?: string
  filings?: {
    recent?: {
      form?: string[]
      accessionNumber?: string[]
      primaryDocument?: string[]
      filingDate?: string[]
    }
  }
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

function accessionToPath(accession: string): string {
  return accession.replace(/-/g, '')
}

type Form4Person = {
  name: string
  title: string | null
}

function parseForm4Xml(xml: string): Form4Person[] {
  const persons: Form4Person[] = []
  // Extract reporting owners
  const ownerBlocks = xml.match(/<reportingOwner>[\s\S]*?<\/reportingOwner>/g) ?? []
  for (const block of ownerBlocks) {
    const nameM = block.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/)
    const titleM = block.match(/<officerTitle>([^<]+)<\/officerTitle>/)
    const isOfficerM = block.match(/<isOfficer>([^<]+)<\/isOfficer>/)
    const isDirM = block.match(/<isDirector>([^<]+)<\/isDirector>/)

    const name = nameM?.[1]?.trim()
    if (!name) continue
    const isOfficer = isOfficerM?.[1]?.trim() === '1'
    const isDirector = isDirM?.[1]?.trim() === '1'
    if (!isOfficer && !isDirector) continue

    const title = titleM?.[1]?.trim() ?? null
    persons.push({ name, title })
  }
  return persons
}

async function fetchForm4Persons(cik: string): Promise<Form4Person[]> {
  const paddedCik = padCik(cik)
  const submissions = await edgarGet<EdgarSubmissions>(`${EDGAR_DATA}/submissions/CIK${paddedCik}.json`)
  await sleep(SLEEP_MS)
  if (!submissions) return []

  const recent = submissions.filings?.recent
  if (!recent) return []

  const forms = recent.form ?? []
  const accessions = recent.accessionNumber ?? []
  const primaryDocs = recent.primaryDocument ?? []
  const dates = recent.filingDate ?? []

  // Collect up to 5 most recent Form 4 filings
  const form4Indices: number[] = []
  for (let i = 0; i < forms.length && form4Indices.length < 5; i++) {
    if (forms[i] === '4') form4Indices.push(i)
  }

  if (!form4Indices.length) return []

  const seenNames = new Set<string>()
  const persons: Form4Person[] = []

  for (const idx of form4Indices) {
    const accession = accessions[idx]
    const primaryDoc = primaryDocs[idx]
    if (!accession || !primaryDoc) continue

    const accNoSlash = accessionToPath(accession)
    // primaryDocument from submissions API is the XSL-rendered path (e.g. xslF345X06/wk-form4_NNN.xml)
    // The raw XML is at the same filename without the xsl<...>/ prefix
    const rawDoc = primaryDoc.replace(/^xsl[^/]*\//, '')
    // /Archives/ is hosted on www.sec.gov (data.sec.gov returns 403)
    const xmlUrl = `${EDGAR_WWW}/Archives/edgar/data/${cik}/${accNoSlash}/${rawDoc}`
    const xml = await edgarGetText(xmlUrl)
    await sleep(SLEEP_MS)
    if (!xml) continue

    const parsed = parseForm4Xml(xml)
    for (const p of parsed) {
      if (!seenNames.has(p.name.toLowerCase())) {
        seenNames.add(p.name.toLowerCase())
        persons.push(p)
      }
    }
  }

  return persons
}

export async function runPersonsSecEdgar(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 500
  const client = vaultClient()

  type Row = { id: string; legal_name: string; crn: string | null }

  let lastId: string | null = null
  const list: Row[] = []
  while (list.length < totalLimit) {
    const remain = Math.min(1000, totalLimit - list.length)
    let q = client
      .from('lv_companies')
      .select('id, legal_name, crn')
      .eq('country_iso', 'USA')
      .order('id', { ascending: true })
      .limit(remain)
    if (lastId) q = q.gt('id', lastId)
    const { data: page, error } = await q
    if (error) {
      return {
        rows_processed: 0,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: 0,
        duration_ms: Date.now() - t0,
        error: error.message,
      }
    }
    const rows = (page ?? []) as Row[]
    if (!rows.length) break
    list.push(...rows)
    lastId = rows[rows.length - 1].id
    if (rows.length < remain) break
  }

  let processed = 0
  let inserted = 0
  let skipped = 0
  let notFound = 0
  const batch: LvPersonInsert[] = []

  for (const row of list) {
    processed++

    try {
      // Prefer crn (already CIK from SEC seed); fallback to text search by legal_name
      let cik: string | null = row.crn
      if (!cik) {
        cik = await findCik(row.legal_name)
        await sleep(SLEEP_MS)
      }
      if (!cik) {
        notFound++
        continue
      }

      const persons = await fetchForm4Persons(cik)
      if (!persons.length) { skipped++; continue }

      for (const p of persons) {
        const { seniority, score } = classifyRole(p.title)
        const { first, last } = splitFullName(p.name)
        batch.push({
          company_id: row.id,
          full_name: p.name,
          first_name: first,
          last_name: last,
          role: p.title ?? 'Section 16 Officer/Director',
          role_seniority: seniority,
          decision_maker_score: score,
          primary_source: 'sec_edgar',
        })
      }
    } catch (e) {
      console.error(`[persons-sec-edgar] ${row.legal_name}:`, (e as Error).message)
    }

    if (batch.length >= BATCH_SIZE) {
      if (!opts.dryRun) {
        const { error } = await client.from('lv_persons').insert(batch)
        if (error && !error.message.includes('duplicate')) console.error('[persons-sec-edgar] insert err:', error.message)
      }
      inserted += batch.length
      batch.length = 0
    }

    if (processed % 25 === 0) {
      console.log(
        `[persons-sec-edgar] ${processed}/${list.length} processed, ${inserted} batched, ${notFound} no-CIK, ${skipped} no-form4`,
      )
    }
  }

  if (batch.length > 0 && !opts.dryRun) {
    const { error } = await client.from('lv_persons').insert(batch)
    if (error && !error.message.includes('duplicate')) {
      console.error('[persons-sec-edgar] flush err:', error.message)
    } else {
      inserted += batch.length
    }
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { not_found: notFound },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'opencorporates', operation: 'sync', result })
    } catch (e) {
      console.error('[persons-sec-edgar] logSync err:', (e as Error).message)
    }
  }

  return result
}
