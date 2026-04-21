/**
 * Hunter.io adapter — email verification + domain search.
 *
 * Pricing: Free 25 searches/mo · Starter $34/mo 500 searches.
 * Used for: verifying Apollo emails + finding missing emails by domain.
 */
const BASE = 'https://api.hunter.io/v2'

export interface HunterVerification {
  status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown'
  result: string
  score: number
  regexp: boolean
  gibberish: boolean
  disposable: boolean
  webmail: boolean
  mx_records: boolean
  smtp_server: boolean
  smtp_check: boolean
}

export function isConfigured(): boolean {
  return !!process.env.HUNTER_API_KEY
}

export async function verifyEmail(email: string): Promise<HunterVerification | null> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return null
  try {
    const url = `${BASE}/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(key)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as { data?: HunterVerification }
    return json.data ?? null
  } catch {
    return null
  }
}

export async function findEmailByName(opts: { first_name: string; last_name: string; domain: string }) {
  const key = process.env.HUNTER_API_KEY
  if (!key) return null
  try {
    const params = new URLSearchParams({
      first_name: opts.first_name,
      last_name: opts.last_name,
      domain: opts.domain,
      api_key: key,
    })
    const res = await fetch(`${BASE}/email-finder?${params.toString()}`)
    if (!res.ok) return null
    const json = await res.json() as { data?: { email?: string; score?: number; verification?: { status?: string } } }
    return json.data ?? null
  } catch {
    return null
  }
}

// Map Hunter verification to our verification_status enum
export function hunterToVerificationStatus(v: HunterVerification): 'valid' | 'invalid' | 'risky' | 'unknown' {
  if (v.status === 'valid') return 'valid'
  if (v.status === 'invalid' || v.status === 'disposable') return 'invalid'
  if (v.status === 'accept_all' || v.status === 'webmail' || v.status === 'unknown') return 'risky'
  return 'unknown'
}
