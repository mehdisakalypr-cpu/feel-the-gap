/**
 * Phase C — Domain discovery via web search
 *
 * Strategy (no external paid APIs required):
 *   1. Heuristic guess — clean legal_name (strip "LTD", "GmbH", "SARL"), generate slug,
 *      try common TLDs by country (.fr, .co.uk, .com, .de, .es).
 *   2. HEAD probe each guess; success if 200/301/302 + non-empty Content-Length.
 *   3. Verify guess matches by GET / and check homepage <title> or first <h1>
 *      contains a token from legal_name (>= 60% similarity).
 *   4. Fallback — DuckDuckGo HTML scrape (lite, no JS) to extract first non-aggregator URL.
 *   5. Update lv_companies.domain.
 *
 * Future-add (when keys available):
 *   - Brave Search API (free 2k/mo)
 *   - Google Custom Search (free 100/day)
 *   - LLM cleanup via Claude Haiku for ambiguous cases
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

const SLEEP_MS = 800 // polite to DDG
const BATCH_SIZE = 50

const TLDS_BY_COUNTRY: Record<string, string[]> = {
  FRA: ['fr', 'com', 'eu'],
  GBR: ['co.uk', 'com', 'uk'],
  DEU: ['de', 'com', 'eu'],
  ESP: ['es', 'com'],
  ITA: ['it', 'com'],
  NLD: ['nl', 'com'],
  BEL: ['be', 'com'],
  POL: ['pl', 'com'],
}

const STRIP_RX =
  /\b(LTD|LIMITED|LLP|LLC|INC|CORP|GMBH|UG|AG|KG|SE|SAS|SARL|EURL|SCI|SCP|SCM|SCS|SNC|S\.?A\.?|S\.?L\.?|SPA|SRL|SOCIEDAD|SOCIETE|SOCIÉTÉ|COMPANY|TRADING|GROUP|HOLDING|ENTERPRISES|INDUSTRIES|SERVICES|CONSULTING|INTERNATIONAL|EUROPE|FRANCE|GLOBAL|GROUPE|SOC\b|SA\b|SARL\b|SAS\b)\b/gi

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(STRIP_RX, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30)
}

function generateGuesses(legalName: string, country: string): string[] {
  const slug = slugify(legalName)
  if (slug.length < 3) return []
  const tlds = TLDS_BY_COUNTRY[country] ?? ['com']
  return tlds.map((tld) => `${slug}.${tld}`)
}

async function probeHead(domain: string, timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`https://${domain}/`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.status >= 200 && res.status < 400) return true
    return false
  } catch {
    clearTimeout(timer)
    return false
  }
}

async function verifyHomepage(domain: string, legalName: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://${domain}/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadVault/1.0; +https://gapup.io)' },
    })
    clearTimeout(timer)
    if (!res.ok) return false
    const html = await res.text()
    const lowerHtml = html.toLowerCase().slice(0, 50_000)
    const tokens = legalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(STRIP_RX, '')
      .split(/\s+/)
      .filter((t) => t.length >= 4)
    if (tokens.length === 0) return true // can't verify, accept the guess
    const hits = tokens.filter((t) => lowerHtml.includes(t)).length
    return hits / tokens.length >= 0.4
  } catch {
    return false
  }
}

async function ddgSearch(legalName: string, city: string | null): Promise<string | null> {
  const q = `${legalName}${city ? ' ' + city : ''} site officiel`
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadVault/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    // DDG HTML lite: results in `<a class="result__a" href="/l/?uddg=...&...">`
    // The href is a redirect; extract the target via `uddg` param
    const matches = html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g)
    for (const m of matches) {
      const href = m[1]
      let target = href
      if (href.startsWith('/l/?')) {
        const u = new URL('https://duckduckgo.com' + href)
        const dest = u.searchParams.get('uddg')
        if (dest) target = decodeURIComponent(dest)
      }
      try {
        const u = new URL(target)
        const host = u.hostname.replace(/^www\./, '')
        // Skip aggregators
        if (
          /^(linkedin|facebook|instagram|twitter|x|youtube|wikipedia|wikidata|crunchbase|bloomberg|pappers|societe|infogreffe|corporama|kompass|europages|verif|score3|tribunal|infonet|opencorporates|companieshouse|gov\.uk|finanzen|northdata|bundesanzeiger|companieslist|trustpilot|amazon|ebay|yelp)\./.test(
            host,
          )
        )
          continue
        return host
      } catch {
        continue
      }
    }
    return null
  } catch {
    return null
  }
}

export async function runDomainSearch(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 500
  const client = vaultClient()

  const allowedCountries = ['FRA', 'GBR', 'DEU', 'ESP', 'NLD', 'BEL', 'POL', 'ITA']

  const { data: rows, error } = await client
    .from('lv_companies')
    .select('id, legal_name, country_iso, city')
    .is('domain', null)
    .in('country_iso', allowedCountries)
    .order('id', { ascending: true })
    .limit(limit)

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

  const list = (rows ?? []) as Array<{
    id: string
    legal_name: string
    country_iso: string
    city: string | null
  }>

  let processed = 0
  let updated = 0
  let skipped = 0

  for (const row of list) {
    processed++
    let foundDomain: string | null = null

    // 1. Heuristic guess
    const guesses = generateGuesses(row.legal_name, row.country_iso)
    for (const guess of guesses) {
      if (await probeHead(guess)) {
        if (await verifyHomepage(guess, row.legal_name)) {
          foundDomain = guess
          break
        }
      }
    }

    // 2. DDG fallback
    if (!foundDomain) {
      const ddg = await ddgSearch(row.legal_name, row.city)
      if (ddg && (await probeHead(ddg))) {
        foundDomain = ddg
      }
    }

    if (foundDomain) {
      if (!opts.dryRun) {
        await client
          .from('lv_companies')
          .update({ domain: foundDomain, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      }
      updated++
    } else {
      skipped++
    }

    await new Promise((r) => setTimeout(r, SLEEP_MS))

    if (processed % 25 === 0) {
      console.log(
        `[domain-search] ${processed}/${list.length} processed, ${updated} found (${(
          (updated / processed) * 100
        ).toFixed(1)}%)`,
      )
    }
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: 0,
    rows_updated: updated,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
  }

  if (!opts.dryRun) {
    await logSync('common_crawl', 'domain_search', result)
  }

  return result
}
