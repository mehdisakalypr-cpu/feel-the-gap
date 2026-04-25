/**
 * Common Crawl connector v2 — INDUSTRIAL-GRADE
 *
 * License: CC-BY 4.0 free for commercial use with attribution.
 * Volume potential : 50-100M EU domains per crawl. Post-filter
 * (has-contact + business-shaped) ~10-20M usable leads.
 *
 * v2 highlights vs v1:
 *  - p-limit worker pool (default 30 concurrent WARC fetches)
 *  - Global politeness limiter (10 req/s on data.commoncrawl.org)
 *  - Retry + exponential backoff on 5xx / 429 / network errors
 *  - CDX paging via &showNumPages=true (no 5000 cap per TLD)
 *  - 25+ EU TLD patterns + sub-patterns (*.com.fr, *.org.fr, *.eu)
 *  - Cross-run resume via gapup_leads.cc_progress checkpoint table
 *  - Pre-load existing domains into Set for O(1) skip-if-known
 *  - Streaming insert pipeline (chunked upsert, no all-in-memory)
 *  - Heartbeat every 5 min · disk-free + consecutive-error guards
 *  - Stop conditions: limit reached, errors > 100 consecutive, disk < 5GB
 *
 * Designed to run overnight, ingesting millions of rows autonomously.
 */

import { gunzipSync } from 'zlib'
import { randomUUID } from 'crypto'
import { statfsSync } from 'fs'
import pLimit from 'p-limit'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

// ── Configuration ───────────────────────────────────────────────────────
const DEFAULT_CRAWL = 'CC-MAIN-2026-12'
const CDX_BASE = 'https://index.commoncrawl.org'
const WARC_BASE = 'https://data.commoncrawl.org'

const TLD_TO_ISO3: Record<string, string> = {
  fr: 'FRA', de: 'DEU', es: 'ESP', it: 'ITA', uk: 'GBR', gb: 'GBR',
  nl: 'NLD', be: 'BEL', pl: 'POL', se: 'SWE', dk: 'DNK',
  no: 'NOR', fi: 'FIN', at: 'AUT', ch: 'CHE', pt: 'PRT',
  cz: 'CZE', ie: 'IRL', gr: 'GRC', ro: 'ROU', hu: 'HUN',
  bg: 'BGR', sk: 'SVK', ee: 'EST', lv: 'LVA', lt: 'LTU',
  si: 'SVN', hr: 'HRV', cy: 'CYP', mt: 'MLT', lu: 'LUX',
  is: 'ISL', li: 'LIE', mc: 'MCO', va: 'VAT', ad: 'AND',
  sm: 'SMR', eu: 'EUR',
}

// Default URL PATTERNS (not just TLDs) — the v2 unit of work.
// Each pattern is a CDX query. Sub-domain patterns multiply usable hits.
const DEFAULT_PATTERNS: string[] = [
  // Big 5
  '*.fr', '*.com.fr', '*.org.fr',
  '*.de', '*.com.de',
  '*.es', '*.com.es',
  '*.it', '*.com.it',
  '*.uk', '*.co.uk', '*.org.uk',
  // Western Europe
  '*.nl', '*.be', '*.pl', '*.se', '*.dk', '*.no', '*.fi',
  '*.at', '*.ch', '*.pt', '*.lu', '*.ie',
  // Central / Eastern
  '*.cz', '*.gr', '*.ro', '*.hu', '*.bg', '*.sk',
  '*.ee', '*.lv', '*.lt', '*.si', '*.hr',
  // Micro states
  '*.cy', '*.mt', '*.is', '*.li', '*.mc', '*.va', '*.ad', '*.sm',
  // Pan-EU
  '*.eu',
]

const UA = 'gapup-leads-vault/2.0 (research; mehdi.sakalypr@gmail.com)'

// Tunables (also overridable via opts)
const DEFAULT_CONCURRENCY = 30
const DEFAULT_MAX_PER_TLD = 100_000
const POLITENESS_RPS = 10               // global cap on data.commoncrawl.org
const HEARTBEAT_INTERVAL_MS = 5 * 60_000
const PROGRESS_FLUSH_EVERY = 100        // rows
const UPSERT_BATCH_SIZE = 50
const CONSECUTIVE_ERR_LIMIT = 100
const MIN_DISK_FREE_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB
const CDX_PAGE_TIMEOUT_MS = 60_000
const WARC_FETCH_TIMEOUT_MS = 30_000

// ── Types ───────────────────────────────────────────────────────────────
type CdxEntry = {
  url: string
  timestamp: string
  length: string
  offset: string
  filename: string
  status: string
  mime: string
  digest: string
}

type ExtractedInfo = {
  title: string | null
  description: string | null
  org_name: string | null
  emails: string[]
  phones: string[]
  language: string | null
}

type V2Options = ConnectorOptions & {
  tlds?: string[]
  patterns?: string[]
  crawl?: string
  concurrency?: number
  maxPerTld?: number
  resumeFromLastRun?: boolean
}

// ── Small utils ─────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function tldFromPattern(pattern: string): string {
  // "*.com.fr" -> "fr" ; "*.uk" -> "uk"
  const parts = pattern.replace(/^\*\./, '').split('.')
  return parts[parts.length - 1] ?? 'xx'
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

function diskFreeBytes(path = '/'): number {
  try {
    const s = statfsSync(path)
    return Number(s.bavail) * Number(s.bsize)
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

// ── Politeness rate limiter (global, token-bucket flavour) ──────────────
class RateLimiter {
  private queue: Array<() => void> = []
  private interval: number
  private timer: NodeJS.Timeout | null = null
  constructor(rps: number) {
    this.interval = Math.max(1, Math.floor(1000 / rps))
  }
  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      const fn = this.queue.shift()
      if (fn) fn()
    }, this.interval)
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve)
    })
  }
}

// ── Retrying fetch ──────────────────────────────────────────────────────
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { retries: number; timeoutMs: number; rl?: RateLimiter; tag?: string },
): Promise<Response | null> {
  const backoffs = [5_000, 15_000, 45_000]
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (opts.rl) await opts.rl.acquire()
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ac.signal })
      clearTimeout(timer)
      if (res.ok) return res
      // 429 — too many requests : long wait + retry
      if (res.status === 429) {
        await sleep(60_000)
        continue
      }
      // 5xx — retry with backoff
      if (res.status >= 500 && res.status < 600) {
        if (attempt === opts.retries) return null
        await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
        continue
      }
      // 4xx (other) — give up immediately
      return null
    } catch (e: any) {
      clearTimeout(timer)
      lastErr = e
      if (attempt === opts.retries) return null
      await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
    }
  }
  if (lastErr && process.env.LEADS_VAULT_DEBUG === '1') {
    console.warn(`[common-crawl] ${opts.tag ?? 'fetch'} gave up:`, lastErr.message)
  }
  return null
}

// ── CDX paging ──────────────────────────────────────────────────────────
async function cdxNumPages(crawl: string, urlPattern: string, rl: RateLimiter): Promise<number> {
  const u = `${CDX_BASE}/${crawl}-index?url=${encodeURIComponent(urlPattern)}&showNumPages=true`
  const res = await fetchWithRetry(u, { headers: { 'User-Agent': UA } }, {
    retries: 3, timeoutMs: CDX_PAGE_TIMEOUT_MS, rl, tag: `cdx-pages ${urlPattern}`,
  })
  if (!res) return 0
  const txt = (await res.text()).trim()
  // server may answer plain integer OR JSON {"pages": N}
  const asInt = parseInt(txt, 10)
  if (Number.isFinite(asInt) && asInt > 0) return asInt
  try {
    const obj = JSON.parse(txt)
    return Number(obj?.pages ?? obj?.numPages ?? 0)
  } catch {
    return 0
  }
}

async function* cdxStreamEntries(
  crawl: string,
  urlPattern: string,
  rl: RateLimiter,
  opts: { startPage?: number; maxEntries?: number },
): AsyncGenerator<CdxEntry, void, unknown> {
  const numPages = await cdxNumPages(crawl, urlPattern, rl)
  const total = numPages > 0 ? numPages : 1
  const startPage = opts.startPage ?? 0
  const cap = opts.maxEntries ?? Number.POSITIVE_INFINITY
  let yielded = 0

  for (let page = startPage; page < total; page++) {
    if (yielded >= cap) return
    const u = `${CDX_BASE}/${crawl}-index?url=${encodeURIComponent(urlPattern)}&output=json&page=${page}&filter=status:200&filter=mime:text/html`
    const res = await fetchWithRetry(u, { headers: { 'User-Agent': UA } }, {
      retries: 3, timeoutMs: CDX_PAGE_TIMEOUT_MS, rl, tag: `cdx-page ${urlPattern}/${page}`,
    })
    if (!res) continue
    const text = await res.text()
    for (const line of text.split('\n')) {
      if (!line) continue
      try {
        yield JSON.parse(line) as CdxEntry
        yielded++
        if (yielded >= cap) return
      } catch {
        // skip malformed
      }
    }
  }
}

// ── WARC byte-range fetch ───────────────────────────────────────────────
async function fetchWarcSlice(entry: CdxEntry, rl: RateLimiter): Promise<string | null> {
  const url = `${WARC_BASE}/${entry.filename}`
  const offset = parseInt(entry.offset, 10)
  const length = parseInt(entry.length, 10)
  if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0 || length > 5_000_000) {
    return null
  }
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': UA, Range: `bytes=${offset}-${offset + length - 1}` },
  }, { retries: 2, timeoutMs: WARC_FETCH_TIMEOUT_MS, rl, tag: `warc ${entry.url}` })
  if (!res) return null

  let buf: Buffer
  try {
    buf = Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }

  let unzipped: Buffer
  try {
    unzipped = gunzipSync(buf)
  } catch {
    return null
  }
  // free original
  ;(buf as unknown) = null

  const text = unzipped.toString('utf8')
  ;(unzipped as unknown) = null
  const a = text.indexOf('<!DOCTYPE')
  const b = text.indexOf('<html')
  const start = a >= 0 ? a : (b >= 0 ? b : -1)
  if (start < 0) return null
  // Cap to first 200 KB to avoid mega-pages eating heap
  return text.slice(start, start + 200_000)
}

// ── HTML extraction (same regexes as v1, slightly hardened) ─────────────
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i
const META_DESC_RE = /<meta\s+(?:name|property)=["']description["']\s+content=["']([^"']{1,300})["']/i
const LANG_RE = /<html[^>]*\blang=["']([a-z]{2,5})["']/i
const JSONLD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
}

function extractInfo(html: string): ExtractedInfo {
  const title = TITLE_RE.exec(html)?.[1]?.trim().slice(0, 200) ?? null
  const description = META_DESC_RE.exec(html)?.[1]?.trim().slice(0, 500) ?? null
  const language = LANG_RE.exec(html)?.[1]?.toLowerCase().slice(0, 5) ?? null

  let org_name: string | null = null
  for (const m of html.matchAll(JSONLD_RE)) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ?? [parsed])
      for (const it of items) {
        const t = it['@type']
        const types = Array.isArray(t) ? t : [t]
        if (types.some((x: string) => /^(Organization|LocalBusiness|Corporation|Restaurant|Store)$/i.test(x))) {
          org_name = (it.name ?? it.legalName ?? null)?.toString().slice(0, 200) ?? null
          if (org_name) break
        }
      }
      if (org_name) break
    } catch {
      // skip malformed JSON-LD
    }
  }

  const emails: string[] = []
  const seenEmails = new Set<string>()
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase()
    if (e.endsWith('.png') || e.endsWith('.jpg') || e.endsWith('.gif') || e.endsWith('.webp')) continue
    if (seenEmails.has(e)) continue
    seenEmails.add(e)
    emails.push(e)
    if (emails.length >= 3) break
  }

  const phones: string[] = []
  const seenPhones = new Set<string>()
  for (const m of html.matchAll(PHONE_RE)) {
    const p = m[0].replace(/[\s.()-]/g, '')
    if (p.length < 9 || p.length > 16) continue
    if (seenPhones.has(p)) continue
    seenPhones.add(p)
    phones.push(p)
    if (phones.length >= 3) break
  }

  return { title: title ? decodeEntities(title) : null, description, org_name, emails, phones, language }
}

// ── Existing-domain cache (so we don't re-process forever) ──────────────
async function loadExistingDomainsByCountry(sb: any, iso3: string): Promise<Set<string>> {
  // Only "primary_source = common_crawl" rows in this country.
  // 50k cap per country to stay bounded; more recent wins on conflict anyway.
  const seen = new Set<string>()
  try {
    const { data } = await sb.from('lv_companies')
      .select('domain')
      .eq('country_iso', iso3)
      .eq('primary_source', 'common_crawl')
      .not('domain', 'is', null)
      .limit(50_000)
    for (const r of (data ?? []) as Array<{ domain: string | null }>) {
      if (r.domain) seen.add(r.domain.toLowerCase())
    }
  } catch {
    // best-effort — fall through
  }
  return seen
}

// ── Progress checkpointing ──────────────────────────────────────────────
type Checkpoint = {
  id: string
  pattern: string
  tld: string
  domains_seen: number
  rows_inserted: number
  rows_skipped: number
  errors_count: number
  rate_limited_count: number
  last_url: string | null
}

async function loadLastCheckpointPage(sb: any, crawl: string, pattern: string): Promise<{ startPage: number }> {
  try {
    const { data } = await sb.from('cc_progress')
      .select('metadata')
      .eq('crawl', crawl)
      .eq('url_pattern', pattern)
      .in('status', ['finished', 'aborted'])
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(1)
    const row = (data ?? [])[0] as { metadata?: { next_page?: number } } | undefined
    return { startPage: Number(row?.metadata?.next_page ?? 0) }
  } catch {
    return { startPage: 0 }
  }
}

async function insertCheckpoint(sb: any, runId: string, crawl: string, pattern: string, tld: string): Promise<string> {
  const id = randomUUID()
  await (sb.from as any)('cc_progress').insert({
    id, run_id: runId, crawl, tld, url_pattern: pattern, status: 'running',
  })
  return id
}

async function flushCheckpoint(sb: any, cp: Checkpoint): Promise<void> {
  await (sb.from as any)('cc_progress').update({
    domains_seen: cp.domains_seen,
    rows_inserted: cp.rows_inserted,
    rows_skipped: cp.rows_skipped,
    errors_count: cp.errors_count,
    rate_limited_count: cp.rate_limited_count,
    last_url: cp.last_url,
    heartbeat_at: new Date().toISOString(),
  }).eq('id', cp.id)
}

async function finishCheckpoint(sb: any, cp: Checkpoint, status: 'finished' | 'aborted' | 'error', meta: Record<string, unknown> = {}): Promise<void> {
  await (sb.from as any)('cc_progress').update({
    status,
    domains_seen: cp.domains_seen,
    rows_inserted: cp.rows_inserted,
    rows_skipped: cp.rows_skipped,
    errors_count: cp.errors_count,
    rate_limited_count: cp.rate_limited_count,
    last_url: cp.last_url,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
    metadata: meta,
  }).eq('id', cp.id)
}

// ── Streaming insert pipeline ───────────────────────────────────────────
type PendingRow = {
  company: LvCompanyInsert
  contacts: Array<{ source_id: string; contact_type: 'email' | 'phone'; contact_value: string }>
}

async function flushBatch(sb: any, rows: PendingRow[]): Promise<{ inserted: number; errors: number }> {
  if (rows.length === 0) return { inserted: 0, errors: 0 }
  const companies = rows.map((r) => r.company)
  const { error } = await (sb.from as any)('lv_companies')
    .upsert(companies, { onConflict: 'domain', ignoreDuplicates: false })
  if (error) {
    if (process.env.LEADS_VAULT_DEBUG === '1') {
      console.error('[common-crawl] batch upsert failed:', error.message)
    }
    return { inserted: 0, errors: rows.length }
  }
  // Now resolve company ids and bulk-upsert contacts
  const domains = companies.map((c) => c.domain).filter(Boolean) as string[]
  if (domains.length > 0) {
    const { data: lookup } = await (sb.from as any)('lv_companies')
      .select('id, domain')
      .in('domain', domains)
    const idByDomain = new Map<string, string>()
    for (const r of (lookup ?? []) as Array<{ id: string; domain: string }>) {
      idByDomain.set(r.domain, r.id)
    }
    const allContacts: any[] = []
    for (const row of rows) {
      const dom = row.company.domain
      if (!dom) continue
      const cid = idByDomain.get(dom)
      if (!cid) continue
      for (const c of row.contacts) {
        allContacts.push({
          company_id: cid,
          primary_source: 'common_crawl',
          source_id: c.source_id,
          contact_type: c.contact_type,
          contact_value: c.contact_value,
          verify_status: 'unverified',
        })
      }
    }
    if (allContacts.length > 0) {
      await (sb.from as any)('lv_contacts')
        .upsert(allContacts, { onConflict: 'source_id', ignoreDuplicates: true })
    }
  }
  return { inserted: rows.length, errors: 0 }
}

// ── Main entry ──────────────────────────────────────────────────────────
export async function runCommonCrawlIngestV2(opts: V2Options = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { tlds: [] as string[], patterns: [] as string[], domains_seen: 0, with_contact: 0, errors: 0, rate_limited: 0 },
  }

  const crawl = opts.crawl ?? DEFAULT_CRAWL
  // Resolve patterns: explicit > derived from tlds > defaults
  const patterns: string[] = opts.patterns
    ?? (opts.tlds ? opts.tlds.flatMap((t) => [`*.${t}`]) : DEFAULT_PATTERNS)
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY)
  const maxPerTld = Math.max(100, opts.maxPerTld ?? DEFAULT_MAX_PER_TLD)
  const targetTotal = opts.limit ?? Number.POSITIVE_INFINITY
  const resume = opts.resumeFromLastRun ?? true

  const sb = vaultClient()
  const sourceId = 'common_crawl' as const
  const runId = randomUUID()

  const rl = new RateLimiter(POLITENESS_RPS)
  rl.start()
  const limit = pLimit(concurrency)

  // Per-process seen-host dedupe (cross-pattern)
  const seenHosts = new Set<string>()
  let consecutiveErrors = 0
  let lastHeartbeat = Date.now()
  let aborted = false
  let abortReason = ''

  try {
    for (const pattern of patterns) {
      if (aborted) break
      if (result.rows_processed >= targetTotal) break

      const tld = tldFromPattern(pattern)
      const iso3 = TLD_TO_ISO3[tld] ?? 'XXX'
      ;(result.metadata!.patterns as string[]).push(pattern)
      if (!(result.metadata!.tlds as string[]).includes(tld)) {
        ;(result.metadata!.tlds as string[]).push(tld)
      }

      // Pre-load known domains (cheap dedupe vs DB)
      const known = await loadExistingDomainsByCountry(sb, iso3)
      // Resume page
      const { startPage } = resume
        ? await loadLastCheckpointPage(sb, crawl, pattern)
        : { startPage: 0 }

      // Open progress row
      const cpId = await insertCheckpoint(sb, runId, crawl, pattern, tld)
      const cp: Checkpoint = {
        id: cpId, pattern, tld,
        domains_seen: 0, rows_inserted: 0, rows_skipped: 0,
        errors_count: 0, rate_limited_count: 0, last_url: null,
      }

      let processedThisPattern = 0
      let pendingBatch: PendingRow[] = []
      let lastPage = startPage

      const processEntry = async (entry: CdxEntry) => {
        const host = hostFromUrl(entry.url)
        if (!host) return
        if (seenHosts.has(host) || known.has(host)) {
          return
        }
        seenHosts.add(host)
        cp.domains_seen++
        result.rows_processed++
        ;(result.metadata!.domains_seen as number)++

        let html: string | null = null
        try {
          html = await fetchWarcSlice(entry, rl)
        } catch {
          html = null
        }
        if (!html) {
          cp.rows_skipped++
          result.rows_skipped++
          consecutiveErrors++
          return
        }

        const info = extractInfo(html)
        // free html ASAP
        html = null
        const hasContact = info.emails.length > 0 || info.phones.length > 0
        if (!hasContact && !info.org_name) {
          cp.rows_skipped++
          result.rows_skipped++
          return
        }
        ;(result.metadata!.with_contact as number)++

        const company: LvCompanyInsert = {
          primary_source: sourceId,
          source_ids: { common_crawl: host },
          legal_name: info.org_name ?? info.title ?? host,
          trade_name: info.title ?? null,
          domain: host,
          country_iso: iso3,
          nace_code: null,
          sic_code: null,
          industry_tags: info.description ? [info.description.slice(0, 100)] : undefined,
          is_import_export: false,
          size_bucket: undefined,
        }
        const contacts: PendingRow['contacts'] = []
        for (const email of info.emails) {
          contacts.push({ source_id: `${host}#${email}`, contact_type: 'email', contact_value: email })
        }
        for (const phone of info.phones) {
          contacts.push({ source_id: `${host}#${phone}`, contact_type: 'phone', contact_value: phone })
        }
        pendingBatch.push({ company, contacts })
        cp.last_url = entry.url
        consecutiveErrors = 0
      }

      // Drive the CDX stream + worker pool
      const inflight: Array<Promise<void>> = []
      try {
        for await (const entry of cdxStreamEntries(crawl, pattern, rl, {
          startPage, maxEntries: maxPerTld,
        })) {
          if (aborted) break
          if (processedThisPattern >= maxPerTld) break
          if (result.rows_processed >= targetTotal) break

          processedThisPattern++
          inflight.push(limit(() => processEntry(entry)))

          // Flush pending upserts in batches of UPSERT_BATCH_SIZE
          if (pendingBatch.length >= UPSERT_BATCH_SIZE) {
            const batch = pendingBatch
            pendingBatch = []
            const r = await flushBatch(sb, batch)
            cp.rows_inserted += r.inserted
            result.rows_inserted += r.inserted
            cp.errors_count += r.errors
            ;(result.metadata!.errors as number) += r.errors
            if (r.errors > 0) consecutiveErrors += r.errors

            // Heartbeat / progress flush
            if (cp.rows_inserted % PROGRESS_FLUSH_EVERY < UPSERT_BATCH_SIZE) {
              await flushCheckpoint(sb, cp)
            }
          }

          // Periodic guard checks (every ~1k entries)
          if (processedThisPattern % 1000 === 0) {
            // Heartbeat log
            if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
              lastHeartbeat = Date.now()
              console.log(`[common-crawl] heartbeat · processed=${result.rows_processed} inserted=${result.rows_inserted} errors=${result.metadata!.errors} pattern=${pattern}`)
              await flushCheckpoint(sb, cp)
            }
            // Disk free guard
            if (diskFreeBytes('/') < MIN_DISK_FREE_BYTES) {
              aborted = true
              abortReason = 'disk_low'
              break
            }
            // Consecutive error guard
            if (consecutiveErrors > CONSECUTIVE_ERR_LIMIT) {
              aborted = true
              abortReason = 'too_many_errors'
              break
            }
          }
        }
      } catch (e: any) {
        cp.errors_count++
        ;(result.metadata!.errors as number)++
        if (process.env.LEADS_VAULT_DEBUG === '1') {
          console.error('[common-crawl] CDX stream error', pattern, e?.message)
        }
      }

      // Drain inflight workers
      await Promise.all(inflight)

      // Final batch flush for this pattern
      if (pendingBatch.length > 0) {
        const r = await flushBatch(sb, pendingBatch)
        cp.rows_inserted += r.inserted
        result.rows_inserted += r.inserted
        cp.errors_count += r.errors
        ;(result.metadata!.errors as number) += r.errors
        pendingBatch = []
      }

      // Estimate next_page by counting how many we processed (approx: entries / 5000 per CDX page)
      const nextPage = lastPage + Math.ceil(processedThisPattern / 5000) + 1
      await finishCheckpoint(sb, cp, aborted ? 'aborted' : 'finished', {
        next_page: nextPage,
        abort_reason: aborted ? abortReason : null,
      })
    }
  } finally {
    rl.stop()
  }

  result.duration_ms = Date.now() - start
  if (aborted) result.error = `aborted: ${abortReason}`
  await logSync({ source_id: sourceId, project: null, operation: 'ingest', result })
  await bumpSourceStock({ source_id: sourceId, delta_count: result.rows_inserted })
  return result
}

// ── Backwards-compatible export ─────────────────────────────────────────
// run.ts and index.ts keep using `runCommonCrawlIngest` — we delegate to v2
// with the legacy options shape. This keeps the call-site stable.
export async function runCommonCrawlIngest(
  opts: ConnectorOptions & { tlds?: string[]; crawl?: string } = {},
): Promise<SyncResult> {
  return runCommonCrawlIngestV2(opts)
}
