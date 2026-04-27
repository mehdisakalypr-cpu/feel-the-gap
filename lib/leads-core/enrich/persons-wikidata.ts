/**
 * Wikidata SPARQL persons enrichment
 *
 * Source : https://query.wikidata.org/sparql
 * Auth   : none (User-Agent required per Wikimedia ToU)
 * Rate   : 1 query / 2s conservative, 100 domains per batch
 * License: CC0 — public domain
 *
 * Strategy:
 *   1. Cursor lv_companies WHERE domain IS NOT NULL ORDER BY id
 *   2. Batch 50 domains into a SPARQL VALUES block
 *   3. Query CEO/Chair/Board members + LinkedIn URLs from Wikidata
 *   4. Normalize roles to role_seniority enum
 *   5. Insert lv_persons + lv_contacts (LinkedIn)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { splitFullName } from './role-classifier'
import type { LvPersonInsert, LvContactInsert, ConnectorOptions, SyncResult } from '../types'

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const WIKIDATA_BATCH = 20
const SLEEP_MS = 5000
const BATCH_SIZE = 100
const MAX_RETRY = 2
const UA = 'feel-the-gap-leadsvault/1.0 (https://gapup.io; mehdi.sakalypr@gmail.com)'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type WikidataBinding = {
  company?: { value: string }
  companyLabel?: { value: string }
  targetDomain?: { value: string }
  person?: { value: string }
  personLabel?: { value: string }
  roleLabel?: { value: string }
  startDate?: { value: string }
  linkedin?: { value: string }
}

type WikidataResult = {
  results?: {
    bindings?: WikidataBinding[]
  }
}

function buildSparql(domains: string[]): string {
  // Use ?targetDomain as VALUES var to avoid conflict with ?domain BIND
  const valuesBlock = domains.map((d) => `"${d.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` ).join(' ')
  return `
SELECT DISTINCT ?company ?companyLabel ?targetDomain ?person ?personLabel ?roleLabel ?linkedin WHERE {
  VALUES ?targetDomain { ${valuesBlock} }
  ?company <http://www.wikidata.org/prop/direct/P856> ?websiteUrl .
  BIND(REPLACE(REPLACE(STR(?websiteUrl), "^https?://(www[.])?", ""), "/.*$", "") AS ?extractedDomain)
  FILTER(LCASE(?extractedDomain) = ?targetDomain)

  {
    ?company <http://www.wikidata.org/prop/P169> ?stmt .
    ?stmt <http://www.wikidata.org/prop/statement/P169> ?person .
    BIND("CEO" AS ?roleLabel)
  } UNION {
    ?company <http://www.wikidata.org/prop/P488> ?stmt .
    ?stmt <http://www.wikidata.org/prop/statement/P488> ?person .
    BIND("Chair" AS ?roleLabel)
  } UNION {
    ?company <http://www.wikidata.org/prop/P3320> ?stmt .
    ?stmt <http://www.wikidata.org/prop/statement/P3320> ?person .
    BIND("Board member" AS ?roleLabel)
  } UNION {
    ?company <http://www.wikidata.org/prop/P1037> ?stmt .
    ?stmt <http://www.wikidata.org/prop/statement/P1037> ?person .
    BIND("Director/Manager" AS ?roleLabel)
  }

  OPTIONAL { ?person <http://www.wikidata.org/prop/direct/P6634> ?linkedin }
  SERVICE <http://wikiba.se/ontology#label> { <http://www.bigdata.com/rdf#serviceParam> <http://wikiba.se/ontology#language> "en". }
}
LIMIT 500
`
}

type RoleSeniority = 'c-level' | 'vp' | 'director' | 'manager' | 'individual'

function normalizeWikidataRole(roleLabel: string): { seniority: RoleSeniority; score: number } {
  const r = roleLabel.toLowerCase()
  if (r === 'ceo') return { seniority: 'c-level', score: 95 }
  if (r === 'chair') return { seniority: 'c-level', score: 90 }
  if (r === 'board member') return { seniority: 'director', score: 65 }
  if (r === 'director/manager') return { seniority: 'director', score: 65 }
  return { seniority: 'individual', score: 15 }
}

async function querySparql(domains: string[], attempt = 0): Promise<WikidataBinding[]> {
  const query = buildSparql(domains)
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(60_000),
    })
    if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429) {
      if (attempt < MAX_RETRY) {
        const backoff = 15000 * (attempt + 1)
        console.warn(`[persons-wikidata] HTTP ${res.status}, retry ${attempt + 1}/${MAX_RETRY} after ${backoff}ms`)
        await sleep(backoff)
        return querySparql(domains, attempt + 1)
      }
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[persons-wikidata] SPARQL HTTP ${res.status}: ${errBody.slice(0, 200)}`)
      return []
    }
    const json = (await res.json()) as WikidataResult
    return json.results?.bindings ?? []
  } catch (e) {
    const msg = (e as Error).message
    if (attempt < MAX_RETRY && (msg.includes('aborted') || msg.includes('timeout') || msg.includes('fetch failed'))) {
      const backoff = 15000 * (attempt + 1)
      console.warn(`[persons-wikidata] ${msg}, retry ${attempt + 1}/${MAX_RETRY} after ${backoff}ms`)
      await sleep(backoff)
      return querySparql(domains, attempt + 1)
    }
    console.error(`[persons-wikidata] giving up: ${msg}`)
    return []
  }
}

export async function runPersonsWikidata(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 5000
  const client = vaultClient()

  type Row = { id: string; domain: string }

  // Cursor pagination by id
  let lastId: string | null = null
  const list: Row[] = []
  while (list.length < totalLimit) {
    const remain = Math.min(1000, totalLimit - list.length)
    let q = client
      .from('lv_companies')
      .select('id, domain')
      .not('domain', 'is', null)
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

  // Build domain→companyId map
  const domainToId: Map<string, string> = new Map()
  for (const row of list) {
    const d = row.domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase()
      .trim()
    if (d) domainToId.set(d, row.id)
  }

  const domains = Array.from(domainToId.keys())

  let processed = 0
  let inserted = 0
  let skipped = 0
  const personBatch: LvPersonInsert[] = []
  const contactBatch: LvContactInsert[] = []

  const flushBatches = async () => {
    if (personBatch.length > 0 && !opts.dryRun) {
      const { error } = await client.from('lv_persons').insert(personBatch)
      if (error && !error.message.includes('duplicate')) console.error('[persons-wikidata] insert persons err:', error.message)
    }
    inserted += personBatch.length
    personBatch.length = 0

    if (contactBatch.length > 0 && !opts.dryRun) {
      const { error } = await client.from('lv_contacts').insert(contactBatch)
      if (error && !error.message.includes('duplicate')) console.error('[persons-wikidata] insert contacts err:', error.message)
    }
    contactBatch.length = 0
  }

  // Process in batches of WIKIDATA_BATCH domains
  for (let i = 0; i < domains.length; i += WIKIDATA_BATCH) {
    const batch = domains.slice(i, i + WIKIDATA_BATCH)
    processed += batch.length

    try {
      const bindings = await querySparql(batch)
      await sleep(SLEEP_MS)

      for (const b of bindings) {
        const domain = b.targetDomain?.value
        if (!domain) continue
        const companyId = domainToId.get(domain)
        if (!companyId) continue

        const personLabel = b.personLabel?.value?.trim()
        if (!personLabel) { skipped++; continue }

        // Skip Wikidata internal IDs (Q-numbers) that weren't resolved to labels
        if (/^Q\d+$/.test(personLabel)) { skipped++; continue }

        const roleLabel = b.roleLabel?.value ?? 'Director'
        const { seniority, score } = normalizeWikidataRole(roleLabel)
        const { first, last } = splitFullName(personLabel)
        const linkedinUrl = b.linkedin?.value?.trim() || null

        personBatch.push({
          company_id: companyId,
          full_name: personLabel,
          first_name: first,
          last_name: last,
          role: roleLabel,
          role_seniority: seniority,
          decision_maker_score: score,
          linkedin_url: linkedinUrl || undefined,
          primary_source: 'opencorporates',
        })

        if (linkedinUrl) {
          contactBatch.push({
            company_id: companyId,
            contact_type: 'linkedin',
            contact_value: linkedinUrl,
            verify_status: 'unverified',
            primary_source: 'opencorporates',
          })
        }
      }
    } catch (e) {
      console.error(`[persons-wikidata] batch ${i}-${i + WIKIDATA_BATCH}:`, (e as Error).message)
    }

    if (personBatch.length >= BATCH_SIZE) {
      await flushBatches()
    }

    if ((i / WIKIDATA_BATCH) % 10 === 0) {
      console.log(`[persons-wikidata] ${processed}/${domains.length} domains processed, ${inserted} persons inserted`)
    }
  }

  await flushBatches()

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'opencorporates', operation: 'sync', result })
    } catch (e) {
      console.error('[persons-wikidata] logSync err:', (e as Error).message)
    }
  }

  return result
}
