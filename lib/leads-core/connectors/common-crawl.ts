/**
 * Common Crawl connector — CDX API + WARC byte-range fetch.
 *
 * License: CC-BY 4.0 free for commercial use with attribution.
 * Volume potential : 50-100M EU domains per crawl. Post-filter
 * (has-contact + business-shaped) ~10-20M usable leads.
 *
 * Strategy v1 (cheap & fast) :
 * 1. Query CDX index API per TLD pattern (no S3 setup needed)
 * 2. Dedup by host (one homepage per domain)
 * 3. For each domain : byte-range fetch WARC slice (~50 KB), decompress,
 *    extract HTML, parse title + schema.org JSON-LD + emails + phones
 * 4. Upsert into lv_companies with primary_source='common_crawl'
 */

import { gunzipSync } from 'zlib'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const DEFAULT_CRAWL = 'CC-MAIN-2026-12'
const CDX_BASE = 'https://index.commoncrawl.org'
const WARC_BASE = 'https://data.commoncrawl.org'

const TLD_TO_ISO3: Record<string, string> = {
  fr: 'FRA', de: 'DEU', es: 'ESP', it: 'ITA', uk: 'GBR',
  nl: 'NLD', be: 'BEL', pl: 'POL', se: 'SWE', dk: 'DNK',
  no: 'NOR', fi: 'FIN', at: 'AUT', ch: 'CHE', pt: 'PRT',
  cz: 'CZE', ie: 'IRL', gr: 'GRC',
}

const DEFAULT_TLDS = ['fr', 'de', 'es', 'it', 'uk', 'nl', 'be', 'pl']
const UA = 'gapup-leads-vault/1.0 (research; mehdi.sakalypr@gmail.com)'

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

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

async function queryCdx(crawl: string, urlPattern: string, limit: number): Promise<CdxEntry[]> {
  const u = `${CDX_BASE}/${crawl}-index?url=${encodeURIComponent(urlPattern)}&output=json&limit=${limit}&filter=status:200&filter=mime:text/html`
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`CDX ${urlPattern}: HTTP ${res.status}`)
  const text = await res.text()
  const out: CdxEntry[] = []
  for (const line of text.split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line) as CdxEntry)
    } catch {
      // Skip malformed
    }
  }
  return out
}

async function fetchWarcSlice(entry: CdxEntry): Promise<string | null> {
  const url = `${WARC_BASE}/${entry.filename}`
  const offset = parseInt(entry.offset, 10)
  const length = parseInt(entry.length, 10)
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Range: `bytes=${offset}-${offset + length - 1}` },
  })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  let unzipped: Buffer
  try {
    unzipped = gunzipSync(buf)
  } catch {
    return null
  }
  const text = unzipped.toString('utf8')
  const a = text.indexOf('<!DOCTYPE')
  const b = text.indexOf('<html')
  const start = a >= 0 ? a : (b >= 0 ? b : -1)
  if (start < 0) return null
  return text.slice(start)
}

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
      // Skip malformed JSON-LD
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runCommonCrawlIngest(opts: ConnectorOptions & { tlds?: string[]; crawl?: string } = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { tlds: [], domains_seen: 0, with_contact: 0 },
  }

  const crawl = opts.crawl ?? DEFAULT_CRAWL
  const tlds = opts.tlds ?? DEFAULT_TLDS
  const targetTotal = opts.limit ?? 1000
  const perTld = Math.max(50, Math.floor(targetTotal / tlds.length))

  const sb = vaultClient()
  const sourceId = 'common_crawl' as const
  const seen = new Set<string>()

  for (const tld of tlds) {
    if (result.rows_processed >= targetTotal) break
    const iso3 = TLD_TO_ISO3[tld] ?? null
    let entries: CdxEntry[]
    try {
      entries = await queryCdx(crawl, `*.${tld}`, Math.min(perTld * 3, 5000))
    } catch (e: any) {
      console.warn(`[common-crawl] CDX ${tld} failed:`, e.message)
      continue
    }

    const byHost = new Map<string, CdxEntry>()
    for (const e of entries.sort((a, b) => a.url.length - b.url.length)) {
      const host = hostFromUrl(e.url)
      if (!host || seen.has(host) || byHost.has(host)) continue
      byHost.set(host, e)
    }

    let processedTld = 0
    for (const [host, entry] of byHost) {
      if (processedTld >= perTld) break
      if (result.rows_processed >= targetTotal) break

      seen.add(host)
      result.rows_processed++
      processedTld++
      result.metadata!.domains_seen = (result.metadata!.domains_seen as number) + 1

      let html: string | null
      try {
        html = await fetchWarcSlice(entry)
      } catch {
        result.rows_skipped++
        continue
      }
      if (!html) {
        result.rows_skipped++
        continue
      }

      const info = extractInfo(html)
      const hasContact = info.emails.length > 0 || info.phones.length > 0
      if (!hasContact && !info.org_name) {
        result.rows_skipped++
        await sleep(50)
        continue
      }
      result.metadata!.with_contact = (result.metadata!.with_contact as number) + 1

      const company: LvCompanyInsert = {
        primary_source: sourceId,
        source_ids: { common_crawl: host },
        legal_name: info.org_name ?? info.title ?? host,
        trade_name: info.title ?? null,
        domain: host,
        country_iso: iso3 ?? 'XXX',
        nace_code: null,
        sic_code: null,
        industry_tags: info.description ? [info.description.slice(0, 100)] : undefined,
        is_import_export: false,
        size_bucket: undefined,
      }

      const { error } = await (sb.from as any)('lv_companies')
        .upsert([company], { onConflict: 'domain', ignoreDuplicates: false })
      if (error) {
        if (process.env.LEADS_VAULT_DEBUG === '1') {
          console.error('[common-crawl] upsert error', error.message, 'host=', host)
        }
        result.rows_skipped++
      } else {
        result.rows_inserted++
        const contacts: any[] = []
        for (const email of info.emails) {
          contacts.push({ company_id: null, primary_source: sourceId, source_id: `${host}#${email}`, contact_type: 'email', contact_value: email, verify_status: 'unknown' })
        }
        for (const phone of info.phones) {
          contacts.push({ company_id: null, primary_source: sourceId, source_id: `${host}#${phone}`, contact_type: 'phone', contact_value: phone, verify_status: 'unknown' })
        }
        if (contacts.length > 0) {
          const { data: lookup } = await (sb.from as any)('lv_companies').select('id').eq('domain', host).maybeSingle()
          if (lookup?.id) {
            for (const c of contacts) c.company_id = lookup.id
            await (sb.from as any)('lv_contacts').upsert(contacts, { onConflict: 'source_id', ignoreDuplicates: true })
          }
        }
      }

      await sleep(120)
    }

    result.metadata!.tlds = [...(result.metadata!.tlds as string[]), tld]
  }

  result.duration_ms = Date.now() - start
  await logSync({ source_id: sourceId, project: null, operation: 'ingest', result })
  await bumpSourceStock({ source_id: sourceId, delta_count: result.rows_inserted })
  return result
}
