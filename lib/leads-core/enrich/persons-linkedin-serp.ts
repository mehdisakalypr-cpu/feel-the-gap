/**
 * LinkedIn SERP dorks persons enrichment
 *
 * Legal rationale: we never visit linkedin.com directly.
 * We submit dork queries to Brave Search (or Serper.dev) and read
 * the public SERP snippets — identical to what a user would see in a browser.
 *
 * Source primaire : Brave Search API (free 2k req/mo)
 *   https://brave.com/search/api/
 *   Auth: BRAVE_API_KEY env
 *
 * Fallback        : Serper.dev (free 2500 req/mo)
 *   https://serper.dev
 *   Auth: SERPER_API_KEY env
 *
 * Si aucune clé n'est présente : skip silencieusement.
 *
 * Strategy:
 *   1. Cursor lv_companies WHERE domain IS NOT NULL ORDER BY id
 *   2. Per company, build SERP dork:
 *        site:linkedin.com/in/ "{legal_name}" ("CEO" OR "CTO" OR "Founder" OR ...)
 *   3. Call Brave or Serper API (1 req/sec throttle)
 *   4. Parse SERP titles: "Name - Role at Company - LinkedIn"
 *   5. Fuzzy-match extracted company vs target (ratio > 0.7) to filter false-positives
 *   6. Insert lv_persons + lv_contacts (linkedin)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, LvContactInsert, ConnectorOptions, SyncResult } from '../types'

const SLEEP_MS = 1100
const BATCH_SIZE = 50

const ROLES_DORK =
  '("CEO" OR "CTO" OR "CFO" OR "COO" OR "Founder" OR "Co-Founder" OR "President" OR "Managing Director" OR "Director" OR "Head of" OR "Owner")'

const SKIP_TITLE_PATTERNS = [
  /sign\s*in/i,
  /connection\s*request/i,
  /^linkedin$/i,
  /linkedin\s*profile/i,
  /join\s*linkedin/i,
  /people\s*also\s*viewed/i,
]

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Levenshtein-based fuzzy match (simple, no deps)
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const la = a.length
  const lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[la][lb]
}

export function fuzzyMatchCompany(extracted: string, target: string): number {
  const a = extracted.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  const b = target.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshtein(a, b)
  return 1 - dist / maxLen
}

// ---------------------------------------------------------------------------
// Extract linkedin slug from URL
// ---------------------------------------------------------------------------
export function slugFromUrl(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// Parse SERP title  "John Doe - CEO at Acme Corp | LinkedIn"
//                   "John Doe – Founder & CEO – Acme Corp – LinkedIn"
//                   "John Doe | CEO at Acme Corp"
// ---------------------------------------------------------------------------
export function parseLinkedInTitle(title: string): { name: string; role: string; company: string } | null {
  if (!title) return null

  // Skip noise titles
  for (const rx of SKIP_TITLE_PATTERNS) {
    if (rx.test(title)) return null
  }

  // Normalise separators to " - "
  const normalised = title
    .replace(/[|–—•]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const parts = normalised.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  // Last part is often "LinkedIn" — drop it
  const cleaned = parts.filter((p) => !/^linkedin$/i.test(p))
  if (cleaned.length < 2) return null

  const name = cleaned[0]

  // Second segment could be "Role at Company" or just "Role"
  const roleCompanyRaw = cleaned[1]
  const atMatch = roleCompanyRaw.match(/^(.+?)\s+(?:at|@|chez|bei|bij)\s+(.+)$/i)

  let role = ''
  let company = ''

  if (atMatch) {
    role = atMatch[1].trim()
    company = atMatch[2].trim()
  } else {
    // Fallback: second = role, third = company (if present)
    role = roleCompanyRaw
    company = cleaned[2] ?? ''
  }

  // name must look like a person (at least 2 words or 1 capitalised word ≥ 2 chars)
  if (!name || name.split(' ').length < 2) return null
  if (!role) return null

  return { name, role, company }
}

// ---------------------------------------------------------------------------
// Build dork query
// ---------------------------------------------------------------------------
function buildDork(legalName: string): string {
  const escaped = legalName.replace(/"/g, '')
  return `site:linkedin.com/in/ "${escaped}" ${ROLES_DORK}`
}

// ---------------------------------------------------------------------------
// Brave Search API
// ---------------------------------------------------------------------------
type BraveWebResult = {
  url: string
  title: string
}

type BraveResponse = {
  web?: {
    results?: BraveWebResult[]
  }
}

async function queryBrave(query: string, apiKey: string): Promise<BraveWebResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`
  const res = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Brave HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as BraveResponse
  return json.web?.results ?? []
}

// ---------------------------------------------------------------------------
// Serper.dev API (fallback)
// ---------------------------------------------------------------------------
type SerperResult = {
  link: string
  title: string
}

type SerperResponse = {
  organic?: SerperResult[]
}

async function querySerper(query: string, apiKey: string): Promise<BraveWebResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 10 }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Serper HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as SerperResponse
  return (json.organic ?? []).map((r) => ({ url: r.link, title: r.title }))
}

// ---------------------------------------------------------------------------
// Main connector
// ---------------------------------------------------------------------------
export async function runPersonsLinkedinSerp(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 5000

  const braveKey = process.env.BRAVE_API_KEY ?? ''
  const serperKey = process.env.SERPER_API_KEY ?? ''

  if (!braveKey && !serperKey) {
    console.warn('[persons-linkedin-serp] No BRAVE_API_KEY or SERPER_API_KEY — skipping')
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      metadata: { skipped_reason: 'no_api_key' },
    }
  }

  const queryFn = braveKey
    ? (q: string) => queryBrave(q, braveKey)
    : (q: string) => querySerper(q, serperKey)

  const apiName = braveKey ? 'brave' : 'serper'

  const client = vaultClient()

  type Row = { id: string; legal_name: string; domain: string | null }

  // Cursor pagination
  let lastId: string | null = null
  const list: Row[] = []
  while (list.length < totalLimit) {
    const remain = Math.min(500, totalLimit - list.length)
    let q = client
      .from('lv_companies')
      .select('id, legal_name, domain')
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

  console.log(`[persons-linkedin-serp] ${list.length} companies to process via ${apiName}`)

  let processed = 0
  let inserted = 0
  let skipped = 0
  const personBatch: LvPersonInsert[] = []
  const contactBatch: LvContactInsert[] = []

  const flushBatches = async () => {
    if (personBatch.length > 0 && !opts.dryRun) {
      const { error } = await client
        .from('lv_persons')
        .upsert(personBatch, { onConflict: 'company_id,linkedin_url', ignoreDuplicates: true })
      if (error && !error.message.includes('duplicate') && !error.message.includes('conflict')) {
        console.error('[persons-linkedin-serp] insert persons err:', error.message)
      }
    }
    inserted += personBatch.length
    personBatch.length = 0

    if (contactBatch.length > 0 && !opts.dryRun) {
      const { error } = await client
        .from('lv_contacts')
        .upsert(contactBatch, { onConflict: 'company_id,contact_value', ignoreDuplicates: true })
      if (error && !error.message.includes('duplicate') && !error.message.includes('conflict')) {
        console.error('[persons-linkedin-serp] insert contacts err:', error.message)
      }
    }
    contactBatch.length = 0
  }

  for (const row of list) {
    processed++
    const dork = buildDork(row.legal_name)

    let results: BraveWebResult[] = []
    try {
      if (!opts.dryRun) {
        results = await queryFn(dork)
        await sleep(SLEEP_MS)
      } else {
        console.log(`[persons-linkedin-serp] [dry-run] dork: ${dork}`)
        await sleep(50)
      }
    } catch (e) {
      console.error(`[persons-linkedin-serp] query error for "${row.legal_name}": ${(e as Error).message}`)
      skipped++
      continue
    }

    let companyHits = 0
    for (const result of results) {
      // Only process linkedin.com/in/ URLs
      if (!result.url.includes('linkedin.com/in/')) continue

      const parsed = parseLinkedInTitle(result.title)
      if (!parsed) { skipped++; continue }

      // Fuzzy match company
      const matchScore = parsed.company
        ? fuzzyMatchCompany(parsed.company, row.legal_name)
        : 0

      // Accept if company field matches (≥0.7), or if company field is empty but role is strong
      const { seniority, score } = classifyRole(parsed.role)
      if (parsed.company && matchScore < 0.7) {
        skipped++
        continue
      }

      const linkedinUrl = result.url.split('?')[0].replace(/\/$/, '')
      if (!slugFromUrl(linkedinUrl)) { skipped++; continue }

      const { first, last } = splitFullName(parsed.name)

      personBatch.push({
        company_id: row.id,
        full_name: parsed.name,
        first_name: first,
        last_name: last,
        role: parsed.role,
        role_seniority: seniority,
        decision_maker_score: score,
        linkedin_url: linkedinUrl,
        primary_source: 'phantombuster',
      })

      contactBatch.push({
        company_id: row.id,
        contact_type: 'linkedin',
        contact_value: linkedinUrl,
        verify_status: 'unverified',
        primary_source: 'phantombuster',
      })

      companyHits++
    }

    if (companyHits === 0 && results.length > 0) {
      // Results but all filtered out
      skipped++
    }

    if (personBatch.length >= BATCH_SIZE) {
      await flushBatches()
    }

    if (processed % 50 === 0) {
      console.log(
        `[persons-linkedin-serp] ${processed}/${list.length} companies processed, ${inserted} persons inserted so far`,
      )
    }
  }

  await flushBatches()

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { api: apiName },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'phantombuster', operation: 'sync', result })
    } catch (e) {
      console.error('[persons-linkedin-serp] logSync err:', (e as Error).message)
    }
  }

  return result
}
