/**
 * Apollo.io adapter — ingests People search results into ftg_leads.
 *
 * Ready-to-key: activates when APOLLO_API_KEY is set in env. Until then,
 * isConfigured() returns false and callers fall through to other sources.
 *
 * Pricing context: Basic $49/mo = 1k email credits + unlimited search.
 * Each `searchPeople` call = free. Each `peopleMatch` (email reveal) = 1 credit.
 * Docs: https://apolloio.github.io/apollo-api-docs
 */

const BASE = 'https://api.apollo.io/api/v1'

export interface ApolloPerson {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  title?: string
  linkedin_url?: string
  email?: string
  email_status?: string  // 'verified' | 'guessed' | null
  organization?: {
    name?: string
    website_url?: string
    primary_domain?: string
    estimated_num_employees?: number
    industry?: string
    country?: string
  }
  city?: string
  state?: string
  country?: string
}

export interface ApolloSearchOptions {
  person_titles?: string[]         // ['Founder', 'CEO', 'Head of Trade']
  person_seniorities?: string[]    // ['founder', 'c_level', 'director']
  organization_locations?: string[]  // country codes
  keywords?: string                 // 'import export trade commodity'
  page?: number
  per_page?: number  // max 100 per page
}

export function isConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY
}

async function fetchApollo<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const key = process.env.APOLLO_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': key,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[apollo] ${path} ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.warn('[apollo] fetch error', (e as Error).message.slice(0, 120))
    return null
  }
}

/**
 * Search People matching our ICP (entrepreneurs + traders + investors
 * signaling interest in import/export/commodities).
 */
export async function searchPeople(opts: ApolloSearchOptions): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = {
    page: opts.page ?? 1,
    per_page: Math.min(opts.per_page ?? 25, 100),
  }
  if (opts.person_titles?.length) body.person_titles = opts.person_titles
  if (opts.person_seniorities?.length) body.person_seniorities = opts.person_seniorities
  if (opts.organization_locations?.length) body.organization_locations = opts.organization_locations
  if (opts.keywords) body.q_keywords = opts.keywords

  const res = await fetchApollo<{ people?: ApolloPerson[] }>('/mixed_people/search', body)
  return res?.people ?? []
}

/**
 * Translate an Apollo person to the ftg_leads row shape (for upsert).
 */
export function toFtgLeadRow(p: ApolloPerson, country_iso3?: string) {
  return {
    source: 'apollo' as const,
    source_external_id: p.id,
    source_payload: p,
    email: p.email ?? null,
    linkedin_url: p.linkedin_url ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    full_name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
    title: p.title ?? null,
    company_name: p.organization?.name ?? null,
    company_domain: p.organization?.primary_domain ?? null,
    company_size_range: p.organization?.estimated_num_employees
      ? rangeBucket(p.organization.estimated_num_employees)
      : null,
    company_country_iso: country_iso3 ?? null,
    verification_status: p.email_status === 'verified' ? 'valid' : (p.email ? 'unknown' : null),
    verification_provider: 'apollo',
    status: p.email ? 'enriched' : 'sourced',
  }
}

function rangeBucket(n: number): string {
  if (n < 10) return '1-10'
  if (n < 50) return '11-50'
  if (n < 200) return '51-200'
  if (n < 1000) return '201-1000'
  if (n < 5000) return '1001-5000'
  return '5000+'
}
