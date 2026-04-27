/**
 * Shared types for EU directory sub-modules
 */

export type DirectoryHit = {
  source: 'pagesjaunes' | 'europages' | 'goldenpages' | 'dasoertliche' | 'kompass'
  matched_name: string
  match_score: number
  phone?: string
  email?: string
  website?: string
  address?: string
  city?: string
  postal_code?: string
  description?: string
  source_url: string
}

export type DirectorySearchOpts = {
  enableKompass?: boolean
  timeoutMs?: number
}

const BOT_UA = 'gapup-leadvault/1.0 (+https://gapup.io/bot)'

export function botHeaders(): Record<string, string> {
  return {
    'User-Agent': BOT_UA,
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'fr,en;q=0.8',
    'Cache-Control': 'no-cache',
  }
}

export async function throttle(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms))
}

export function fuzzyScore(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 85
  const wordsA = new Set(na.split(' '))
  const wordsB = new Set(nb.split(' '))
  let common = 0
  for (const w of wordsA) if (wordsB.has(w) && w.length > 2) common++
  const denom = Math.max(wordsA.size, wordsB.size)
  return denom === 0 ? 0 : Math.round((common / denom) * 80)
}

export function normalizePhone(raw: string, defaultCountryCode: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  const cc = defaultCountryCode.replace('+', '')
  const digits = cleaned.replace(/^0/, '')
  return `+${cc}${digits}`
}

export function extractDomain(url: string): string | undefined {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}
