/**
 * Schema.org JSON-LD + hCard crawler — exec/person enrichment from company websites
 *
 * Source  : public websites of lv_companies with known domains
 * Auth    : none (respectful UA, throttled)
 * Yield   : ~1M execs from SME sites with /team /leadership /equipe /dirigeants pages
 *
 * Strategy :
 *   1. Cursor lv_companies WHERE domain IS NOT NULL
 *   2. For each company, probe candidate paths in parallel (p-limit 5)
 *   3. Parse <script type="application/ld+json"> for Organization.member[] / Person schemas
 *   4. Fallback: hCard microformat + heading-card heuristic
 *   5. Insert lv_persons for each exec found
 *   6. Throttle: 1s between requests to same domain, 200ms global
 */

import * as cheerio from 'cheerio'
import pLimit from 'p-limit'

const cheerioLoad = cheerio.load
import { vaultClient } from '../client'
import { logSync } from '../log'
import { classifyRole, splitFullName } from './role-classifier'
import type { LvPersonInsert, ConnectorOptions, SyncResult } from '../types'

const GLOBAL_SLEEP_MS = 200
const DOMAIN_SLEEP_MS = 1000
const PAGE_SIZE = 1000
const CONCURRENCY = 5

const CANDIDATE_PATHS = [
  'about',
  'team',
  'our-team',
  'leadership',
  'our-people',
  'management',
  'equipe',
  'notre-equipe',
  'dirigeants',
  'direction',
  'about-us',
  'qui-sommes-nous',
  'a-propos',
  'company',
  'about/team',
  'about/leadership',
  'en/team',
  'fr/equipe',
]

const UA = 'Mozilla/5.0 (compatible; LeadVault/1.0; +https://gapup.io)'
const FETCH_TIMEOUT_MS = 8000

// Known aggregator hostnames to skip if redirected
const AGGREGATOR_RX =
  /^(linkedin|facebook|instagram|twitter|x|youtube|wikipedia|wikidata|crunchbase|bloomberg|pappers|societe|infogreffe|corporama|kompass|europages|verif|score3|trustpilot|amazon|ebay|yelp)\./

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.9' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    // Check final URL not aggregator
    const finalHost = new URL(res.url).hostname.replace(/^www\./, '')
    if (AGGREGATOR_RX.test(finalHost)) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('html')) return null
    return await res.text()
  } catch {
    clearTimeout(timer)
    return null
  }
}

interface RawPerson {
  full_name: string
  role: string | null
}

function extractFromJsonLd(html: string): RawPerson[] {
  const $ = cheerioLoad(html)
  const persons: RawPerson[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown
    try {
      data = JSON.parse($(el).html() ?? '')
    } catch {
      return
    }

    const nodes: unknown[] = Array.isArray(data) ? data : [data]

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const obj = node as Record<string, unknown>

      // Organization with member/employee arrays
      if (
        (obj['@type'] === 'Organization' ||
          (Array.isArray(obj['@type']) && (obj['@type'] as string[]).includes('Organization'))) &&
        (obj.member || obj.employee || obj.founder)
      ) {
        for (const field of ['member', 'employee', 'founder'] as const) {
          const members = obj[field]
          const arr: unknown[] = Array.isArray(members) ? members : members ? [members] : []
          for (const m of arr) {
            if (!m || typeof m !== 'object') continue
            const person = m as Record<string, unknown>
            const name = typeof person.name === 'string' ? person.name.trim() : null
            if (!name) continue
            const role =
              typeof person.jobTitle === 'string'
                ? person.jobTitle.trim()
                : typeof (person as any).roleName === 'string'
                ? (person as any).roleName.trim()
                : null
            persons.push({ full_name: name, role })
          }
        }
      }

      // Standalone Person schema
      if (
        obj['@type'] === 'Person' ||
        (Array.isArray(obj['@type']) && (obj['@type'] as string[]).includes('Person'))
      ) {
        const name = typeof obj.name === 'string' ? obj.name.trim() : null
        if (name) {
          const role = typeof obj.jobTitle === 'string' ? obj.jobTitle.trim() : null
          persons.push({ full_name: name, role })
        }
      }
    }
  })

  return persons
}

function extractHCard(html: string): RawPerson[] {
  const $ = cheerioLoad(html)
  const persons: RawPerson[] = []

  // hCard microformat: <div class="h-card">
  $('.h-card, [class*="h-card"]').each((_, el) => {
    const name = $(el).find('.p-name, [class*="p-name"]').first().text().trim()
    const role =
      $(el).find('.p-job-title, [class*="p-job-title"], .p-role, [class*="job-title"]').first().text().trim() || null
    if (name && name.length >= 3) {
      persons.push({ full_name: name, role: role || null })
    }
  })

  return persons
}

// Simple name validation: at least 2 words, each starting with uppercase, no URLs
const NAME_RX = /^[A-ZÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÇ][a-záàâäéèêëíìîïóòôöúùûüñç]+(?:[-\s][A-ZÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑÇ][a-záàâäéèêëíìîïóòôöúùûüñç]+)+$/
const SKIP_NAMES = new Set(['Our Team', 'Our People', 'Meet The Team', 'Leadership Team', 'About Us', 'Management Team'])

function extractHeuristic(html: string): RawPerson[] {
  const $ = cheerioLoad(html)
  const persons: RawPerson[] = []

  // Find headings that signal team sections
  const teamHeadings = $('h1, h2, h3, h4').filter((_, el) => {
    const text = $(el).text().toLowerCase()
    return (
      text.includes('team') ||
      text.includes('leadership') ||
      text.includes('founders') ||
      text.includes('équipe') ||
      text.includes('dirigeant') ||
      text.includes('direction') ||
      text.includes('management') ||
      text.includes('people')
    )
  })

  teamHeadings.each((_, heading) => {
    // Look for person cards in the next sibling container
    const container = $(heading).nextAll().first()
    // Try pattern: <h3>Name</h3><p>Role</p> or <div><h3>Name</h3><p>Role</p></div>
    container.find('h3, h4, h5, [class*="name"], [class*="person"], [class*="member"]').each((_, nameEl) => {
      const rawName = $(nameEl).text().trim()
      if (!rawName || rawName.length < 4 || rawName.length > 80) return
      if (SKIP_NAMES.has(rawName)) return
      if (!NAME_RX.test(rawName)) return

      // Role: next sibling <p> or element with "title"/"role" class
      const roleEl =
        $(nameEl).next('p, [class*="title"], [class*="role"], [class*="position"], [class*="job"]').first()
      const rawRole = roleEl.text().trim() || null

      persons.push({
        full_name: rawName,
        role: rawRole && rawRole.length < 120 ? rawRole : null,
      })
    })
  })

  // Also: standalone person card divs with role pattern after em-dash or colon
  $('[class*="card"], [class*="person"], [class*="member"], [class*="profile"]').each((_, card) => {
    const cardText = $(card).text().trim()
    // Regex: "Name — Role" or "Name: Role" or "Name\nRole"
    const match = cardText.match(/^([A-Z][a-zA-ZÀ-ÿ\s\-']{3,50})(?:\s*[—–\-:]\s*|\n)([A-Za-zÀ-ÿ\s,&\/]{3,80})/)
    if (match) {
      const name = match[1].trim()
      const role = match[2].trim()
      if (NAME_RX.test(name) && !SKIP_NAMES.has(name)) {
        persons.push({ full_name: name, role: role || null })
      }
    }
  })

  return persons
}

function dedupePersons(persons: RawPerson[]): RawPerson[] {
  const seen = new Set<string>()
  return persons.filter((p) => {
    const key = p.full_name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function enrichCompanyPersons(
  companyId: string,
  domain: string,
  dryRun: boolean,
  client: ReturnType<typeof vaultClient>,
): Promise<{ found: number; inserted: number }> {
  const limit = pLimit(CONCURRENCY)
  const foundPersons: RawPerson[] = []

  // Fetch all candidate paths in parallel (with domain-level throttle via sequential Promise.all groups)
  const results = await Promise.all(
    CANDIDATE_PATHS.map((path) =>
      limit(async () => {
        const url = `https://${domain}/${path}`
        const html = await fetchHtml(url)
        await new Promise((r) => setTimeout(r, DOMAIN_SLEEP_MS))
        if (!html) return []

        const fromJsonLd = extractFromJsonLd(html)
        const fromHCard = extractHCard(html)
        const fromHeuristic = extractHeuristic(html)

        return [...fromJsonLd, ...fromHCard, ...fromHeuristic]
      }),
    ),
  )

  for (const batch of results) {
    foundPersons.push(...batch)
  }

  const unique = dedupePersons(foundPersons)
  if (unique.length === 0) return { found: 0, inserted: 0 }

  let inserted = 0
  for (const raw of unique) {
    const { seniority, score } = classifyRole(raw.role)
    const { first, last } = splitFullName(raw.full_name)

    const person: LvPersonInsert = {
      company_id: companyId,
      full_name: raw.full_name,
      first_name: first ?? undefined,
      last_name: last ?? undefined,
      role: raw.role ?? undefined,
      role_seniority: seniority,
      decision_maker_score: score,
      primary_source: 'common_crawl',
    }

    if (!dryRun) {
      const { error } = await client
        .from('lv_persons')
        .upsert(person as any, { onConflict: 'company_id,full_name', ignoreDuplicates: true })
      if (!error) inserted++
    } else {
      console.log(`[schema-crawl] [dry-run] ${companyId} → "${raw.full_name}" | ${raw.role ?? 'no role'} | ${seniority} (${score})`)
      inserted++
    }
  }

  return { found: unique.length, inserted }
}

export async function runSchemaJsonLdCrawl(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 500
  const client = vaultClient()

  // Cursor: companies with domain
  type Row = { id: string; domain: string }
  let lastId: string | null = null
  const list: Row[] = []

  while (list.length < totalLimit) {
    const remain = Math.min(PAGE_SIZE, totalLimit - list.length)
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
    if (rows.length === 0) break
    // Only keep those with a valid domain string
    list.push(...rows.filter((r) => r.domain && r.domain.length > 3))
    lastId = rows[rows.length - 1].id
    if (rows.length < remain) break
  }

  let processed = 0
  let totalInserted = 0
  let skipped = 0

  for (const row of list) {
    processed++
    try {
      const { found, inserted } = await enrichCompanyPersons(row.id, row.domain, !!opts.dryRun, client)
      if (found === 0) {
        skipped++
      } else {
        totalInserted += inserted
      }
    } catch (e) {
      console.warn(`[schema-crawl] error for ${row.domain}:`, (e as Error).message)
      skipped++
    }

    // Global throttle between companies
    await new Promise((r) => setTimeout(r, GLOBAL_SLEEP_MS))

    if (processed % 25 === 0) {
      const rate = ((totalInserted / processed) * 100).toFixed(1)
      console.log(`[schema-crawl] ${processed}/${list.length} processed, ${totalInserted} persons inserted (${rate}% yield)`)
    }
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: totalInserted,
    rows_updated: 0,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { companies_with_persons: processed - skipped },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'common_crawl', operation: 'sync', result })
    } catch (e) {
      console.error('[schema-crawl] logSync err:', (e as Error).message)
    }
  }

  return result
}
