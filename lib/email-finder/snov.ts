/**
 * Snov.io email finder — free tier 50 credits/mo.
 * Docs: https://snov.io/api
 *
 * Flow : OAuth2 token (client_credentials) → email-finder endpoint.
 */

let cachedToken: { token: string; exp: number } | null = null

async function getToken(): Promise<string | null> {
  const clientId = process.env.SNOV_CLIENT_ID
  const clientSecret = process.env.SNOV_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.token
  try {
    const r = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    })
    if (!r.ok) return null
    const j = await r.json() as { access_token?: string; expires_in?: number }
    if (!j.access_token) return null
    cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000 }
    return cachedToken.token
  } catch { return null }
}

export function isConfigured() {
  return !!(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET)
}

export async function findEmail(opts: {
  first_name: string
  last_name: string
  domain: string
}): Promise<{ email: string; confidence: number } | null> {
  const token = await getToken()
  if (!token) return null
  try {
    const r = await fetch('https://api.snov.io/v2/domain-emails-with-info', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: opts.domain,
        firstName: opts.first_name,
        lastName: opts.last_name,
        limit: 1,
      }),
    })
    if (!r.ok) return null
    const j = await r.json() as { emails?: Array<{ email?: string; emailStatus?: string }> }
    const hit = j.emails?.[0]
    if (!hit?.email) return null
    return {
      email: hit.email,
      confidence: hit.emailStatus === 'valid' ? 90 : 50,
    }
  } catch { return null }
}
