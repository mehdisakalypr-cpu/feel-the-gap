/**
 * Kompass — EXPERIMENTAL, disabled by default
 *
 * robots.txt: strict — Cloudflare + bot detection
 * Only runs when opts.enableKompass = true
 * Falls back gracefully on block
 */

import * as cheerio from 'cheerio'
import type { DirectoryHit, DirectorySearchOpts } from './types'
import { botHeaders, throttle, fuzzyScore, normalizePhone, extractDomain } from './types'

const BASE = 'https://fr.kompass.com'
const THROTTLE_MS = 2000

const COUNTRY_DIAL: Record<string, string> = {
  FRA: '33', DEU: '49', GBR: '44', ITA: '39', ESP: '34',
  NLD: '31', BEL: '32', POL: '48',
}

export async function searchByName(
  legalName: string,
  countryIso3: string,
  opts: DirectorySearchOpts = {},
): Promise<DirectoryHit[]> {
  if (!opts.enableKompass) {
    return []
  }

  const params = new URLSearchParams({ text: legalName, searchType: 'COMPANY' })
  const url = `${BASE}/searchCompanies?${params}`

  let html: string
  try {
    const res = await fetch(url, {
      headers: botHeaders(),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      console.warn(`[kompass] blocked HTTP ${res.status} — skipping`)
      return []
    }
    if (!res.ok) {
      console.warn(`[kompass] HTTP ${res.status} for ${legalName}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.warn(`[kompass] fetch error: ${(err as Error).message}`)
    return []
  }

  await throttle(THROTTLE_MS)

  if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
    console.warn('[kompass] Cloudflare challenge detected — skipping')
    return []
  }

  const $ = cheerio.load(html)
  const hits: DirectoryHit[] = []
  const dial = COUNTRY_DIAL[countryIso3] ?? '33'

  $('[class*="company-item"], [class*="CompanyItem"], .result-item, article').each((_i, el) => {
    const $el = $(el)

    const name = $el.find('h2, h3, [class*="name"]').first().text().trim()
    if (!name) return

    const score = fuzzyScore(legalName, name)
    if (score < 60) return

    const rawPhone =
      $el.find('a[href^="tel:"]').attr('href')?.replace('tel:', '') ||
      $el.find('[class*="phone"]').first().text().trim()

    const phone = rawPhone ? normalizePhone(rawPhone.replace(/[^0-9+]/g, ''), dial) : undefined

    const rawEmail = $el.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '')
    const email = rawEmail?.toLowerCase()

    const rawWebsite =
      $el.find('a[href^="http"]').filter((_j, a) => !$(a).attr('href')?.includes('kompass')).first().attr('href') || ''
    const website = rawWebsite ? extractDomain(rawWebsite) : undefined

    const address = $el.find('[class*="address"]').first().text().trim() || undefined
    const city = $el.find('[class*="city"], [class*="ville"]').first().text().trim() || undefined
    const postal_code = address?.match(/\b\d{4,5}\b/)?.[0]

    const linkHref = $el.find('a').filter((_j, a) => $(a).attr('href')?.includes('/company') ?? false).first().attr('href')
    const sourceUrl = linkHref ? (linkHref.startsWith('http') ? linkHref : `${BASE}${linkHref}`) : url

    hits.push({
      source: 'kompass',
      matched_name: name,
      match_score: score,
      phone: phone && phone.length > 6 ? phone : undefined,
      email,
      website,
      address,
      city,
      postal_code,
      source_url: sourceUrl,
    })
  })

  return hits
}
