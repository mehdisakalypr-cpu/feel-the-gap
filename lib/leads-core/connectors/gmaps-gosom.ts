/**
 * GMaps enrichment via gosom/google-maps-scraper (OSS Go binary)
 *
 * Source  : https://github.com/gosom/google-maps-scraper
 * Auth    : none (stealth Playwright, respectful rate-limiting via gosom internals)
 * Yield   : ~5M phones B2B on commercial POIs (restaurants, services, retail, etc.)
 *
 * Strategy :
 *   1. Verify gosom binary at /usr/local/bin/google-maps-scraper (or attempt build if Go available)
 *   2. Cursor lv_companies WHERE phone contact missing AND city IS NOT NULL AND eligible country
 *   3. Group by (city, nace_code) → build keyword queries e.g. "restaurants in Paris, France"
 *   4. Run gosom binary per batch of queries → parse JSON Lines output
 *   5. Fuzzy match POI name ↔ lv_companies.legal_name (Levenshtein >= 0.70)
 *   6. Insert lv_contacts (phone) + update lv_companies (address, lat, lng)
 *   7. Unmatched POIs → insert as new lv_companies (primary_source='gmaps')
 *   8. 30s throttle between query groups
 */

import { execFile as _execFile, execSync } from 'child_process'
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { createInterface } from 'readline'
import * as leven from 'fast-levenshtein'
import { vaultClient } from '../client'
import { logSync } from '../log'
import type { LvCompanyInsert, LvContactInsert, ConnectorOptions, SyncResult } from '../types'

// Using execFile (not exec) — no shell injection risk: args are passed as array, not interpolated
const execFileAsync = promisify(_execFile)

const BINARY = '/usr/local/bin/google-maps-scraper'
const GOSOM_REPO = 'https://github.com/gosom/google-maps-scraper'
const SLEEP_BETWEEN_GROUPS_MS = 30_000
const BATCH_SIZE = 50
const PAGE_SIZE = 1000

const ELIGIBLE_COUNTRIES = ['FRA', 'GBR', 'DEU', 'ESP', 'ITA', 'BEL', 'NLD', 'POL', 'USA', 'CAN']

const COUNTRY_NAMES: Record<string, string> = {
  FRA: 'France',
  GBR: 'United Kingdom',
  DEU: 'Germany',
  ESP: 'Spain',
  ITA: 'Italy',
  BEL: 'Belgium',
  NLD: 'Netherlands',
  POL: 'Poland',
  USA: 'United States',
  CAN: 'Canada',
}

const COUNTRY_LANG: Record<string, string> = {
  FRA: 'fr',
  GBR: 'en',
  DEU: 'de',
  ESP: 'es',
  ITA: 'it',
  BEL: 'fr',
  NLD: 'nl',
  POL: 'pl',
  USA: 'en',
  CAN: 'en',
}

const NACE_KEYWORD: Record<string, string> = {
  '1011': 'meat processing',
  '1013': 'charcuterie boucherie',
  '1051': 'dairy products fromagerie',
  '1071': 'boulangerie bakery',
  '1072': 'biscuiterie patisserie',
  '4711': 'supermarché supermarket',
  '4721': 'épicerie grocery store',
  '4722': 'boucherie butcher',
  '4723': 'poissonnerie fish shop',
  '4724': 'fromagerie cheese shop',
  '4725': 'cave vin wine shop',
  '4726': 'tabac tobacco shop',
  '4729': 'alimentation food shop',
  '4741': 'informatique computer store',
  '4742': 'télécommunication phone shop',
  '4751': 'textile clothing shop',
  '4752': 'bricolage hardware store',
  '4759': 'mobilier furniture store',
  '4761': 'librairie bookshop',
  '4771': 'vêtements clothing',
  '4772': 'pharmacie pharmacy',
  '4773': 'animalerie pet shop',
  '4774': 'matériel médical medical equipment',
  '4779': 'brocante second hand shop',
  '4781': 'marché alimentaire food market',
  '4932': 'taxi vtc',
  '4941': 'transport routier haulage',
  '5210': 'entrepôt stockage warehouse',
  '5610': 'restaurant',
  '5621': 'traiteur catering',
  '5630': 'bar café',
  '6201': 'développement logiciel software',
  '6209': 'informatique IT services',
  '6311': 'hébergement web hosting',
  '6411': 'banque bank',
  '6419': 'etablissement crédit financial institution',
  '6511': 'assurance insurance',
  '6810': 'immobilier real estate',
  '6831': 'agence immobilière estate agent',
  '6910': 'cabinet avocat law firm',
  '6920': 'cabinet comptable accounting firm',
  '7022': 'conseil management consulting',
  '7111': 'architecture studio',
  '7112': 'bureau études engineering firm',
  '7311': 'agence publicité advertising agency',
  '7490': 'conseil business consulting',
  '7500': 'clinique vétérinaire veterinary',
  '7810': 'cabinet recrutement recruitment agency',
  '8121': 'nettoyage cleaning',
  '8130': 'jardinage paysagiste landscaping',
  '8230': 'organisation événements event planning',
  '8511': 'enseignement pré-scolaire preschool',
  '8542': 'formation professionnelle professional training',
  '8551': 'sport activities sports center',
  '8553': 'auto-école driving school',
  '8610': 'hôpital hospital',
  '8621': 'clinique médicale medical clinic',
  '8622': 'dentiste dental clinic',
  '9311': 'salle sport sports hall',
  '9312': 'club sportif sports club',
  '9313': 'salle fitness fitness gym',
  '9511': 'réparation informatique computer repair',
  '9601': 'blanchisserie laundry',
  '9602': 'coiffeur salon coiffure hairdresser',
  '9604': 'bien-être spa wellness spa',
}

function naceToKeyword(naceCode: string | null | undefined): string {
  if (!naceCode) return 'entreprise business'
  const code = naceCode.replace(/[^0-9A-Za-z]/g, '')
  const key4letter = NACE_KEYWORD[code]
  if (key4letter) return key4letter
  const prefix4 = code.slice(0, 4)
  const key4 = NACE_KEYWORD[prefix4]
  if (key4) return key4
  const prefix2 = code.slice(0, 2)
  for (const [k, v] of Object.entries(NACE_KEYWORD)) {
    if (k.startsWith(prefix2)) return v
  }
  return 'entreprise business'
}

function similarity(a: string, b: string): number {
  const aL = a.toLowerCase().trim()
  const bL = b.toLowerCase().trim()
  if (!aL || !bL) return 0
  const maxLen = Math.max(aL.length, bL.length)
  if (maxLen === 0) return 1
  const dist = leven.get(aL, bL)
  return 1 - dist / maxLen
}

async function checkOrBuildBinary(): Promise<boolean> {
  if (existsSync(BINARY)) return true

  try {
    execSync('which go', { stdio: 'pipe' })
  } catch {
    console.warn('[gmaps-gosom] Go not found. Install at https://go.dev/dl/')
    console.warn(`[gmaps-gosom] Manual build: git clone ${GOSOM_REPO} /tmp/gmaps-scraper && cd /tmp/gmaps-scraper && go build -o ${BINARY}`)
    return false
  }

  console.log('[gmaps-gosom] Building gosom binary from source...')
  const buildDir = '/tmp/gmaps-scraper'
  try {
    if (!existsSync(buildDir)) {
      execSync(`git clone --depth 1 ${GOSOM_REPO} ${buildDir}`, { stdio: 'pipe', timeout: 120_000 })
    }
    execSync(`cd ${buildDir} && go build -o ${BINARY} .`, { stdio: 'pipe', timeout: 300_000 })
    console.log(`[gmaps-gosom] Binary built at ${BINARY}`)
    return true
  } catch (e) {
    console.error('[gmaps-gosom] Build failed:', (e as Error).message)
    return false
  }
}

interface GosomPoi {
  name?: string
  address?: string
  phone?: string
  website?: string
  latitude?: number
  longitude?: number
  rating?: number
  reviews?: number
  category?: string
  city?: string
  postal_code?: string
  country?: string
}

async function runGosomQuery(queries: string[], lang: string, countryIso: string): Promise<GosomPoi[]> {
  const runDir = join(tmpdir(), `gmaps-${Date.now()}`)
  mkdirSync(runDir, { recursive: true })
  const kwFile = join(runDir, 'keywords.txt')
  const outFile = join(runDir, 'results.json')

  writeFileSync(kwFile, queries.join('\n'), 'utf8')

  try {
    // execFileAsync uses execFile internally — args passed as array, no shell injection
    await execFileAsync(
      BINARY,
      ['-input', kwFile, '-results', outFile, '-depth', '5', '-lang', lang, '-country', countryIso.toLowerCase().slice(0, 2), '-emails'],
      { timeout: 120_000 },
    )
  } catch (e) {
    console.warn('[gmaps-gosom] binary non-zero exit (may have partial results):', (e as Error).message)
  }

  const results: GosomPoi[] = []
  if (!existsSync(outFile)) {
    rmSync(runDir, { recursive: true, force: true })
    return results
  }

  const rl = createInterface({ input: createReadStream(outFile, 'utf8'), crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      results.push(JSON.parse(trimmed) as GosomPoi)
    } catch {
      // skip malformed lines
    }
  }

  rmSync(runDir, { recursive: true, force: true })
  return results
}

interface CompanyRow {
  id: string
  legal_name: string
  country_iso: string
  city: string
  nace_code: string | null
  postal_code: string | null
  domain: string | null
}

export async function runGmapsGosomEnrich(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const totalLimit = opts.limit ?? 300
  const client = vaultClient()

  const binaryOk = await checkOrBuildBinary()
  if (!binaryOk) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: 'gosom binary not available — see logs for install instructions',
    }
  }

  type Row = CompanyRow
  let lastId: string | null = null
  const list: Row[] = []

  while (list.length < totalLimit) {
    const remain = Math.min(PAGE_SIZE, totalLimit - list.length)
    let q = client
      .from('lv_companies')
      .select('id, legal_name, country_iso, city, nace_code, postal_code, domain')
      .in('country_iso', ELIGIBLE_COUNTRIES)
      .not('city', 'is', null)
      .order('id', { ascending: true })
      .limit(remain)
    if (lastId) q = q.gt('id', lastId)

    const { data: page, error } = await q
    if (error) {
      return { rows_processed: 0, rows_inserted: 0, rows_updated: 0, rows_skipped: 0, duration_ms: Date.now() - t0, error: error.message }
    }
    const rows = (page ?? []) as Row[]
    if (rows.length === 0) break

    const ids = rows.map((r) => r.id)
    const { data: existing } = await client
      .from('lv_contacts')
      .select('company_id')
      .eq('contact_type', 'phone')
      .in('company_id', ids)
    const withPhone = new Set((existing ?? []).map((e: { company_id: string }) => e.company_id))

    list.push(...rows.filter((r) => !withPhone.has(r.id)))
    lastId = rows[rows.length - 1].id
    if (rows.length < remain) break
  }

  // Group by (country, city, keyword)
  const groups = new Map<string, { rows: Row[]; country_iso: string; city: string; keyword: string }>()
  for (const row of list) {
    const keyword = naceToKeyword(row.nace_code)
    const key = `${row.country_iso}::${row.city}::${keyword}`
    if (!groups.has(key)) groups.set(key, { rows: [], country_iso: row.country_iso, city: row.city, keyword })
    groups.get(key)!.rows.push(row)
  }

  let processed = 0
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const [, group] of Array.from(groups)) {
    const { country_iso, city, keyword, rows } = group
    const countryName = COUNTRY_NAMES[country_iso] ?? country_iso
    const lang = COUNTRY_LANG[country_iso] ?? 'en'
    const query = `${keyword} in ${city}, ${countryName}`

    console.log(`[gmaps-gosom] Query: "${query}" (${rows.length} candidates)`)

    let pois: GosomPoi[] = []
    if (!opts.dryRun) {
      pois = await runGosomQuery([query], lang, country_iso)
      console.log(`[gmaps-gosom] ${pois.length} POIs returned`)
    } else {
      console.log(`[gmaps-gosom] [dry-run] would query: ${query}`)
    }

    for (const row of rows) {
      processed++
      let matched = false

      for (const poi of pois) {
        if (!poi.name) continue
        if (similarity(poi.name, row.legal_name) >= 0.70) {
          if (poi.phone) {
            if (!opts.dryRun) {
              await client.from('lv_contacts').upsert(
                { company_id: row.id, contact_type: 'phone', contact_value: poi.phone, is_personal: false, verify_status: 'unverified', primary_source: 'gmaps' } as any,
                { onConflict: 'company_id,contact_type,contact_value', ignoreDuplicates: true },
              )
              const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
              if (poi.address) patch.address = poi.address
              if (poi.postal_code) patch.postal_code = poi.postal_code
              if (poi.latitude) patch.lat = poi.latitude
              if (poi.longitude) patch.lng = poi.longitude
              if (poi.website && !row.domain) patch.domain = poi.website.replace(/^https?:\/\//, '').split('/')[0]
              await (client as any).from('lv_companies').update(patch).eq('id', row.id)
            } else {
              console.log(`[gmaps-gosom] [dry-run] match "${poi.name}" ↔ "${row.legal_name}" phone=${poi.phone}`)
            }
            updated++
            matched = true
          }
          break
        }
      }

      if (!matched) skipped++
    }

    // Insert unmatched POIs as new companies
    if (!opts.dryRun) {
      const matchedNames = new Set<string>()
      for (const row of rows) {
        for (const poi of pois) {
          if (poi.name && similarity(poi.name, row.legal_name) >= 0.70) matchedNames.add(poi.name)
        }
      }
      for (const poi of pois) {
        if (!poi.name || matchedNames.has(poi.name) || (!poi.phone && !poi.website)) continue
        const newCompany: LvCompanyInsert = {
          legal_name: poi.name,
          country_iso: group.country_iso,
          city: group.city,
          address: poi.address ?? undefined,
          postal_code: poi.postal_code ?? undefined,
          domain: poi.website ? poi.website.replace(/^https?:\/\//, '').split('/')[0] : undefined,
          primary_source: 'gmaps',
          status: 'active',
        }
        const { data: newComp } = await client.from('lv_companies').insert(newCompany as any).select('id').single()
        if (newComp && poi.phone) {
          await client.from('lv_contacts').insert({
            company_id: (newComp as any).id,
            contact_type: 'phone',
            contact_value: poi.phone,
            is_personal: false,
            verify_status: 'unverified',
            primary_source: 'gmaps',
          } as any)
        }
        inserted++
      }
    }

    if (!opts.dryRun) {
      await new Promise((r) => setTimeout(r, SLEEP_BETWEEN_GROUPS_MS))
    }

    if (processed % BATCH_SIZE === 0) {
      console.log(`[gmaps-gosom] ${processed}/${list.length} processed — updated=${updated} inserted=${inserted} skipped=${skipped}`)
    }
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: inserted,
    rows_updated: updated,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { binary_ok: binaryOk, groups_processed: groups.size },
  }

  if (!opts.dryRun) {
    try {
      await logSync({ source_id: 'gmaps', operation: 'sync', result })
    } catch (e) {
      console.error('[gmaps-gosom] logSync err:', (e as Error).message)
    }
  }

  return result
}
