/**
 * Instantly.ai adapter — cold email at scale with auto-warmup + deliverability.
 *
 * Pricing: Growth $37/mo 1k contacts + 5k sends/mo · Hypergrowth $97 30k sends.
 * Docs: https://developer.instantly.ai/api
 *
 * Flow: create campaign (if not exists) → add leads → activate. Instantly
 * handles warmup, SPF/DKIM, rotation, bounce management automatically.
 */

const BASE = 'https://api.instantly.ai/api/v2'

export function isConfigured(): boolean {
  return !!process.env.INSTANTLY_API_KEY
}

async function call<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
  const key = process.env.INSTANTLY_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      console.warn(`[instantly] ${method} ${path} ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.warn('[instantly] fetch error', (e as Error).message.slice(0, 120))
    return null
  }
}

export async function createCampaign(opts: {
  name: string
  subject: string
  body: string                      // HTML or plain; Instantly supports {{variables}}
  dailyLimit?: number               // default 50 (safe warmup)
}): Promise<{ id: string } | null> {
  return call<{ id: string }>('POST', '/campaigns', {
    name: opts.name,
    campaign_schedule: { timezone: 'Europe/Paris' },
    sequences: [{
      steps: [{
        type: 'email',
        subject: opts.subject,
        body: opts.body,
      }],
    }],
    daily_limit: opts.dailyLimit ?? 50,
  })
}

export async function addLeadsToCampaign(campaignId: string, leads: Array<{
  email: string
  first_name?: string
  last_name?: string
  company_name?: string
  personalization?: string         // custom variable {{personalization}}
  variables?: Record<string, string>
}>): Promise<{ added: number } | null> {
  return call<{ added: number }>('POST', `/campaigns/${campaignId}/leads`, {
    leads,
    skip_if_in_workspace: true,
  })
}

export async function activateCampaign(campaignId: string): Promise<boolean> {
  const res = await call<{ ok?: boolean }>('POST', `/campaigns/${campaignId}/activate`, {})
  return !!res
}

export async function getCampaignAnalytics(campaignId: string) {
  return call<{
    sent: number; opened: number; clicked: number; replied: number;
    bounced: number; unsubscribed: number;
  }>('GET', `/campaigns/${campaignId}/analytics`)
}
