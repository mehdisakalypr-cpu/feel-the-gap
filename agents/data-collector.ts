/**
 * Feel The Gap — AI Data Collection Agent
 *
 * Collects trade data from:
 *   1. World Bank API (trade volumes, GDP, population)
 *   2. UN Comtrade API (product-level imports/exports)
 *   3. FAO (agriculture specific)
 *
 * Run via: npx tsx agents/data-collector.ts [--country MAR] [--category agriculture]
 * Or triggered by Vercel Cron → /api/cron/collect
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { Country, TradeFlow } from '@/types/database'

const WB = process.env.WORLD_BANK_BASE_URL ?? 'https://api.worldbank.org/v2'

// ── World Bank helpers ────────────────────────────────────────────────────────

async function wbGet(path: string): Promise<unknown[]> {
  const url = `${WB}${path}?format=json&per_page=300`
  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error(`WB ${path}: ${res.status}`)
  const data = await res.json() as [{ pages: number }, unknown[]]
  return data[1] ?? []
}

interface WBCountry {
  id: string; iso2Code: string; name: string;
  region: { value: string }; capitalCity: string;
  longitude: string; latitude: string;
}

interface WBIndicator { countryiso3code: string; value: number | null; date: string }

async function fetchCountryList(): Promise<WBCountry[]> {
  return wbGet('/country?region=all') as Promise<WBCountry[]>
}

async function fetchIndicator(code: string, year = '2022'): Promise<Record<string, number>> {
  const rows = await wbGet(`/country/all/indicator/${code}?date=${year}`) as WBIndicator[]
  const map: Record<string, number> = {}
  for (const r of rows) {
    if (r.value != null) map[r.countryiso3code] = r.value
  }
  return map
}

// ── UN Comtrade helpers ───────────────────────────────────────────────────────

interface ComtradeRow {
  reporterCode: string; partnerCode: string;
  cmdCode: string; flowCode: string;
  primaryValue: number; netWgt: number | null;
  period: string;
}

async function fetchComtrade(
  reporterISO: string,
  year: number,
  hs2Chapters: string[],  // 2-digit HS chapters
): Promise<ComtradeRow[]> {
  const apiKey = process.env.UN_COMTRADE_API_KEY
  if (!apiKey) {
    console.warn('UN Comtrade key not set — skipping detailed product data')
    return []
  }
  const cmd = hs2Chapters.join(',')
  const url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?` +
    `reporterCode=${reporterISO}&period=${year}&cmdCode=${cmd}&` +
    `flowCode=M,X&includeDesc=false&subscription-key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) return []
  const json = await res.json() as { data?: ComtradeRow[] }
  return json.data ?? []
}

// ── Category → HS chapter mapping ────────────────────────────────────────────

const CATEGORY_HS: Record<string, string[]> = {
  agriculture:  ['01','02','03','04','07','08','09','10','11','12','15','16','17','18','19','20','21'],
  energy:       ['27'],
  materials:    ['25','26','28','29','47','48','72','73','74','75','76'],
  manufactured: ['39','40','50','51','52','53','54','55','56','57','58','59','60','61','62','63',
                 '84','85','86','87','88','89','90'],
  resources:    ['22','31'],
}

// ── Main collection logic ─────────────────────────────────────────────────────

export interface CollectorOptions {
  countries?: string[]          // ISO3 codes; undefined = all
  category?: string             // undefined = all categories
  year?: number
  dryRun?: boolean
}

export async function runDataCollector(opts: CollectorOptions = {}): Promise<void> {
  const admin = supabaseAdmin()
  const year = opts.year ?? 2022
  const startedAt = new Date().toISOString()

  // Log run start
  const { data: run } = await admin.from('agent_runs').insert({
    agent: 'data_collector',
    status: 'running',
    countries_processed: 0,
    records_inserted: 0,
    started_at: startedAt,
  }).select().single()
  const runId = run?.id

  let countriesProcessed = 0
  let recordsInserted = 0
  const errors: { country?: string; error: string }[] = []

  try {
    // 1. Fetch World Bank country list
    console.log('[DataCollector] Fetching country list from World Bank…')
    const wbCountries = await fetchCountryList()
    const [gdpMap, popMap, arableMap] = await Promise.all([
      fetchIndicator('NY.GDP.MKTP.CD', String(year)),
      fetchIndicator('SP.POP.TOTL',    String(year)),
      fetchIndicator('AG.LND.ARBL.ZS', String(year)),
    ])

    const targets = wbCountries.filter(c =>
      c.id.length === 3 &&
      c.region?.value &&
      c.region.value !== 'Aggregates' &&
      parseFloat(c.latitude) !== 0 &&
      (!opts.countries || opts.countries.includes(c.id))
    )

    console.log(`[DataCollector] Processing ${targets.length} countries…`)

    for (const wbc of targets) {
      try {
        const countryRow: Omit<Country, 'created_at'> = {
          id:             wbc.id,
          iso2:           wbc.iso2Code,
          name:           wbc.name,
          name_fr:        wbc.name,  // will be overridden by translation agent later
          flag:            isoToFlag(wbc.iso2Code),
          region:          wbc.region.value,
          sub_region:      '',
          lat:             parseFloat(wbc.latitude),
          lng:             parseFloat(wbc.longitude),
          population:      popMap[wbc.id] ?? null,
          gdp_usd:         gdpMap[wbc.id] ?? null,
          gdp_per_capita:  (gdpMap[wbc.id] && popMap[wbc.id]) ? gdpMap[wbc.id] / popMap[wbc.id] : null,
          land_area_km2:   null,
          arable_land_pct: arableMap[wbc.id] ?? null,
          total_imports_usd: null,
          total_exports_usd: null,
          trade_balance_usd: null,
          top_import_category: null,
          data_year:       year,
        }

        if (!opts.dryRun) {
          await admin.from('countries').upsert(countryRow, { onConflict: 'id' })
        }
        recordsInserted++

        // 2. Fetch Comtrade product data
        const categories = opts.category ? [opts.category] : Object.keys(CATEGORY_HS)
        for (const cat of categories) {
          const hs = CATEGORY_HS[cat]
          const rows = await fetchComtrade(wbc.id, year, hs)

          const flows: Omit<TradeFlow, 'id' | 'created_at'>[] = rows.map(r => ({
            reporter_iso: wbc.id,
            partner_iso:  r.partnerCode === '0' ? 'WLD' : r.partnerCode,
            product_id:   r.cmdCode.padStart(6, '0'),
            year,
            flow:         r.flowCode === 'M' ? 'import' : 'export',
            value_usd:    Math.round(r.primaryValue),
            quantity:     r.netWgt ?? null,
            source:       'UN_COMTRADE',
          }))

          if (!opts.dryRun && flows.length) {
            // Batch upsert in chunks of 500
            for (let i = 0; i < flows.length; i += 500) {
              await admin.from('trade_flows')
                .upsert(flows.slice(i, i + 500), { onConflict: 'reporter_iso,partner_iso,product_id,year,flow' })
            }
            recordsInserted += flows.length
          }
        }

        countriesProcessed++
        if (countriesProcessed % 10 === 0) {
          console.log(`  [${countriesProcessed}/${targets.length}] ${wbc.name}`)
          // Update run progress
          if (runId) {
            await admin.from('agent_runs').update({
              countries_processed: countriesProcessed,
              records_inserted:    recordsInserted,
            }).eq('id', runId)
          }
        }

        // Rate limiting: 1 req/sec for Comtrade free tier
        await sleep(1000)
      } catch (err) {
        errors.push({ country: wbc.id, error: String(err) })
        console.error(`  Error on ${wbc.id}:`, err)
      }
    }

    console.log(`[DataCollector] Done. ${countriesProcessed} countries, ${recordsInserted} records.`)
  } finally {
    if (runId) {
      await admin.from('agent_runs').update({
        status:              errors.length > 0 ? (countriesProcessed > 0 ? 'completed' : 'failed') : 'completed',
        countries_processed: countriesProcessed,
        records_inserted:    recordsInserted,
        errors:              errors.length ? errors : null,
        ended_at:            new Date().toISOString(),
      }).eq('id', runId)
    }
  }
}

// ── Gap Analyzer ──────────────────────────────────────────────────────────────

export async function runGapAnalyzer(countryCodes?: string[]): Promise<void> {
  const admin = supabaseAdmin()

  let q = admin.from('trade_flows').select(`
    reporter_iso, product_id, flow, value_usd, quantity,
    products!inner(category, name_fr, unit),
    countries!inner(arable_land_pct, gdp_per_capita, population)
  `)
  if (countryCodes?.length) q = q.in('reporter_iso', countryCodes)

  const { data: flows } = await q

  // Group by country+product, find where imports >> exports
  const grouped: Record<string, { imports: number; exports: number; value: number; category: string; name: string }> = {}

  for (const f of (flows ?? [])) {
    const key = `${f.reporter_iso}::${f.product_id}`
    if (!grouped[key]) grouped[key] = { imports: 0, exports: 0, value: 0, category: '', name: '' }
    const row = grouped[key]
    const product = f.products as { category: string; name_fr: string }
    row.category = product.category
    row.name = product.name_fr
    if (f.flow === 'import') { row.imports += f.value_usd; row.value += f.value_usd }
    else                     { row.exports += f.value_usd }
  }

  const opportunities: Record<string, unknown>[] = []

  for (const [key, data] of Object.entries(grouped)) {
    const [country_iso, product_id] = key.split('::')
    const gap = data.imports - data.exports
    if (gap < 1_000_000) continue  // ignore < $1M gap

    const score = Math.min(100, Math.round(Math.log10(gap) * 15))

    opportunities.push({
      country_iso,
      product_id,
      type: 'direct_trade',
      gap_value_usd: gap,
      opportunity_score: score,
      summary: `${data.name}: import gap of $${(gap / 1e6).toFixed(1)}M/yr`,
    })
  }

  if (opportunities.length) {
    const admin2 = supabaseAdmin()
    for (let i = 0; i < opportunities.length; i += 100) {
      await admin2.from('opportunities').upsert(opportunities.slice(i, i + 100), {
        onConflict: 'country_iso,product_id,type',
      })
    }
  }

  console.log(`[GapAnalyzer] ${opportunities.length} opportunities written.`)
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function isoToFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '🏳'
  return String.fromCodePoint(
    ...iso2.toUpperCase().split('').map(c => 0x1F1E0 + c.charCodeAt(0) - 65)
  )
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2)
  const country = args[args.indexOf('--country') + 1]
  const category = args[args.indexOf('--category') + 1]
  const dryRun = args.includes('--dry-run')

  runDataCollector({
    countries: country ? [country] : undefined,
    category,
    dryRun,
  }).catch(console.error)
}
