/**
 * Hunter.io email finder — free tier 25 searches + 50 verifs /mo.
 * Docs: https://hunter.io/api-documentation/v2
 */

export interface HunterEmail {
  email: string
  confidence: number  // 0-100
  sources_count?: number
  first_name?: string
  last_name?: string
  position?: string
}

export function isConfigured() {
  return !!process.env.HUNTER_API_KEY
}

export async function findEmail(opts: {
  first_name: string
  last_name: string
  domain: string
  company?: string
}): Promise<HunterEmail | null> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return null
  const url = new URL('https://api.hunter.io/v2/email-finder')
  url.searchParams.set('domain', opts.domain)
  url.searchParams.set('first_name', opts.first_name)
  url.searchParams.set('last_name', opts.last_name)
  if (opts.company) url.searchParams.set('company', opts.company)
  url.searchParams.set('api_key', key)

  try {
    const r = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } })
    if (!r.ok) {
      console.warn(`[hunter] ${r.status}`)
      return null
    }
    const j = await r.json() as { data?: { email?: string; score?: number; sources?: unknown[] } }
    if (!j.data?.email) return null
    return {
      email: j.data.email,
      confidence: j.data.score ?? 0,
      sources_count: Array.isArray(j.data.sources) ? j.data.sources.length : 0,
      first_name: opts.first_name,
      last_name: opts.last_name,
    }
  } catch (e) {
    console.warn('[hunter] error', (e as Error).message.slice(0, 100))
    return null
  }
}

export async function verifyEmail(email: string): Promise<{ email: string; status: string; score: number } | null> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return null
  const url = new URL('https://api.hunter.io/v2/email-verifier')
  url.searchParams.set('email', email)
  url.searchParams.set('api_key', key)
  try {
    const r = await fetch(url.toString())
    if (!r.ok) return null
    const j = await r.json() as { data?: { email?: string; status?: string; score?: number } }
    if (!j.data?.email) return null
    return { email: j.data.email, status: j.data.status ?? 'unknown', score: j.data.score ?? 0 }
  } catch { return null }
}
