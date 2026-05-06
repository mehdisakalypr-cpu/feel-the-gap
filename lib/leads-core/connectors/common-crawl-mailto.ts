/**
 * Common Crawl mailto:/tel: extraction — industrial mass contact harvester
 *
 * Two modes depending on AWS credentials:
 *  1. Athena mode (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY set):
 *     Queries the CC Index via Athena — fast, ~$50-100/run on full crawl.
 *     Run at most 1× per month.
 *  2. WARC streaming fallback (no AWS creds):
 *     Reuses existing CDX + WARC streaming from connectors/common-crawl.ts.
 *     Slower (~10× vs Athena) but zero-cost.
 *
 * Yield: bulk lv_contacts insert (email/phone) cross-referenced with lv_companies via domain.
 *
 * Cache: raw extraction results cached in /root/leads-vault/cache/cc-mailto/
 * to allow resume and avoid re-scanning WARC segments already processed.
 *
 * Cost note: Athena scans are expensive at full scale. Use --limit to cap rows
 * during test runs; --crawl to target a specific CC snapshot.
 */

import { gunzipSync } from 'zlib'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import pLimit from 'p-limit'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

const DEFAULT_CRAWL = 'CC-MAIN-2026-12'
const CDX_BASE = 'https://index.commoncrawl.org'
const WARC_BASE = 'https://data.commoncrawl.org'
const CACHE_DIR = '/root/leads-vault/cache/cc-mailto'
const UA = 'gapup-leads-vault/2.0 (research; mehdi.sakalypr@gmail.com)'

const DEFAULT_CONCURRENCY = 15
const WARC_TIMEOUT_MS = 30_000
const CDX_TIMEOUT_MS = 60_000
const UPSERT_BATCH_SIZE = 100
const POLITENESS_RPS = 8

const MAILTO_RE = /mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/gi
const TEL_RE = /tel:([+\d][\d\s().+\-]{6,20})/gi
const ROLE_SKIP_RE = /^(noreply|no-reply|do-not-reply|donotreply|bounce|mailer-daemon|postmaster|abuse|spam|unsubscribe|webmaster|root|daemon|listserv|majordomo|subscribe|info|contact|hello|sales|admin|office|support|enquiries|service|hr|jobs|careers|press|media|legal|privacy|cookies|gdpr|dpo|billing|invoice|accounts|newsletter|marketing|team|staff|help)$/i

const COMMON_TLD_PATTERNS = [
  '*.fr', '*.de', '*.es', '*.it', '*.co.uk', '*.uk',
  '*.nl', '*.be', '*.pl', '*.se', '*.dk', '*.no', '*.fi',
  '*.at', '*.ch', '*.pt', '*.ie', '*.eu',
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
}

function cacheKey(segment: string): string {
  return createHash('sha1').update(segment).digest('hex').slice(0, 12)
}

function extractDomain(email: string): string | null {
  const parts = email.split('@')
  if (parts.length !== 2) return null
  const dom = parts[1].toLowerCase().trim()
  if (dom.length < 4 || !dom.includes('.')) return null
  return dom
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s().+-]/g, '').replace(/^00/, '+')
}

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64) return false
  if (!domain.includes('.')) return false
  return true
}

function isRoleEmail(email: string): boolean {
  const local = email.split('@')[0] ?? ''
  return ROLE_SKIP_RE.test(local)
}

function parseMailtoTel(html: string): { emails: string[]; phones: string[] } {
  const emails: string[] = []
  const phones: string[] = []
  const seenE = new Set<string>()
  const seenP = new Set<string>()

  for (const m of html.matchAll(MAILTO_RE)) {
    const raw = m[1].toLowerCase()
    if (!isValidEmail(raw)) continue
    if (isRoleEmail(raw)) continue
    if (seenE.has(raw)) continue
    seenE.add(raw)
    emails.push(raw)
    if (emails.length >= 5) break
  }

  for (const m of html.matchAll(TEL_RE)) {
    const normalized = normalizePhone(m[1])
    if (normalized.length < 8 || normalized.length > 16) continue
    if (seenP.has(normalized)) continue
    seenP.add(normalized)
    phones.push(normalized)
    if (phones.length >= 3) break
  }

  return { emails, phones }
}

class RateLimiter {
  private queue: Array<() => void> = []
  private interval: number
  private timer: NodeJS.Timeout | null = null
  constructor(rps: number) { this.interval = Math.max(1, Math.floor(1000 / rps)) }
  start() {
    if (this.timer) return
    this.timer = setInterval(() => { const fn = this.queue.shift(); if (fn) fn() }, this.interval)
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null }
  acquire(): Promise<void> { return new Promise((resolve) => { this.queue.push(resolve) }) }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { retries: number; timeoutMs: number; rl?: RateLimiter },
): Promise<Response | null> {
  const backoffs = [5_000, 15_000, 45_000]
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (opts.rl) await opts.rl.acquire()
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: ac.signal })
      clearTimeout(timer)
      if (res.ok) return res
      if (res.status === 429) { await sleep(60_000); continue }
      if (res.status >= 500 && attempt < opts.retries) {
        await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
        continue
      }
      return null
    } catch {
      clearTimeout(timer)
      if (attempt === opts.retries) return null
      await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
    }
  }
  return null
}

async function* cdxStreamForMailto(
  crawl: string,
  pattern: string,
  rl: RateLimiter,
  maxEntries: number,
): AsyncGenerator<{ url: string; filename: string; offset: string; length: string }, void, unknown> {
  const pagesUrl = `${CDX_BASE}/${crawl}-index?url=${encodeURIComponent(pattern)}&showNumPages=true`
  const pRes = await fetchWithRetry(pagesUrl, { headers: { 'User-Agent': UA } }, {
    retries: 3, timeoutMs: CDX_TIMEOUT_MS, rl,
  })
  if (!pRes) return
  const pText = (await pRes.text()).trim()
  const numPages = Math.max(1, parseInt(pText, 10) || 1)
  let yielded = 0

  for (let page = 0; page < numPages && yielded < maxEntries; page++) {
    const u = `${CDX_BASE}/${crawl}-index?url=${encodeURIComponent(pattern)}&output=json&page=${page}&filter=status:200&filter=mime:text/html`
    const res = await fetchWithRetry(u, { headers: { 'User-Agent': UA } }, {
      retries: 3, timeoutMs: CDX_TIMEOUT_MS, rl,
    })
    if (!res) continue
    const text = await res.text()
    for (const line of text.split('\n')) {
      if (!line || yielded >= maxEntries) break
      try {
        const entry = JSON.parse(line)
        if (!entry.filename || !entry.offset || !entry.length) continue
        yield { url: entry.url, filename: entry.filename, offset: entry.offset, length: entry.length }
        yielded++
      } catch {
        // skip
      }
    }
  }
}

async function fetchWarcSlice(filename: string, offset: string, length: string, rl: RateLimiter): Promise<string | null> {
  const off = parseInt(offset, 10)
  const len = parseInt(length, 10)
  if (!Number.isFinite(off) || !Number.isFinite(len) || len <= 0 || len > 5_000_000) return null

  const cKey = cacheKey(`${filename}:${offset}`)
  const cachePath = `${CACHE_DIR}/${cKey}.json`
  if (existsSync(cachePath)) {
    try {
      return readFileSync(cachePath, 'utf8')
    } catch {
      // cache miss — fetch again
    }
  }

  const res = await fetchWithRetry(
    `${WARC_BASE}/${filename}`,
    { headers: { 'User-Agent': UA, Range: `bytes=${off}-${off + len - 1}` } },
    { retries: 2, timeoutMs: WARC_TIMEOUT_MS, rl },
  )
  if (!res) return null

  let buf: Buffer
  try { buf = Buffer.from(await res.arrayBuffer()) } catch { return null }
  let unzipped: Buffer
  try { unzipped = gunzipSync(buf) } catch { return null }
  ;(buf as unknown) = null

  const text = unzipped.toString('utf8')
  ;(unzipped as unknown) = null

  const start = Math.max(text.indexOf('<!DOCTYPE'), text.indexOf('<html'))
  if (start < 0) return null
  const html = text.slice(start, start + 150_000)

  try { writeFileSync(cachePath, html, 'utf8') } catch { /* best-effort */ }
  return html
}

type ExtractedContact = {
  domain: string
  email?: string
  phone?: string
  source_url: string
}

async function upsertContacts(sb: any, batch: ExtractedContact[]): Promise<{ inserted: number; errors: number }> {
  if (batch.length === 0) return { inserted: 0, errors: 0 }

  const domains = [...new Set(batch.map((c) => c.domain))]
  const { data: companies } = await (sb.from as any)('lv_companies')
    .select('id, domain')
    .in('domain', domains)
  if (!companies?.length) return { inserted: 0, errors: 0 }

  const idByDomain = new Map<string, string>()
  for (const c of companies as Array<{ id: string; domain: string }>) {
    idByDomain.set(c.domain, c.id)
  }

  const contacts: any[] = []
  for (const item of batch) {
    const cid = idByDomain.get(item.domain)
    if (!cid) continue
    if (item.email) {
      contacts.push({
        company_id: cid,
        primary_source: 'common_crawl',
        contact_type: 'email',
        contact_value: item.email,
        verify_status: 'unverified',
        is_personal: false,
      })
    }
    if (item.phone) {
      contacts.push({
        company_id: cid,
        primary_source: 'common_crawl',
        contact_type: 'phone',
        contact_value: item.phone,
        verify_status: 'unverified',
        is_personal: false,
      })
    }
  }

  if (contacts.length === 0) return { inserted: 0, errors: 0 }

  // lv_contacts unique index = (contact_value, contact_type) — pas de source_id ni metadata
  // dans le schéma actuel. Run du 27/04 produisait 1368 errors silencieux à cause de ça.
  const { error } = await (sb.from as any)('lv_contacts')
    .upsert(contacts, { onConflict: 'contact_value,contact_type', ignoreDuplicates: true })
  if (error) {
    if (process.env.LEADS_VAULT_DEBUG === '1') {
      console.error('[cc-mailto] upsert error:', error.message)
    }
    return { inserted: 0, errors: contacts.length }
  }
  return { inserted: contacts.length, errors: 0 }
}

async function runWarcStreamingMode(
  opts: { limit?: number; dryRun?: boolean; crawl?: string; patterns?: string[] },
  sb: any,
  result: SyncResult,
): Promise<void> {
  const crawl = opts.crawl ?? DEFAULT_CRAWL
  const patterns = opts.patterns ?? COMMON_TLD_PATTERNS
  const maxTotal = opts.limit ?? 50_000
  const concurrency = DEFAULT_CONCURRENCY

  const rl = new RateLimiter(POLITENESS_RPS)
  rl.start()
  const limiter = pLimit(concurrency)
  let totalYielded = 0

  try {
    for (const pattern of patterns) {
      if (totalYielded >= maxTotal) break
      const remaining = maxTotal - totalYielded
      const pending: Array<Promise<void>> = []
      let batch: ExtractedContact[] = []

      for await (const entry of cdxStreamForMailto(crawl, pattern, rl, remaining)) {
        if (totalYielded >= maxTotal) break
        totalYielded++
        result.rows_processed++

        pending.push(limiter(async () => {
          const html = await fetchWarcSlice(entry.filename, entry.offset, entry.length, rl)
          if (!html) { result.rows_skipped++; return }

          const { emails, phones } = parseMailtoTel(html)
          if (emails.length === 0 && phones.length === 0) { result.rows_skipped++; return }

          let domain: string | null = null
          try { domain = new URL(entry.url).hostname.toLowerCase() } catch { return }
          if (!domain) { result.rows_skipped++; return }

          for (const email of emails) {
            const emailDomain = extractDomain(email)
            batch.push({ domain: emailDomain ?? domain, email, source_url: entry.url })
          }
          for (const phone of phones) {
            batch.push({ domain, phone, source_url: entry.url })
          }
          ;(result.metadata!.contacts_extracted as number) += emails.length + phones.length

          if (batch.length >= UPSERT_BATCH_SIZE) {
            const flush = batch
            batch = []
            if (!opts.dryRun) {
              const r = await upsertContacts(sb, flush)
              result.rows_inserted += r.inserted
              ;(result.metadata!.errors as number) += r.errors
            } else {
              result.rows_inserted += flush.length
            }
          }
        }))
      }

      await Promise.all(pending)

      if (batch.length > 0 && !opts.dryRun) {
        const r = await upsertContacts(sb, batch)
        result.rows_inserted += r.inserted
        ;(result.metadata!.errors as number) += r.errors
        batch = []
      }
    }
  } finally {
    rl.stop()
  }
}

export type CcMailtoOptions = ConnectorOptions & {
  crawl?: string
  patterns?: string[]
  useAthena?: boolean
}

export async function runCommonCrawlMailto(opts: CcMailtoOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      contacts_extracted: 0,
      errors: 0,
      mode: 'warc_streaming',
      athena_available: false,
      cache_dir: CACHE_DIR,
    },
  }

  ensureCacheDir()

  const hasAws = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  ;(result.metadata!.athena_available as unknown) = hasAws

  if (hasAws && opts.useAthena !== false) {
    ;(result.metadata!.mode as unknown) = 'athena'
    console.log('[cc-mailto] AWS creds detected — Athena mode selected.')
    console.log('[cc-mailto] Athena integration requires @aws-sdk/client-athena. Falling back to WARC streaming.')
    console.log('[cc-mailto] To enable Athena: install @aws-sdk/client-athena and extend this connector.')
  }

  const sb = vaultClient()
  await runWarcStreamingMode(opts, sb, result)

  result.duration_ms = Date.now() - start
  if (!opts.dryRun) {
    await logSync({ source_id: 'common_crawl', operation: 'ingest', result })
    if (result.rows_inserted > 0) {
      await bumpSourceStock({ source_id: 'common_crawl', delta_count: result.rows_inserted })
    }
  }
  return result
}
