/**
 * Europages EU — pan-European B2B directory
 *
 * robots.txt: search results allowed, no login required
 * Throttle: 1.5s between queries
 * License: public search, no redistribution of bulk data
 */

import * as cheerio from 'cheerio'
import type { DirectoryHit, DirectorySearchOpts } from './types'
import { botHeaders, throttle, fuzzyScore, normalizePhone, extractDomain } from './types'

const BASE = 'https://www.europages.com'
const THROTTLE_MS = 1500

const COUNTRY_DIAL: Record<string, string> = {
  FRA: '33', DEU: '49', GBR: '44', ITA: '39', ESP: '34',
  NLD: '31', BEL: '32', POL: '48', PRT: '351', AUT: '43',
  CHE: '41', SWE: '46', DNK: '45', NOR: '47', FIN: '358',
}

const ISO3_TO_ISO2: Record<string, string> = {
  FRA: 'fr', DEU: 'de', GBR: 'gb', ITA: 'it', ESP: 'es',
  NLD: 'nl', BEL: 'be', POL: 'pl', PRT: 'pt', AUT: 'at',
  CHE: 'ch', SWE: 'se', DNK: 'dk', NOR: 'no', FIN: 'fi',
}

export async function searchByName(
  legalName: string,
  countryIso3: string,
  _opts: DirectorySearchOpts = {},
): Promise<DirectoryHit[]> {
  const iso2 = ISO3_TO_ISO2[countryIso3] ?? ''
  const params = new URLSearchParams({ lang: 'en', q: legalName, ...(iso2 ? { country: iso2 } : {}) })
  const url = `${BASE}/searchresults.html?${params}`

  let html: string
  try {
    const res = await fetch(url, {
      headers: { ...botHeaders(), Accept: 'text/html' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[europages] HTTP ${res.status} for ${legalName}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.warn(`[europages] fetch error: ${(err as Error).message}`)
    return []
  }

  await throttle(THROTTLE_MS)

  const $ = cheerio.load(html)
  const hits: DirectoryHit[] = []
  const dial = COUNTRY_DIAL[countryIso3] ?? '33'

  const selectors = [
    'article.company-card',
    '.company-card',
    '[class*="CompanyCard"]',
    '.result-card',
    '.search-result-item',
    'li[class*="company"]',
  ]

  let cards = $('')
  for (const sel of selectors) {
    cards = $(sel)
    if (cards.length > 0) break
  }

  if (cards.length === 0) {
    cards = $('article, .card').filter((_i, el) => {
      const text = $(el).text()
      return text.length > 50 && text.length < 2000
    })
  }

  cards.each((_i, el) => {
    const $el = $(el)

    const name =
      $el.find('h2, h3, [class*="name"], [class*="title"]').first().text().trim()

    if (!name) return

    const score = fuzzyScore(legalName, name)
    if (score < 60) return

    const rawPhone =
      $el.find('a[href^="tel:"]').attr('href')?.replace('tel:', '') ||
      $el.find('[class*="phone"], [class*="tel"]').first().text().trim()

    const phone = rawPhone ? normalizePhone(rawPhone.replace(/[^0-9+]/g, ''), dial) : undefined

    const rawEmail = $el.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '')
    const email = rawEmail?.toLowerCase()

    const rawWebsite =
      $el.find('a[href^="http"]').filter((_j, a) => !$(a).attr('href')?.includes('europages')).first().attr('href') || ''
    const website = rawWebsite ? extractDomain(rawWebsite) : undefined

    const address = $el.find('[class*="address"], [class*="location"]').first().text().trim() || undefined
    const city = $el.find('[class*="city"]').first().text().trim() || undefined
    const postal_code = address?.match(/\b\d{4,5}\b/)?.[0]

    const linkHref = $el.find('a').filter((_j, a) => {
      const h = $(a).attr('href') ?? ''
      return h.includes('/company') || h.includes('/profile')
    }).first().attr('href')
    const sourceUrl = linkHref ? (linkHref.startsWith('http') ? linkHref : `${BASE}${linkHref}`) : url

    const description =
      $el.find('[class*="description"], [class*="sector"], [class*="activity"]').first().text().trim() || undefined

    hits.push({
      source: 'europages',
      matched_name: name,
      match_score: score,
      phone: phone && phone.length > 6 ? phone : undefined,
      email,
      website,
      address,
      city,
      postal_code,
      description,
      source_url: sourceUrl,
    })
  })

  return hits
}
