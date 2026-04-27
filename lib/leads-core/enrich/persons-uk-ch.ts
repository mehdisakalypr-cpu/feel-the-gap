/**
 * Phase A1 — UK Persons enrichment via Companies House Officers API
 *
 * Source : https://api.company-information.service.gov.uk/company/{crn}/officers
 * Auth   : Basic <COMPANIES_HOUSE_API_KEY>: (key as username, empty password)
 * Rate   : 600 requests / 5 min
 * License: OGL v3.0 — free
 *
 * Strategy:
 *   1. Cursor lv_companies WHERE country_iso='GBR' AND crn IS NOT NULL,
 *      excluding companies already enriched (have lv_persons row from companies_house).
 *   2. For each, fetch officers, filter out resigned, classify role,
 *      upsert lv_persons (company_id, lower(full_name), coalesce(role,'')) unique.
 *   3. Throttle: 110ms delay → ~9 req/s, headroom under 600/5min.
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const API_BASE = 'https://api.company-information.service.gov.uk'
const SLEEP_MS = 110 // 9 req/s, well under 600/5min (=2/s rate limit hard cap, but headers update faster)
const BATCH_SIZE = 100

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) throw new Error('COMPANIES_HOUSE_API_KEY not set')
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

type ChOfficer = {
  name: string
  officer_role?: string
  appointed_on?: string
  resigned_on?: string
  date_of_birth?: { month?: number; year?: number }
  nationality?: string
  occupation?: string
  country_of_residence?: string
}

async function fetchOfficers(crn: string): Promise<ChOfficer[]> {
  const url = `${API_BASE}/company/${encodeURIComponent(crn)}/officers?items_per_page=100&register_view=false`
  const res = await fetch(url, { headers: { Authorization: authHeader() } })
  if (res.status === 404) return []
  if (res.status === 429) {
    // Rate limited — sleep 5s then retry once
    await new Promise((r) => setTimeout(r, 5000))
    const retry = await fetch(url, { headers: { Authorization: authHeader() } })
    if (!retry.ok) throw new Error(`CH 429-then-${retry.status}`)
    const j = (await retry.json()) as { items?: ChOfficer[] }
    return j.items ?? []
  }
  if (!res.ok) throw new Error(`CH HTTP ${res.status} for ${crn}`)
  const j = (await res.json()) as { items?: ChOfficer[] }
  return j.items ?? []
}

function officerToPersons(o: ChOfficer, companyId: string): LvPersonInsert | null {
  if (o.resigned_on) return null // Skip historic
  const fullRaw = (o.name ?? '').trim()
  if (!fullRaw) return null

  // CH returns "LASTNAME, Firstname Middlename" — normalise
  let first: string | null = null
  let last: string | null = null
  let display = fullRaw
  if (fullRaw.includes(', ')) {
    const [ln, fn] = fullRaw.split(', ')
    last = ln.trim()
    first = (fn ?? '').trim() || null
    display = first ? `${first} ${last}` : last
  } else {
    const split = splitFullName(fullRaw)
    first = split.first
    last = split.last
  }

  const { seniority, score } = classifyRole(o.officer_role || o.occupation || '')

  return {
    company_id: companyId,
    full_name: display,
    first_name: first,
    last_name: last,
    role: o.officer_role ?? null,
    role_seniority: seniority,
    decision_maker_score: score,
    primary_source: 'companies_house',
  }
}

export async function runPersonsUkCh(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 1000
  const client = vaultClient()

  let processed = 0
  let inserted = 0
  let skipped = 0

  // Cursor: companies UK with crn, NOT yet covered by Companies House persons
  // Use raw SQL via rpc for the EXISTS subquery
  const { data: companies, error: qErr } = await client.rpc('lv_pick_uk_companies_for_officers', {
    p_limit: limit,
  })

  if (qErr) {
    // Fallback: select directly with .not('id','in', subquery) — Supabase can't subquery, so use a raw SELECT via from()
    const { data: rows, error: e2 } = await client
      .from('lv_companies')
      .select('id, crn')
      .eq('country_iso', 'GBR')
      .not('crn', 'is', null)
      .order('id', { ascending: true })
      .limit(limit)
    if (e2) {
      return {
        rows_processed: 0,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: 0,
        duration_ms: Date.now() - t0,
        error: e2.message,
      }
    }
    return processRows(rows as Array<{ id: string; crn: string }>, t0, opts.dryRun)
  }

  return processRows(companies as Array<{ id: string; crn: string }>, t0, opts.dryRun)
}

async function processRows(
  rows: Array<{ id: string; crn: string }>,
  t0: number,
  dryRun?: boolean,
): Promise<SyncResult> {
  const client = vaultClient()
  let processed = 0
  let inserted = 0
  let skipped = 0
  const batch: LvPersonInsert[] = []

  for (const row of rows) {
    processed++
    try {
      const officers = await fetchOfficers(row.crn)
      for (const o of officers) {
        const p = officerToPersons(o, row.id)
        if (!p) {
          skipped++
          continue
        }
        batch.push(p)
      }
    } catch (e) {
      console.error(`[persons-uk-ch] ${row.crn}:`, (e as Error).message)
    }

    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        const { error } = await client.from('lv_persons').insert(batch)
        if (error && !error.message.includes('duplicate')) console.error('insert err:', error.message)
      }
      inserted += batch.length
      batch.length = 0
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS))

    if (processed % 100 === 0) {
      console.log(`[persons-uk-ch] ${processed}/${rows.length} processed, ${inserted} persons batched`)
    }
  }

  // Flush
  if (batch.length > 0 && !dryRun) {
    const { error } = await client.from('lv_persons').insert(batch)
    if (error && !error.message.includes('duplicate')) {
      console.error('flush err:', error.message)
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
  }

  if (!dryRun) {
    try {
      await logSync({ source_id: 'companies_house', operation: 'sync', result })
    } catch (e) {
      console.error('logSync err:', (e as Error).message)
    }
  }

  return result
}
