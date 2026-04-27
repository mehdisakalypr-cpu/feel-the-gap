/**
 * Das Örtliche DE — German business directory (more popular than GoldenPages)
 *
 * robots.txt: /suche/ allowed, no login required
 * Throttle: 1.5s between queries
 * License: public search only, internal use
 */

import * as cheerio from 'cheerio'
import type { DirectoryHit, DirectorySearchOpts } from './types'
import { botHeaders, throttle, fuzzyScore, normalizePhone, extractDomain } from './types'

const BASE_DASOERTLICHE = 'https://www.dasoertliche.de'
const THROTTLE_MS = 1500

export async function searchByName(
  legalName: string,
  _city: string | null,
  _opts: DirectorySearchOpts = {},
): Promise<DirectoryHit[]> {
  const params = new URLSearchParams({ form_name: 'search_nat', kw: legalName })
  const url = `${BASE_DASOERTLICHE}/?${params}`

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        ...botHeaders(),
        'Accept-Language': 'de,en;q=0.8',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[goldenpages-de] HTTP ${res.status} for ${legalName}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.warn(`[goldenpages-de] fetch error: ${(err as Error).message}`)
    return []
  }

  await throttle(THROTTLE_MS)

  const $ = cheerio.load(html)
  const hits: DirectoryHit[] = []

  const selectors = [
    '.hit',
    '.result-item',
    '.entry',
    '[class*="hit"]',
    'article',
    'li[class*="entry"]',
  ]

  let cards = $('')
  for (const sel of selectors) {
    cards = $(sel)
    if (cards.length > 0) break
  }

  cards.each((_i, el) => {
    const $el = $(el)

    const name =
      $el.find('h2, h3, .name, [class*="name"], [class*="firm"]').first().text().trim()

    if (!name) return

    const score = fuzzyScore(legalName, name)
    if (score < 60) return

    const rawPhone =
      $el.find('a[href^="tel:"]').attr('href')?.replace('tel:', '') ||
      $el.find('[class*="phone"], [class*="tel"], .phone').first().text().trim()

    const phone = rawPhone ? normalizePhone(rawPhone.replace(/[^0-9+]/g, ''), '49') : undefined

    const rawEmail = $el.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '')
    const email = rawEmail?.toLowerCase()

    const rawWebsite =
      $el.find('a[href^="http"]').filter((_j, a) => {
        const h = $(a).attr('href') ?? ''
        return !h.includes('dasoertliche') && !h.includes('goldenpages')
      }).first().attr('href') || ''
    const website = rawWebsite ? extractDomain(rawWebsite) : undefined

    const addressRaw = $el.find('.address, [class*="address"], [class*="adresse"]').first().text().trim()
    const address = addressRaw || undefined

    const postalMatch = addressRaw.match(/\b\d{5}\b/)
    const postal_code = postalMatch?.[0]

    const cityMatch = addressRaw.match(/\d{5}\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)*)/)
    const city = cityMatch?.[1] || undefined

    const linkHref = $el.find('a').filter((_j, a) => {
      const h = $(a).attr('href') ?? ''
      return h.includes('/treffer') || h.includes('/detail') || h.includes('/firma')
    }).first().attr('href')
    const sourceUrl = linkHref ? (linkHref.startsWith('http') ? linkHref : `${BASE_DASOERTLICHE}${linkHref}`) : url

    const description =
      $el.find('[class*="category"], [class*="branche"], [class*="beschreibung"]').first().text().trim() || undefined

    hits.push({
      source: 'goldenpages',
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
