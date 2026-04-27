/**
 * EU Directories enrichment connector
 *
 * Enriches lv_companies with phone + email by querying public B2B directories:
 *   - PagesJaunes FR  (FRA)
 *   - Das Örtliche DE (DEU)
 *   - Europages EU    (FRA + DEU + BEL + NLD + others)
 *   - Kompass         (experimental, disabled by default)
 *
 * Throttle: 1 req/sec/directory, polite robots.txt respect
 * UA: gapup-leadvault/1.0 (+https://gapup.io/bot)
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { ConnectorOptions, SyncResult, LvContactInsert } from '../types'
import * as PagesJaunesFr from './directories/pagesjaunes-fr'
import * as Europages from './directories/europages'
import * as GoldenPagesDe from './directories/goldenpages-de'
import * as Kompass from './directories/kompass'
import type { DirectoryHit } from './directories/types'
import { throttle } from './directories/types'

const SUPPORTED_COUNTRIES = ['FRA', 'DEU', 'BEL', 'GBR', 'ITA', 'ESP', 'NLD', 'PRT', 'AUT', 'POL']

const DIRECTORY_INTER_QUERY_MS = 1200

type CompanyRow = {
  id: string
  legal_name: string
  country_iso: string
  city: string | null
  address: string | null
  domain: string | null
}

async function fetchPendingCompanies(sb: ReturnType<typeof vaultClient>, limit: number): Promise<CompanyRow[]> {
  // Fetch already-probed company IDs first (anti-dup)
  const { data: probed } = await (sb.from as any)('directory_probe_log')
    .select('company_id')
    .limit(50000)
  const probedIds: string[] = (probed ?? []).map((r: { company_id: string }) => r.company_id).filter(Boolean)

  let query = (sb.from as any)('lv_companies')
    .select('id, legal_name, country_iso, city, address, domain')
    .in('country_iso', SUPPORTED_COUNTRIES)
    .not('legal_name', 'is', null)

  if (probedIds.length > 0) {
    query = query.not('id', 'in', `(${probedIds.map((id) => `"${id}"`).join(',')})`)
  }

  const { data, error } = await query.limit(limit)

  if (error) {
    console.error('[dir-eu] fetch pending error:', error.message)
    return []
  }
  return (data ?? []) as CompanyRow[]
}

async function recordProbe(
  sb: ReturnType<typeof vaultClient>,
  companyId: string,
  directory: string,
  found: boolean,
  hitsCount: number,
): Promise<void> {
  await (sb.from as any)('directory_probe_log').upsert(
    { company_id: companyId, directory, found, hits_count: hitsCount },
    { onConflict: 'company_id,directory', ignoreDuplicates: false },
  )
}

async function upsertContact(
  sb: ReturnType<typeof vaultClient>,
  companyId: string,
  contactType: 'phone' | 'email',
  contactValue: string,
  source: string,
): Promise<boolean> {
  const sourceId = source === 'pagesjaunes' ? 'pagesjaunes'
    : source === 'europages' ? 'europages'
    : source === 'goldenpages' ? 'goldenpages'
    : source === 'kompass' ? 'kompass'
    : 'directories_eu'

  const contact: LvContactInsert = {
    company_id: companyId,
    contact_type: contactType,
    contact_value: contactValue.trim(),
    is_personal: false,
    verify_status: 'unverified',
    primary_source: sourceId,
  }
  const { error } = await (sb.from as any)('lv_contacts').upsert(
    contact,
    { onConflict: 'contact_value,contact_type', ignoreDuplicates: true },
  )
  if (error) {
    console.warn(`[dir-eu] contact upsert error: ${error.message}`)
    return false
  }
  return true
}

async function applyBestHit(
  sb: ReturnType<typeof vaultClient>,
  company: CompanyRow,
  hits: DirectoryHit[],
  source: string,
): Promise<{ contacts: number; updated: boolean }> {
  if (hits.length === 0) return { contacts: 0, updated: false }

  const best = hits.sort((a, b) => b.match_score - a.match_score)[0]
  let contacts = 0
  let updated = false

  if (best.phone) {
    const ok = await upsertContact(sb, company.id, 'phone', best.phone, source)
    if (ok) contacts++
  }
  if (best.email) {
    const ok = await upsertContact(sb, company.id, 'email', best.email, source)
    if (ok) contacts++
  }

  const patch: Record<string, string | null> = {}
  if (!company.city && best.city) patch.city = best.city
  if (!company.address && best.address) patch.address = best.address
  if (!company.domain && best.website) patch.domain = best.website

  if (Object.keys(patch).length > 0) {
    await (sb.from as any)('lv_companies').update(patch).eq('id', company.id)
    updated = true
  }

  return { contacts, updated }
}

export async function runDirectoriesEu(opts: ConnectorOptions & { enableKompass?: boolean } = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { contacts_inserted: 0, companies_updated: 0, by_directory: {} as Record<string, number> },
  }

  const limit = opts.limit ?? 200
  const enableKompass = opts.enableKompass ?? false
  const dirOpts = { enableKompass }

  try {
    const sb = vaultClient()
    const companies = await fetchPendingCompanies(sb, limit)
    console.log(`[dir-eu] ${companies.length} companies to enrich`)

    for (const company of companies) {
      result.rows_processed++
      const { legal_name, country_iso, city } = company
      const directories = chooseDirectories(country_iso, enableKompass)

      let anyHit = false

      for (const dir of directories) {
        let hits: DirectoryHit[] = []

        try {
          hits = await searchDirectory(dir, legal_name, country_iso, city, dirOpts)
          await throttle(DIRECTORY_INTER_QUERY_MS)
        } catch (err) {
          console.warn(`[dir-eu] ${dir} error for "${legal_name}": ${(err as Error).message}`)
          continue
        }

        const best = hits.filter((h) => h.match_score >= 65)

        if (!opts.dryRun) {
          await recordProbe(sb, company.id, dir, best.length > 0, best.length)
          const { contacts, updated } = await applyBestHit(sb, company, best, dir)

          if (contacts > 0 || updated) {
            anyHit = true
            result.rows_inserted += contacts
            if (updated) result.rows_updated++
            ;(result.metadata!.contacts_inserted as number) += contacts
            if (updated) (result.metadata!.companies_updated as number)++
            const byDir = result.metadata!.by_directory as Record<string, number>
            byDir[dir] = (byDir[dir] ?? 0) + contacts
          }
        } else {
          const validHits = hits.filter((h) => h.match_score >= 65 && (h.phone || h.email))
          if (validHits.length > 0) {
            anyHit = true
            console.log(`[dir-eu] dry-run hit [${dir}] "${legal_name}" → phone=${validHits[0].phone} email=${validHits[0].email} score=${validHits[0].match_score}`)
            result.rows_inserted += validHits.length
          }
        }
      }

      if (!anyHit) result.rows_skipped++

      if (opts.limit && result.rows_processed >= opts.limit) break
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'directories_eu', operation: 'delta', result })
    }
  }

  return result
}

function chooseDirectories(countryIso: string, enableKompass: boolean): string[] {
  const dirs: string[] = []
  switch (countryIso) {
    case 'FRA':
      dirs.push('pagesjaunes', 'europages')
      break
    case 'DEU':
      dirs.push('goldenpages', 'europages')
      break
    case 'BEL':
    case 'NLD':
      dirs.push('europages')
      if (enableKompass) dirs.push('kompass')
      break
    default:
      dirs.push('europages')
      if (enableKompass) dirs.push('kompass')
  }
  return dirs
}

async function searchDirectory(
  dir: string,
  legalName: string,
  countryIso: string,
  city: string | null,
  opts: { enableKompass?: boolean },
): Promise<DirectoryHit[]> {
  switch (dir) {
    case 'pagesjaunes':
      return PagesJaunesFr.searchByName(legalName, city, opts)
    case 'europages':
      return Europages.searchByName(legalName, countryIso, opts)
    case 'goldenpages':
      return GoldenPagesDe.searchByName(legalName, city, opts)
    case 'kompass':
      return Kompass.searchByName(legalName, countryIso, opts)
    default:
      return []
  }
}
