/**
 * PagesJaunes FR — public business directory
 *
 * robots.txt: /annuaire/ autorisé, crawl-delay 1s
 * UA: gapup-leadvault/1.0
 * Throttle: 1.5s between queries
 * License: usage interne OK (Solocal ToS §3 — no redistribution)
 */

import * as cheerio from 'cheerio'
import type { DirectoryHit, DirectorySearchOpts } from './types'
import { botHeaders, throttle, fuzzyScore, normalizePhone, extractDomain } from './types'

const BASE = 'https://www.pagesjaunes.fr'
const THROTTLE_MS = 1500

export async function searchByName(
  legalName: string,
  city: string | null,
  _opts: DirectorySearchOpts = {},
): Promise<DirectoryHit[]> {
  const where = city ?? ''
  const params = new URLSearchParams({ quoiqui: legalName, ou: where })
  const url = `${BASE}/annuaire/chercherlespros?${params}`

  let html: string
  try {
    const res = await fetch(url, {
      headers: botHeaders(),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`[pagesjaunes] HTTP ${res.status} for ${legalName}`)
      return []
    }
    html = await res.text()
  } catch (err) {
    console.warn(`[pagesjaunes] fetch error: ${(err as Error).message}`)
    return []
  }

  await throttle(THROTTLE_MS)

  const $ = cheerio.load(html)
  const hits: DirectoryHit[] = []

  $('article.bi-bloc, .bi-bloc, [class*="bi-bloc"]').each((_i, el) => {
    const $el = $(el)

    const name =
      $el.find('.bi-denomination').first().text().trim() ||
      $el.find('h3').first().text().trim() ||
      $el.find('[class*="denomination"]').first().text().trim()

    if (!name) return

    const score = fuzzyScore(legalName, name)
    if (score < 65) return

    const rawPhone =
      $el.find('a.bi-num').attr('data-pjlb') ||
      $el.find('[data-pjlb]').attr('data-pjlb') ||
      $el.find('a[href^="tel:"]').attr('href')?.replace('tel:', '') ||
      $el.find('.bi-num').text().trim()

    const phone = rawPhone ? normalizePhone(rawPhone.replace(/[^0-9+]/g, ''), '33') : undefined

    const rawEmail = $el.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '')
    const email = rawEmail?.toLowerCase()

    const rawWebsite =
      $el.find('a[href^="http"]').not('[href*="pagesjaunes"]').first().attr('href') || ''
    const website = rawWebsite ? extractDomain(rawWebsite) : undefined

    const address = $el.find('.bi-adresse, .bi-address, [class*="adresse"]').first().text().trim() || undefined

    const cityRaw =
      $el.find('.bi-ville, [class*="ville"]').first().text().trim() ||
      address?.split(',').pop()?.trim()

    const postalCode = address?.match(/\b\d{5}\b/)?.[0]

    const linkHref = $el.find('a').filter((_j, a) => $(a).attr('href')?.includes('/pros/') ?? false).first().attr('href')
    const sourceUrl = linkHref ? `${BASE}${linkHref}` : url

    const description =
      $el.find('.bi-rubrique, [class*="rubrique"]').first().text().trim() || undefined

    hits.push({
      source: 'pagesjaunes',
      matched_name: name,
      match_score: score,
      phone: phone && phone.length > 6 ? phone : undefined,
      email,
      website,
      address,
      city: cityRaw || undefined,
      postal_code: postalCode,
      description,
      source_url: sourceUrl,
    })
  })

  return hits
}
