/**
 * Apify connectors — Google Maps + LinkedIn Company scrapers via Apify API.
 *
 * Pricing model (FREE plan, $5 platform credits/mo):
 *   - We call run-sync-get-dataset-items which charges by actor compute units.
 *   - Hard budget cap via APIFY_BUDGET_USD_PER_RUN (default $4 per run).
 *   - Uses the user's APIFY_API_TOKEN.
 *
 * Actor IDs (April 2026):
 *   - compass/crawler-google-places         — Google Maps with email scraping
 *   - harvestapi/linkedin-company-scraper   — LinkedIn Company data
 *
 * The connectors push results into lv_companies / lv_persons / lv_contacts
 * with primary_source = 'apify_gmaps' or 'apify_linkedin'.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { ConnectorOptions, LvCompanyInsert, LvContactInsert, SyncResult } from '../types'

const APIFY_BASE = 'https://api.apify.com/v2'
const UA = 'gapup-leads-vault/1.0'

function getToken(): string {
  const t = process.env.APIFY_API_TOKEN
  if (!t) throw new Error('APIFY_API_TOKEN missing')
  return t
}

interface RunResponse {
  data: {
    id: string
    actId: string
    status: string
    defaultDatasetId: string
    stats: { computeUnits?: number }
    usage?: { ACTOR_COMPUTE_UNITS?: number }
    usageTotalUsd?: number
  }
}

interface DatasetItem {
  [key: string]: unknown
}

async function runActor(
  actorId: string,
  input: Record<string, unknown>,
  budgetUsd: number,
): Promise<{ items: DatasetItem[]; usageUsd: number; runId: string }> {
  const token = getToken()
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify(input),
    },
  )
  if (!startRes.ok) {
    const txt = (await startRes.text()).slice(0, 400)
    throw new Error(`apify start ${actorId} ${startRes.status}: ${txt}`)
  }
  const startJson = (await startRes.json()) as RunResponse
  const runId = startJson.data.id
  const datasetId = startJson.data.defaultDatasetId

  const start = Date.now()
  const TIMEOUT_MS = 8 * 60 * 1000
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 6000))
    const statRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    if (!statRes.ok) continue
    const stat = (await statRes.json()) as RunResponse
    const status = stat.data.status
    const usage = stat.data.usageTotalUsd ?? 0
    if (usage > budgetUsd) {
      await fetch(`${APIFY_BASE}/actor-runs/${runId}/abort?token=${token}`, { method: 'POST' })
      console.log(`[apify] ABORTED run=${runId} usage=$${usage} > budget=$${budgetUsd}`)
      break
    }
    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') break
  }

  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&clean=true`,
  )
  if (!itemsRes.ok) {
    const txt = (await itemsRes.text()).slice(0, 200)
    throw new Error(`apify items ${itemsRes.status}: ${txt}`)
  }
  const items = (await itemsRes.json()) as DatasetItem[]

  const finalStat = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null) as RunResponse | null
  const usageUsd = finalStat?.data?.usageTotalUsd ?? 0
  return { items, usageUsd, runId }
}

interface GmapsActorOptions {
  searchStringsArray?: string[]
  locationQuery?: string
  maxCrawledPlacesPerSearch?: number
  scrapeContacts?: boolean
}

export async function runApifyGmaps(opts: ConnectorOptions & {
  searches?: string[]
  location?: string
}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_skipped: 0, duration_ms: 0,
    metadata: {},
  }
  const sb = vaultClient()

  const searches = opts.searches ?? ['boutique', 'cabinet', 'agency', 'shop']
  const location = opts.location ?? 'Paris, France'
  const maxPerSearch = Math.min(opts.limit ?? 100, 200)
  const budget = parseFloat(process.env.APIFY_BUDGET_USD_PER_RUN ?? '4')

  const input: GmapsActorOptions = {
    searchStringsArray: searches,
    locationQuery: location,
    maxCrawledPlacesPerSearch: maxPerSearch,
    scrapeContacts: true,
  }

  let items: DatasetItem[] = []
  let usage = 0
  try {
    const out = await runActor('compass/crawler-google-places', input as Record<string, unknown>, budget)
    items = out.items
    usage = out.usageUsd
  } catch (e) {
    result.error = (e as Error).message
    result.duration_ms = Date.now() - t0
    return result
  }

  result.rows_processed = items.length
  for (const it of items) {
    const place = it as {
      title?: string
      website?: string
      url?: string
      phone?: string
      emails?: string[]
      city?: string
      countryCode?: string
      address?: string
      categoryName?: string
    }
    if (!place.title) { result.rows_skipped++; continue }
    let domain: string | null = null
    try {
      if (place.website) {
        domain = new URL(place.website.startsWith('http') ? place.website : `https://${place.website}`).hostname.replace(/^www\./, '')
      }
    } catch {}
    const company: LvCompanyInsert = {
      legal_name: place.title,
      trade_name: place.title,
      domain,
      country_iso: (place.countryCode ?? 'FRA').toUpperCase().slice(0, 3).padEnd(3, 'A'),
      city: place.city ?? null,
      address: place.address ?? null,
      industry_tags: place.categoryName ? [place.categoryName] : [],
      primary_source: 'apify_gmaps',
      enrichment_score: 6,
    }
    const { data: inserted } = await (sb as any)
      .from('lv_companies')
      .upsert(company, { onConflict: 'legal_name,country_iso', ignoreDuplicates: false })
      .select('id')
      .maybeSingle()
    const companyId = inserted?.id
    if (!companyId) { result.rows_skipped++; continue }
    result.rows_inserted++

    const contacts: LvContactInsert[] = []
    for (const email of place.emails ?? []) {
      if (!email) continue
      contacts.push({
        company_id: companyId,
        contact_type: 'email',
        contact_value: email,
        verify_status: 'unverified',
        verify_provider: 'apify_gmaps',
        primary_source: 'apify_gmaps',
      })
    }
    if (place.phone) {
      contacts.push({
        company_id: companyId,
        contact_type: 'phone',
        contact_value: place.phone,
        verify_provider: 'apify_gmaps',
        primary_source: 'apify_gmaps',
      })
    }
    if (contacts.length > 0) await (sb as any).from('lv_contacts').insert(contacts)
  }

  result.metadata = {
    actor: 'compass/crawler-google-places',
    searches,
    location,
    usage_usd: usage,
    budget_usd: budget,
  }
  result.duration_ms = Date.now() - t0
  await logSync('apify_gmaps', result)
  await bumpSourceStock('apify_gmaps', result.rows_inserted)
  console.log(`[apify-gmaps] inserted=${result.rows_inserted}/${result.rows_processed} usage=$${usage}/$${budget}`)
  return result
}

export async function runApifyLinkedinCompany(opts: ConnectorOptions & {
  domains?: string[]
}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_skipped: 0, duration_ms: 0,
    metadata: {},
  }
  const sb = vaultClient()
  const budget = parseFloat(process.env.APIFY_BUDGET_USD_PER_RUN ?? '4')

  let domains = opts.domains
  if (!domains || domains.length === 0) {
    const lim = Math.min(opts.limit ?? 100, 200)
    const { data } = await (sb as any)
      .from('lv_companies')
      .select('domain')
      .not('domain', 'is', null)
      .neq('domain', '')
      .limit(lim)
    domains = ((data ?? []) as { domain: string }[]).map((r) => r.domain)
  }

  if (!domains || domains.length === 0) {
    result.metadata = { reason: 'no domains' }
    return result
  }

  const input = { companies: domains.map(d => ({ url: `https://www.linkedin.com/company/${d.split('.')[0]}` })) }
  let items: DatasetItem[] = []
  let usage = 0
  try {
    const out = await runActor('harvestapi/linkedin-company-scraper', input as Record<string, unknown>, budget)
    items = out.items
    usage = out.usageUsd
  } catch (e) {
    result.error = (e as Error).message
    result.duration_ms = Date.now() - t0
    return result
  }

  result.rows_processed = items.length
  for (const it of items) {
    const co = it as {
      name?: string
      website?: string
      industry?: string
      employees?: number
      country?: string
      headquarter?: string
      linkedinUrl?: string
      tagline?: string
    }
    if (!co.name) { result.rows_skipped++; continue }
    let domain: string | null = null
    try {
      if (co.website) {
        domain = new URL(co.website.startsWith('http') ? co.website : `https://${co.website}`).hostname.replace(/^www\./, '')
      }
    } catch {}
    const company: LvCompanyInsert = {
      legal_name: co.name,
      domain,
      country_iso: (co.country ?? 'USA').toUpperCase().slice(0, 3).padEnd(3, 'A'),
      city: co.headquarter ?? null,
      industry_tags: co.industry ? [co.industry] : [],
      employees_estimate: co.employees ?? null,
      primary_source: 'apify_linkedin',
      enrichment_score: 7,
    }
    const { data: inserted } = await (sb as any)
      .from('lv_companies')
      .upsert(company, { onConflict: 'domain', ignoreDuplicates: false })
      .select('id')
      .maybeSingle()
    if (inserted?.id) result.rows_inserted++
    else result.rows_skipped++
  }

  result.metadata = {
    actor: 'harvestapi/linkedin-company-scraper',
    domains_input: domains.length,
    usage_usd: usage,
    budget_usd: budget,
  }
  result.duration_ms = Date.now() - t0
  await logSync('apify_linkedin', result)
  await bumpSourceStock('apify_linkedin', result.rows_inserted)
  console.log(`[apify-linkedin] inserted=${result.rows_inserted}/${result.rows_processed} usage=$${usage}/$${budget}`)
  return result
}
