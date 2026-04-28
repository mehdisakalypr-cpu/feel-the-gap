/**
 * Explorium connector — match + prospect discovery + contact enrichment.
 *
 * Phase A — discovery (low credit cost):
 *   1. Pick lv_companies WHERE domain IS NOT NULL AND no source_ids.explorium yet
 *   2. POST /v1/businesses/match (batch up to 50) → business_id per row
 *      → patch source_ids.explorium = business_id
 *   3. POST /v1/prospects with filters.business_id.values=[...] paginated
 *      → insert lv_persons (full_name, role, country/city) for each prospect
 *      → store explorium prospect_id in source_ids
 *
 * Phase B — contact enrichment (paid credits):
 *   4. POST /v1/prospects/enrichments/contacts_information for top decision makers
 *      → insert lv_contacts (email, phone) when present, verify_provider='explorium'
 *
 * Hard budget cap via env EXPLORIUM_BUDGET_CREDITS (default 1000).
 * The connector aborts as soon as the local credit counter (rough estimate
 * based on rows enriched) reaches the cap.
 *
 * Source: api.explorium.ai/v1, header `api_key: <KEY>`.
 */

import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { ConnectorOptions, LvCompanyInsert, LvPersonInsert, LvContactInsert, SyncResult } from '../types'

const BASE = 'https://api.explorium.ai/v1'
const UA = 'gapup-leads-vault/1.0'
const PROSPECT_PAGE_SIZE = 100
const MATCH_BATCH_SIZE = 50
const CONTACT_BATCH_SIZE = 50

interface MatchedBusiness {
  input: { name: string; domain: string | null }
  business_id: string | null
}

interface ProspectRow {
  prospect_id: string
  professional_email_hashed?: string
  first_name?: string
  last_name?: string
  full_name?: string
  job_title?: string
  job_department?: string
  job_seniority?: string
  business_id?: string
  country_name?: string
  region_name?: string
  city?: string
  linkedin?: string
}

interface ContactRow {
  prospect_id: string
  emails?: Array<{ email: string; type?: string }>
  phone_numbers?: Array<{ phone_number: string; type?: string }>
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function getKey(): string {
  const k = process.env.EXPLORIUM_API_KEY
  if (!k) throw new Error('EXPLORIUM_API_KEY missing')
  return k
}

async function explorium<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'api_key': getKey(),
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = (await res.text()).slice(0, 400)
    throw new Error(`explorium ${path} ${res.status}: ${txt}`)
  }
  return (await res.json()) as T
}

function seniorityBucket(seniority: string | undefined): LvPersonInsert['role_seniority'] {
  if (!seniority) return null
  const s = seniority.toLowerCase()
  if (/cxo|c-level|chief|founder|owner|president|ceo|cto|cfo|coo|cmo/.test(s)) return 'c-level'
  if (/vp|vice/.test(s)) return 'vp'
  if (/director|head/.test(s)) return 'director'
  if (/manager|lead|senior/.test(s)) return 'manager'
  return 'individual'
}

async function matchBatch(rows: Array<{ name: string; domain: string }>): Promise<MatchedBusiness[]> {
  const json = await explorium<{ matched_businesses: MatchedBusiness[] }>(
    '/businesses/match',
    { businesses_to_match: rows.map(r => ({ name: r.name, domain: r.domain })) },
  )
  return json.matched_businesses ?? []
}

async function discoverProspects(businessIds: string[], pageLimit: number): Promise<ProspectRow[]> {
  const out: ProspectRow[] = []
  let page = 1
  while (page <= pageLimit) {
    const resp = await explorium<{ data: ProspectRow[]; total_results?: number }>(
      '/prospects',
      {
        page_size: PROSPECT_PAGE_SIZE,
        page,
        mode: 'full',
        filters: { business_id: { values: businessIds } },
      },
    )
    const batch = resp.data ?? []
    out.push(...batch)
    if (batch.length < PROSPECT_PAGE_SIZE) break
    page++
    await sleep(150)
  }
  return out
}

async function enrichContacts(prospectIds: string[]): Promise<ContactRow[]> {
  const json = await explorium<{ data: ContactRow[] }>(
    '/prospects/enrichments/contacts_information',
    { prospect_ids: prospectIds },
  )
  return json.data ?? []
}

export async function runExploriumEnrich(opts: ConnectorOptions): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {},
  }

  const sb = vaultClient()
  const limit = opts.limit ?? 200
  const budget = parseInt(process.env.EXPLORIUM_BUDGET_CREDITS ?? '1000', 10)
  let creditsUsed = 0

  const { data: companies, error: selectErr } = await (sb as any)
    .from('lv_companies')
    .select('id, legal_name, domain, source_ids, country_iso')
    .not('domain', 'is', null)
    .neq('domain', '')
    .limit(limit)

  if (selectErr) {
    result.error = `select lv_companies: ${selectErr.message}`
    result.duration_ms = Date.now() - t0
    return result
  }

  type CompanyRow = { id: string; legal_name: string; domain: string; source_ids: Record<string, string>; country_iso: string }
  const todo = (companies ?? [])
    .filter((c: CompanyRow) => !c.source_ids?.explorium)
    .slice(0, limit) as CompanyRow[]

  console.log(`[explorium] candidates=${todo.length} budget=${budget}`)
  result.rows_processed = todo.length

  // Phase A — match in batches
  const idByCompany = new Map<string, string>()
  for (let i = 0; i < todo.length; i += MATCH_BATCH_SIZE) {
    if (creditsUsed >= budget) break
    const batch = todo.slice(i, i + MATCH_BATCH_SIZE)
    try {
      const matched = await matchBatch(
        batch.map(c => ({ name: c.legal_name, domain: c.domain })),
      )
      creditsUsed += batch.length
      for (let j = 0; j < matched.length; j++) {
        const c = batch[j]
        const m = matched[j]
        if (!m?.business_id) continue
        idByCompany.set(c.id, m.business_id)
        const merged = { ...(c.source_ids ?? {}), explorium: m.business_id }
        await (sb as any).from('lv_companies').update({ source_ids: merged }).eq('id', c.id)
        result.rows_updated++
      }
      if (opts.dryRun) console.log(`[explorium] dry-run match batch ${i}: ${matched.filter(m => m.business_id).length}/${batch.length}`)
      await sleep(200)
    } catch (e) {
      console.error(`[explorium] match batch ${i} failed:`, (e as Error).message)
      result.rows_skipped += batch.length
    }
  }

  console.log(`[explorium] phase A done: ${idByCompany.size}/${todo.length} matched, credits~${creditsUsed}`)

  if (opts.dryRun || idByCompany.size === 0) {
    result.metadata = { matched: idByCompany.size, credits_estimate: creditsUsed, mode: opts.dryRun ? 'dry-run' : 'no-match' }
    result.duration_ms = Date.now() - t0
    return result
  }

  // Phase B — discover prospects per company
  let totalPersons = 0
  let totalContacts = 0
  const personsToEnrich: Array<{ prospect_id: string; person_id: string }> = []

  const businessIds = Array.from(idByCompany.values())
  const companyByBiz = new Map<string, string>()
  for (const [cid, bid] of idByCompany.entries()) companyByBiz.set(bid, cid)

  for (let i = 0; i < businessIds.length; i += 25) {
    if (creditsUsed >= budget) break
    const slice = businessIds.slice(i, i + 25)
    try {
      const prospects = await discoverProspects(slice, 2)
      creditsUsed += Math.ceil(prospects.length / 10)
      for (const p of prospects) {
        const companyId = p.business_id ? companyByBiz.get(p.business_id) : undefined
        if (!companyId) continue
        const seniority = seniorityBucket(p.job_seniority)
        const personRow: LvPersonInsert = {
          company_id: companyId,
          full_name: p.full_name ?? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown'),
          first_name: p.first_name ?? null,
          last_name: p.last_name ?? null,
          role: p.job_title ?? null,
          role_seniority: seniority,
          decision_maker_score: seniority === 'c-level' ? 95 : seniority === 'vp' ? 85 : seniority === 'director' ? 75 : seniority === 'manager' ? 55 : 30,
          linkedin_url: p.linkedin ?? null,
          primary_source: 'explorium',
        }
        const { data: inserted } = await (sb as any)
          .from('lv_persons')
          .upsert(
            { ...personRow, source_ids: { explorium: p.prospect_id } },
            { onConflict: 'source_ids->explorium', ignoreDuplicates: false },
          )
          .select('id')
          .maybeSingle()
        const personId = inserted?.id
        if (personId) {
          totalPersons++
          if ((personRow.decision_maker_score ?? 0) >= 75) {
            personsToEnrich.push({ prospect_id: p.prospect_id, person_id: personId })
          }
        }
      }
      await sleep(200)
    } catch (e) {
      console.error(`[explorium] prospects batch ${i} failed:`, (e as Error).message)
    }
  }

  console.log(`[explorium] phase B done: persons=${totalPersons}, decision-makers queued=${personsToEnrich.length}, credits~${creditsUsed}`)

  // Phase C — contact enrichment for decision makers (capped)
  const remainingBudget = Math.max(0, budget - creditsUsed)
  const contactCap = Math.min(personsToEnrich.length, Math.floor(remainingBudget / 5))
  for (let i = 0; i < contactCap; i += CONTACT_BATCH_SIZE) {
    const slice = personsToEnrich.slice(i, i + CONTACT_BATCH_SIZE)
    try {
      const contacts = await enrichContacts(slice.map(s => s.prospect_id))
      creditsUsed += slice.length * 5
      const byProspect = new Map<string, ContactRow>()
      for (const c of contacts) byProspect.set(c.prospect_id, c)

      for (const s of slice) {
        const c = byProspect.get(s.prospect_id)
        if (!c) continue
        const inserts: LvContactInsert[] = []
        for (const e of c.emails ?? []) {
          if (!e.email) continue
          inserts.push({
            person_id: s.person_id,
            contact_type: 'email',
            contact_value: e.email,
            verify_status: 'unverified',
            verify_provider: 'explorium',
            primary_source: 'explorium',
          })
        }
        for (const ph of c.phone_numbers ?? []) {
          if (!ph.phone_number) continue
          inserts.push({
            person_id: s.person_id,
            contact_type: 'phone',
            contact_value: ph.phone_number,
            verify_provider: 'explorium',
            primary_source: 'explorium',
          })
        }
        if (inserts.length > 0) {
          const { error: upErr } = await (sb as any).from('lv_contacts').insert(inserts)
          if (!upErr) totalContacts += inserts.length
        }
      }
      await sleep(200)
    } catch (e) {
      console.error(`[explorium] contacts batch ${i} failed:`, (e as Error).message)
    }
  }

  result.rows_inserted = totalPersons + totalContacts
  result.metadata = {
    companies_matched: idByCompany.size,
    persons_inserted: totalPersons,
    contacts_inserted: totalContacts,
    credits_estimate: creditsUsed,
    budget,
  }
  result.duration_ms = Date.now() - t0

  await logSync('explorium', result)
  await bumpSourceStock('explorium', result.rows_inserted)

  console.log(
    `[explorium] DONE matched=${idByCompany.size} persons=${totalPersons} contacts=${totalContacts} credits~${creditsUsed}/${budget}`,
  )
  return result
}
