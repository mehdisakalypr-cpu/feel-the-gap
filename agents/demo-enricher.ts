/**
 * demo-enricher — Pipeline auto contact enrichment from leads vault.
 *
 * Pulls validated emails (and phones) from the leads vault into either
 *   - public.commerce_leads (target='leads'): 388k FR+GB legal entities
 *     covered by vault.gapup_leads.lv_companies (Sirene + Companies House)
 *   - public.entrepreneur_demos (target='demos'): 42k entrepreneur demos,
 *     mostly emerging-market countries — vault covers ~0 today, run for
 *     forward-compat once vault gets emerging-market connectors.
 *
 * The enrichment chain (CH officers, INPI dirigeants, email-permutator,
 * mailscout) is the existing leads-vault crons. This agent is the glue.
 *
 * Strategy (match-only, fast):
 *   1. SELECT target rows WHERE email IS NULL AND country_iso ∈ countries
 *   2. ILIKE-match vault lv_companies on legal_name OR trade_name + country
 *   3. ILIKE-match lv_persons on full_name within the company (or fallback
 *      to highest-scored decision_maker for the company)
 *   4. Pick highest-scored email from lv_contacts
 *   5. UPDATE target row + upsert entrepreneurs_directory (best-effort)
 *
 * Coverage stats are returned per-step so we know where the funnel breaks
 * (no_company / no_domain / no_person / no_email).
 *
 * Two entry points:
 *   - CLI:  npx tsx agents/demo-enricher.ts [--apply] [--limit=200] [--target=leads] [--country=FR,GB]
 *   - HTTP: import { runDemoEnricher } from '@/agents/demo-enricher'
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type EnrichTarget = 'leads' | 'demos'

// ISO-3166 alpha-2 (commerce_leads) ↔ alpha-3 (vault, entrepreneur_demos)
const ISO2_TO_ISO3: Record<string, string> = {
  FR: 'FRA', GB: 'GBR', DE: 'DEU', ES: 'ESP', IT: 'ITA', NL: 'NLD',
  BE: 'BEL', PT: 'PRT', IE: 'IRL', LU: 'LUX', AT: 'AUT', PL: 'POL',
  US: 'USA', CA: 'CAN', AU: 'AUS', NZ: 'NZL', CH: 'CHE', SE: 'SWE',
  DK: 'DNK', NO: 'NOR', FI: 'FIN', CZ: 'CZE', EE: 'EST',
}
function iso2to3(c: string): string { return ISO2_TO_ISO3[c.toUpperCase()] ?? c.toUpperCase() }

type TargetRow = {
  id: string
  full_name?: string | null
  business_name?: string | null
  company_name?: string | null
  country_iso: string | null
  email: string | null
}

type CompanyRow = { id: string; legal_name: string; trade_name: string | null; domain: string | null }
type PersonRow = { id: string; full_name: string; first_name: string | null; last_name: string | null }
type ContactRow = { contact_value: string; verify_status: string | null; verify_score: number | null }

export type DemoEnricherResult = {
  processed: number
  matched_company: number
  matched_company_no_domain: number
  matched_person: number
  pushed_email: number
  no_company: number
  no_person: number
  no_email: number
  errors: number
  mode: 'APPLY' | 'DRY-RUN'
  duration_ms: number
  reasons_sample: Array<{ demo_id: string; reason: string }>
}

const ESCAPE_RE = /[%_\\]/g

function escapeLike(s: string): string {
  return s.replace(ESCAPE_RE, '\\$&')
}

function normaliseName(s: string | null): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltd|limited|llc|sas|sasu|sarl|sa|gmbh|inc|plc|llp|s\.?a\.?s\.?|s\.?a\.?r\.?l\.?)\b\.?/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function matchCompany(
  vault: SupabaseClient,
  companyName: string,
  countryIso3: string,
): Promise<CompanyRow | null> {
  const norm = normaliseName(companyName)
  if (norm.length < 3) return null

  // Take the first 32 chars of the normalised name as ILIKE needle to keep
  // long suffixes ("S.A.S au capital de…") from breaking the match.
  const needle = `%${escapeLike(norm.slice(0, 32))}%`

  // Prefer rows with a domain (those are usable downstream by email-permutator).
  const { data: withDomain } = await (vault.from as any)('lv_companies')
    .select('id, legal_name, trade_name, domain')
    .eq('country_iso', countryIso3)
    .not('domain', 'is', null)
    .or(`legal_name.ilike.${needle},trade_name.ilike.${needle}`)
    .limit(1)

  if (withDomain && withDomain.length > 0) return withDomain[0] as CompanyRow

  const { data: anyMatch } = await (vault.from as any)('lv_companies')
    .select('id, legal_name, trade_name, domain')
    .eq('country_iso', countryIso3)
    .or(`legal_name.ilike.${needle},trade_name.ilike.${needle}`)
    .limit(1)

  return (anyMatch && anyMatch.length > 0 ? (anyMatch[0] as CompanyRow) : null)
}

async function matchPerson(
  vault: SupabaseClient,
  companyId: string,
  fullName: string | null,
): Promise<PersonRow | null> {
  const norm = fullName ? normaliseName(fullName) : ''

  if (norm.length >= 3) {
    const needle = `%${escapeLike(norm)}%`
    const { data } = await (vault.from as any)('lv_persons')
      .select('id, full_name, first_name, last_name')
      .eq('company_id', companyId)
      .ilike('full_name', needle)
      .limit(1)

    if (data && data.length > 0) return data[0] as PersonRow
  }

  // Fallback: best decision-maker for the company.
  const { data: any2 } = await (vault.from as any)('lv_persons')
    .select('id, full_name, first_name, last_name')
    .eq('company_id', companyId)
    .order('decision_maker_score', { ascending: false, nullsFirst: false })
    .limit(1)

  return (any2 && any2.length > 0 ? (any2[0] as PersonRow) : null)
}

async function bestEmailForPerson(vault: SupabaseClient, personId: string): Promise<ContactRow | null> {
  const { data } = await (vault.from as any)('lv_contacts')
    .select('contact_value, verify_status, verify_score')
    .eq('person_id', personId)
    .eq('contact_type', 'email')
    .in('verify_status', ['valid', 'risky', 'unverified'])
    .order('verify_score', { ascending: false, nullsFirst: false })
    .limit(1)

  return (data && data.length > 0 ? (data[0] as ContactRow) : null)
}

async function bestEmailForCompany(vault: SupabaseClient, companyId: string): Promise<ContactRow | null> {
  // Falls back to a company-level email when no person email is available.
  const { data } = await (vault.from as any)('lv_contacts')
    .select('contact_value, verify_status, verify_score')
    .eq('company_id', companyId)
    .is('person_id', null)
    .eq('contact_type', 'email')
    .in('verify_status', ['valid', 'risky', 'unverified'])
    .order('verify_score', { ascending: false, nullsFirst: false })
    .limit(1)

  return (data && data.length > 0 ? (data[0] as ContactRow) : null)
}

type FetchedRow = {
  id: string
  name: string | null
  company: string | null
  domain: string | null
  country_iso2: string | null
  country_iso3: string
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null
  let s = url.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const slash = s.indexOf('/')
  if (slash >= 0) s = s.slice(0, slash)
  const colon = s.indexOf(':')
  if (colon >= 0) s = s.slice(0, colon)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null
  return s
}

async function fetchTargetRows(
  pub: SupabaseClient,
  target: EnrichTarget,
  countriesIso2: string[],
  limit: number,
): Promise<FetchedRow[]> {
  if (target === 'leads') {
    // Prioritise rows with website_url — domain match is far more precise than
    // ILIKE on business_name. Pull 2× limit then partition.
    const { data, error } = await pub
      .from('commerce_leads')
      .select('id, business_name, country_iso, website_url')
      .is('email', null)
      .in('country_iso', countriesIso2)
      .not('business_name', 'is', null)
      .order('website_url', { ascending: false, nullsFirst: false })
      .limit(limit * 2)
    if (error) throw new Error(`commerce_leads fetch: ${error.message}`)

    const mapped: FetchedRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      name: null,
      company: r.business_name as string | null,
      domain: extractDomain(r.website_url as string | null),
      country_iso2: r.country_iso as string | null,
      country_iso3: iso2to3((r.country_iso as string) ?? ''),
    }))
    // Keep first `limit`, with-domain rows naturally first thanks to ORDER BY.
    return mapped.slice(0, limit)
  }

  // demos
  const countriesIso3 = countriesIso2.map(iso2to3)
  const { data, error } = await pub
    .from('entrepreneur_demos')
    .select('id, full_name, company_name, country_iso')
    .is('email', null)
    .in('country_iso', countriesIso3)
    .not('company_name', 'is', null)
    .not('full_name', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`entrepreneur_demos fetch: ${error.message}`)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.full_name as string | null,
    company: r.company_name as string | null,
    domain: null,
    country_iso2: null,
    country_iso3: (r.country_iso as string) ?? '',
  }))
}

async function matchCompanyByDomain(
  vault: SupabaseClient,
  domain: string,
): Promise<CompanyRow | null> {
  const { data } = await (vault.from as any)('lv_companies')
    .select('id, legal_name, trade_name, domain')
    .eq('domain', domain)
    .limit(1)
  if (data && data.length > 0) return data[0] as CompanyRow
  // Try without subdomain (e.g. shop.acme.com → acme.com)
  const parts = domain.split('.')
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.')
    const { data: d2 } = await (vault.from as any)('lv_companies')
      .select('id, legal_name, trade_name, domain')
      .eq('domain', root)
      .limit(1)
    if (d2 && d2.length > 0) return d2[0] as CompanyRow
  }
  return null
}

async function applyEmail(
  pub: SupabaseClient,
  target: EnrichTarget,
  rowId: string,
  email: string,
  personName: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const table = target === 'leads' ? 'commerce_leads' : 'entrepreneur_demos'
  const patch: Record<string, unknown> = { email, updated_at: new Date().toISOString() }
  if (target === 'leads' && personName) patch.contact_owner_name = personName
  const { error } = await pub.from(table).update(patch).eq('id', rowId).is('email', null)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function runDemoEnricher(
  opts: {
    apply?: boolean
    limit?: number
    countries?: string[]
    target?: EnrichTarget
  } = {},
): Promise<DemoEnricherResult> {
  const t0 = Date.now()
  const apply = opts.apply ?? false
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500)
  const target: EnrichTarget = opts.target ?? 'leads'
  const countries = (opts.countries && opts.countries.length > 0)
    ? opts.countries.map((c) => c.trim().toUpperCase()).filter(Boolean)
    : ['FR', 'GB']

  const result: DemoEnricherResult = {
    processed: 0,
    matched_company: 0,
    matched_company_no_domain: 0,
    matched_person: 0,
    pushed_email: 0,
    no_company: 0,
    no_person: 0,
    no_email: 0,
    errors: 0,
    mode: apply ? 'APPLY' : 'DRY-RUN',
    duration_ms: 0,
    reasons_sample: [],
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const pub = createClient(supaUrl, supaKey, { auth: { persistSession: false } })
  const vault = createClient(supaUrl, supaKey, {
    auth: { persistSession: false },
    db: { schema: 'gapup_leads' },
  }) as unknown as SupabaseClient

  let rows: FetchedRow[] = []
  try {
    rows = await fetchTargetRows(pub, target, countries, limit)
  } catch (err) {
    result.errors += 1
    result.duration_ms = Date.now() - t0
    console.error('[demo-enricher] fetch error:', err instanceof Error ? err.message : err)
    return result
  }

  console.log(`[demo-enricher] mode=${result.mode} target=${target} countries=${countries.join(',')} rows_to_process=${rows.length}`)

  const sampleCap = 8

  for (const row of rows) {
    result.processed += 1
    if (!row.company || !row.country_iso3) {
      result.no_company += 1
      continue
    }

    try {
      // 1. Domain match first (precise, single-row vault hit).
      let company: CompanyRow | null = row.domain ? await matchCompanyByDomain(vault, row.domain) : null
      // 2. Fallback to name+country match.
      if (!company) company = await matchCompany(vault, row.company, row.country_iso3)
      if (!company) {
        result.no_company += 1
        if (result.reasons_sample.length < sampleCap) {
          result.reasons_sample.push({ demo_id: row.id, reason: `no_company_match("${row.company.slice(0, 40)}")` })
        }
        continue
      }
      result.matched_company += 1

      if (!company.domain) {
        result.matched_company_no_domain += 1
      }

      const person = await matchPerson(vault, company.id, row.name)

      let contact: ContactRow | null = null
      if (person) {
        result.matched_person += 1
        contact = await bestEmailForPerson(vault, person.id)
      }

      // Fall back to company-level email if no person-bound contact found.
      if (!contact) contact = await bestEmailForCompany(vault, company.id)

      if (!contact) {
        if (!person) {
          result.no_person += 1
          if (result.reasons_sample.length < sampleCap) {
            result.reasons_sample.push({ demo_id: row.id, reason: `no_person_for_company_${company.id}` })
          }
        } else {
          result.no_email += 1
          if (result.reasons_sample.length < sampleCap) {
            result.reasons_sample.push({ demo_id: row.id, reason: `no_email_for_person_${person.id}` })
          }
        }
        continue
      }

      if (apply) {
        const upd = await applyEmail(pub, target, row.id, contact.contact_value, person?.full_name ?? null)
        if (!upd.ok) {
          result.errors += 1
          console.error(`[demo-enricher] update ${target}.${row.id} failed:`, upd.error)
          continue
        }

        // Best-effort directory upsert so demos for the same person inherit later.
        if (target === 'demos' && row.name) {
          await pub
            .from('entrepreneurs_directory')
            .upsert({
              name: row.name,
              country_iso: row.country_iso3,
              email: contact.contact_value,
              source: 'demo_enricher_vault',
              verified: contact.verify_status === 'valid',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'name,country_iso' })
            .then(({ error: dirErr }) => {
              if (dirErr) console.warn(`[demo-enricher] directory upsert failed for ${row.id}: ${dirErr.message}`)
            })
        }
      }

      result.pushed_email += 1
    } catch (err) {
      result.errors += 1
      console.error(`[demo-enricher] row ${row.id} threw:`, err instanceof Error ? err.message : String(err))
    }
  }

  result.duration_ms = Date.now() - t0
  console.log(`[demo-enricher] done in ${result.duration_ms}ms`, {
    processed: result.processed,
    pushed_email: result.pushed_email,
    matched_company: result.matched_company,
    matched_person: result.matched_person,
    no_company: result.no_company,
    no_person: result.no_person,
    no_email: result.no_email,
  })
  return result
}

// ── CLI ─────────────────────────────────────────────────────────────────────
async function cli() {
  // Lazy-load dotenv so the route handler path doesn't pull it.
  const { config } = await import('dotenv')
  const { resolve } = await import('path')
  config({ path: resolve(process.cwd(), '.env.local') })

  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const limitArg = argv.find((a) => a.startsWith('--limit='))
  const countriesArg = argv.find((a) => a.startsWith('--country='))
  const targetArg = argv.find((a) => a.startsWith('--target='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 100
  const countries = countriesArg ? countriesArg.split('=')[1].split(',') : undefined
  const target = (targetArg ? targetArg.split('=')[1] : 'leads') as EnrichTarget

  const r = await runDemoEnricher({ apply, limit, countries, target })
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.errors > 0 ? 1 : 0)
}

const isDirectRun =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module

if (isDirectRun) {
  cli().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
