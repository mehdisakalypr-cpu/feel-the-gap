/**
 * PhantomBuster adapter — LinkedIn profile scrape + connection automation.
 *
 * Pricing: Starter $69/mo 20h exec/mo. Growth $159/mo 80h. Enterprise custom.
 * Used for: LinkedIn profile scraping, connection requests with note, Sales Nav search.
 */

const BASE = 'https://api.phantombuster.com/api/v2'

export interface PhantomLinkedInProfile {
  profileUrl: string
  firstName?: string
  lastName?: string
  headline?: string
  location?: string
  company?: string
  email?: string        // only when "email-enrichment" phantom used
  publicIdentifier?: string
}

export function isConfigured(): boolean {
  return !!process.env.PHANTOMBUSTER_API_KEY
}

/**
 * Launch a phantom and wait for result (simplified — async in reality).
 * For batch flows, use the `launch` + cron polling pattern instead.
 */
export async function launchPhantom(phantomId: string, argument: Record<string, unknown>) {
  const key = process.env.PHANTOMBUSTER_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${BASE}/agents/launch`, {
      method: 'POST',
      headers: { 'X-Phantombuster-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: phantomId, argument }),
    })
    if (!res.ok) return null
    return (await res.json()) as { containerId: string }
  } catch {
    return null
  }
}

/**
 * Transform a PhantomBuster LinkedIn profile into ftg_leads upsert shape.
 */
export function toFtgLeadRow(p: PhantomLinkedInProfile) {
  return {
    source: 'phantombuster' as const,
    source_external_id: p.publicIdentifier ?? p.profileUrl,
    source_payload: p,
    linkedin_url: p.profileUrl,
    first_name: p.firstName ?? null,
    last_name: p.lastName ?? null,
    full_name: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
    title: p.headline ?? null,
    company_name: p.company ?? null,
    email: p.email ?? null,
    status: p.email ? 'enriched' : 'sourced',
  }
}
