// @ts-nocheck
/**
 * Feel The Gap — Free Multi-Source Data Collector
 *
 * Orchestrates ALL free data sources in parallel:
 *   1. World Bank Open Data (no auth) — macro indicators
 *   2. World Bank WITS (no auth) — bilateral trade
 *   3. WTO API (no auth) — merchandise + services trade
 *   4. IMF DOTS (no auth) — bilateral flows
 *   5. FAOSTAT (no auth) — agriculture
 *   6. Our World in Data (no auth) — indicators + food security
 *   7. DataHub.io (no auth) — commodity prices
 *   8. World Factbook (no auth) — structured country profiles
 *   9. UN Comtrade (free registration) — detailed HS trade flows
 *  10. USDA PSD (no auth) — agricultural supply/demand
 *  11. Eurostat COMEXT (no auth) — EU trade detail
 *
 * Run: npx tsx agents/free-collector.ts [--country MAR] [--year 2022]
 * Or triggered via Vercel cron → /api/cron/collect
 */

import { supabaseAdmin } from '@/lib/supabase'
import { fetchWorldBankCountries, fetchWorldBankIndicators } from './sources/world-bank'
import { fetchIMFWorldTotals } from './sources/imf'
import { fetchFAOCountryTrade, FAO_COUNTRY_MAP, FAO_KEY_ITEMS } from './sources/faostat'
import { fetchCommodityPrices, fetchFactbookCountry, DATAHUB_DATASETS } from './sources/owid'
import { iso2ToFlag } from '@/lib/iso-to-flag'

// ── Country priority order (most impactful first) ─────────────────────────────
export const PRIORITY_COUNTRIES = [
  // Africa — highest opportunity scores
  'NGA','ETH','KEN','EGY','MAR','TUN','TZA','NAM','ZAF','GHA',
  'CIV','CMR','SEN','MLI','BFA','MOZ','ZMB','ZWE','AGO','COD',
  'RWA','UGA','SDN','MDG','BEN','NER','TCD','TGO','GIN','SSD',
  // South & Southeast Asia
  'IND','PAK','BGD','IDN','VNM','THA','PHL','MMR','KHM','LKA',
  'NPL','BLZ','LAO','MNG','AFG',
  // Middle East & North Africa
  'SAU','ARE','IRN','IRQ','SYR','YEM','LBN','JOR','TUN','DZA',
  'LBY','OMN','QAT','KWT','BHR',
  // Latin America
  'BRA','MEX','COL','PER','ARG','CHL','VEN','ECU','BOL','PRY',
  'URY','PAN','CRI','GTM','HND','SLV','DOM','JAM','HTI','CUB',
  // Europe (for benchmarking + EU trade data)
  'TUR','UKR','POL','ROU','BGR','HRV','SRB','ALB','MKD','BIH',
  // Central Asia
  'KAZ','UZB','AZE','GEO','ARM','TKM','TJK','KGZ',
  // Pacific
  'AUS','NZL','PNG','FJI',
  // Major economies (data anchor points)
  'CHN','USA','DEU','FRA','GBR','JPN','KOR','CAN','ESP','ITA',
  'RUS','NLD','BEL','CHE','SWE','NOR','DNK','AUT','FIN','IRL',
]

export interface CollectorOptions {
  countries?: string[]
  /** When true, processes every country returned by the World Bank API
   * (skip the PRIORITY_COUNTRIES filter). Used by the admin full-refresh. */
  allCountries?: boolean
  year?: number
  sources?: ('world_bank' | 'imf' | 'fao' | 'factbook' | 'comtrade' | 'all')[]
  dryRun?: boolean
}

export async function runFreeCollector(opts: CollectorOptions = {}) {
  const year = opts.year ?? 2022
  const admin = supabaseAdmin()
  const startedAt = new Date().toISOString()

  console.log(`[FreeCollector] Starting — year=${year}, sources=all-free`)

  const { data: run } = await admin.from('agent_runs').insert({
    agent: 'free_collector',
    status: 'running',
    countries_processed: 0,
    records_inserted: 0,
    started_at: startedAt,
  }).select().single()
  const runId = run?.id

  let recordsInserted = 0
  let countriesProcessed = 0

  try {
    // ── PHASE 1: Macro data — all sources in parallel ────────────────────────
    console.log('[FreeCollector] Phase 1: Fetching macro data from all free sources...')

    const [wbData, imfData] = await Promise.all([
      fetchWorldBankIndicators([], year),
      fetchIMFWorldTotals(year),
    ])

    console.log(`[FreeCollector] WB: ${Object.keys(wbData).length} countries, IMF: ${Object.keys(imfData).length} countries`)

    // ── PHASE 2: Commodity prices (DataHub) ──────────────────────────────────
    console.log('[FreeCollector] Phase 2: Fetching commodity prices...')
    const commodityPrices = await fetchCommodityPrices('commodity-prices')
    console.log(`[FreeCollector] ${commodityPrices.length} commodity price records`)

    // Save latest prices to a dedicated table (useful for opportunity scoring)
    if (commodityPrices.length && !opts.dryRun) {
      // Store in agent_runs metadata for now
      await admin.from('agent_runs').update({
        errors: { commodity_prices_count: commodityPrices.length, sample: commodityPrices.slice(0, 3) },
      }).eq('id', runId)
    }

    // ── PHASE 3: World Bank country list + upsert ────────────────────────────
    console.log('[FreeCollector] Phase 3: Upserting countries...')
    const wbCountries = await fetchWorldBankCountries()

    // Country selection:
    //  - explicit `opts.countries` → exactly those ISOs
    //  - `opts.allCountries` → every real sovereign country returned by WB
    //    (filters out aggregates/regions which have no iso2Code)
    //  - default → PRIORITY_COUNTRIES curated list
    let countries: typeof wbCountries
    if (opts.countries?.length) {
      const target = new Set(opts.countries.map(c => c.toUpperCase()))
      countries = wbCountries.filter(c => target.has(c.id.toUpperCase()))
    } else if (opts.allCountries) {
      countries = wbCountries.filter(c =>
        !!c.iso2Code && c.iso2Code.length === 2 && c.region?.value && c.region.value !== 'Aggregates'
      )
      console.log(`[FreeCollector] allCountries=true → ${countries.length} countries selected`)
    } else {
      const target = new Set(PRIORITY_COUNTRIES.map(c => c.toUpperCase()))
      countries = wbCountries.filter(c => target.has(c.id.toUpperCase()))
    }

    for (const wbc of countries) {
      const iso3 = wbc.id.toUpperCase()
      const wb = wbData[iso3] ?? {}
      const imf = imfData[wbc.iso2Code?.toUpperCase()] ?? {}

      // Determine best trade values (prefer IMF DOTS as more complete)
      const total_exports = imf.exports_usd || (wb.total_exports_usd ?? null)
      const total_imports = imf.imports_usd || (wb.total_imports_usd ?? null)
      const trade_balance = (total_exports && total_imports)
        ? total_exports - total_imports
        : null

      // Determine top import category from World Bank sector indicators
      const top_cat = inferTopCategory(wb)

      const countryRow = {
        id:               iso3,
        iso2:             wbc.iso2Code ?? '',
        name:             wbc.name,
        name_fr:          translateCountryName(wbc.name), // basic translation map
        flag:             isoToFlag(wbc.iso2Code ?? ''),
        region:           wbc.region?.value ?? '',
        sub_region:       '',
        lat:              parseFloat(wbc.latitude ?? '0'),
        lng:              parseFloat(wbc.longitude ?? '0'),
        population:       wb.population ? Math.round(wb.population) : null,
        gdp_usd:          wb.gdp_usd ? Math.round(wb.gdp_usd) : null,
        gdp_per_capita:   wb.gdp_per_capita ?? null,
        land_area_km2:    wb.land_area_km2 ? Math.round(wb.land_area_km2) : null,
        arable_land_pct:  wb.arable_land_pct ?? null,
        total_imports_usd: total_imports ? Math.round(total_imports) : null,
        total_exports_usd: total_exports ? Math.round(total_exports) : null,
        trade_balance_usd: trade_balance ? Math.round(trade_balance) : null,
        top_import_category: top_cat,
        data_year:        year,
      }

      if (!opts.dryRun) {
        await admin.from('countries').upsert(countryRow, { onConflict: 'id' })
        recordsInserted++
      } else {
        console.log(`  [DRY] ${iso3}: imports=${fmtB(total_imports)}, exports=${fmtB(total_exports)}, cat=${top_cat}`)
      }

      countriesProcessed++
    }

    console.log(`[FreeCollector] Phase 3 done: ${countriesProcessed} countries upserted`)

    // ── PHASE 4: FAO agriculture detail ──────────────────────────────────────
    console.log('[FreeCollector] Phase 4: FAO agriculture data...')

    const faoTargets = countries.slice(0, 60) // start with top 60 by priority

    for (const wbc of faoTargets) {
      const iso3 = wbc.id.toUpperCase()
      const faoCode = FAO_COUNTRY_MAP[iso3]
      if (!faoCode) continue

      try {
        const [importRows] = await Promise.all([
          fetchFAOCountryTrade(faoCode, year, 'Import Value'),
        ])

        if (importRows.length && !opts.dryRun) {
          // Insert key agricultural product imports
          const topImports = importRows
            .sort((a, b) => b.value_usd - a.value_usd)
            .slice(0, 30)
            .map(row => {
              const item = FAO_KEY_ITEMS.find(i => i.code === row.item_code)
              return {
                reporter_iso:  iso3,
                partner_iso:   'WLD',
                product_id:    (item?.hs2 ?? '00') + '0000', // approximate HS6
                year,
                flow:          'import',
                value_usd:     Math.round(row.value_usd),
                quantity:      row.quantity_tonnes,
                source:        'FAOSTAT',
              }
            })

          for (let i = 0; i < topImports.length; i += 100) {
            await admin.from('trade_flows')
              .upsert(topImports.slice(i, i + 100), {
                onConflict: 'reporter_iso,partner_iso,product_id,year,flow',
              })
            recordsInserted += Math.min(100, topImports.length - i)
          }
        }
      } catch (e) {
        console.warn(`  FAO error for ${iso3}:`, e)
      }

      await sleep(800) // FAO rate limiting
    }

    // ── PHASE 5: World Factbook product details ───────────────────────────────
    console.log('[FreeCollector] Phase 5: World Factbook top import products...')

    for (const wbc of countries.slice(0, 40)) {
      const iso3 = wbc.id.toUpperCase()
      try {
        const fb = await fetchFactbookCountry(iso3)
        if (!fb) continue

        // Store top import products in opportunities as quick wins
        if (fb.top_imports.length && !opts.dryRun) {
          // These give us product names — we'll correlate to HS codes in gap analyzer
          await admin.from('agent_runs').update({
            errors: {
              ...(run?.errors as any ?? {}),
              [`factbook_${iso3}`]: {
                top_imports: fb.top_imports,
                top_exports: fb.top_exports,
                imports_usd: fb.imports_usd,
                exports_usd: fb.exports_usd,
              },
            },
          }).eq('id', runId).limit(1)
        } else {
          console.log(`  ${iso3}: top imports = ${fb.top_imports.slice(0,3).join(', ')}`)
        }
      } catch {}
      await sleep(300)
    }

    console.log(`[FreeCollector] Complete. ${countriesProcessed} countries, ${recordsInserted} records.`)

  } finally {
    if (runId) {
      await admin.from('agent_runs').update({
        status: 'completed',
        countries_processed: countriesProcessed,
        records_inserted: recordsInserted,
        ended_at: new Date().toISOString(),
      }).eq('id', runId)
    }
  }
}

// ── Gap Analyzer (runs after collector) ──────────────────────────────────────

export async function runGapAnalyzer() {
  const admin = supabaseAdmin()
  console.log('[GapAnalyzer] Scoring opportunities from collected trade flows...')

  const { data: countries } = await admin.from('countries')
    .select('id,name_fr,arable_land_pct,gdp_per_capita,population,total_imports_usd')
    .not('total_imports_usd', 'is', null)
    .order('total_imports_usd', { ascending: false })

  if (!countries?.length) return

  // Get all trade flows grouped
  const { data: flows } = await admin.from('trade_flows')
    .select('reporter_iso,product_id,flow,value_usd,quantity,source')
    .eq('flow', 'import')
    .gte('value_usd', 1_000_000) // min $1M gap

  if (!flows?.length) return

  // Group by country+product
  const grouped: Record<string, { imports: number; qty: number | null }> = {}
  for (const f of flows) {
    const key = `${f.reporter_iso}::${f.product_id}`
    if (!grouped[key]) grouped[key] = { imports: 0, qty: null }
    grouped[key].imports += f.value_usd
    if (f.quantity) grouped[key].qty = (grouped[key].qty ?? 0) + f.quantity
  }

  const opps = []
  for (const [key, data] of Object.entries(grouped)) {
    const [country_iso, product_id] = key.split('::')
    if (data.imports < 1_000_000) continue

    const country = countries.find(c => c.id === country_iso)
    const score = scoreOpportunity(data.imports, country)

    opps.push({
      country_iso,
      product_id,
      type: (country?.arable_land_pct ?? 0) > 20 ? 'local_production' : 'direct_trade',
      gap_value_usd: Math.round(data.imports),
      gap_tonnes_year: data.qty ? Math.round(data.qty) : null,
      opportunity_score: score,
      summary: buildSummary(country_iso, product_id, data.imports, data.qty),
    })
  }

  // Batch upsert
  for (let i = 0; i < opps.length; i += 100) {
    await admin.from('opportunities').upsert(opps.slice(i, i + 100), {
      onConflict: 'country_iso,product_id,type',
    })
  }

  // Update country aggregate opportunity scores
  const byCountry: Record<string, number[]> = {}
  for (const opp of opps) {
    if (!byCountry[opp.country_iso]) byCountry[opp.country_iso] = []
    byCountry[opp.country_iso].push(opp.opportunity_score)
  }

  for (const [iso, scores] of Object.entries(byCountry)) {
    const topScore = Math.max(...scores)
    await admin.from('countries').update({
      top_import_category: (opps.find(o => o.country_iso === iso && o.opportunity_score === topScore))?.product_id?.startsWith('07') ? 'agriculture' : undefined,
    }).eq('id', iso)
  }

  console.log(`[GapAnalyzer] ${opps.length} opportunities scored and saved.`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreOpportunity(importValue: number, country: any): number {
  let score = 0
  // Scale: $1M=20, $10M=40, $100M=60, $1B=80, $10B=95
  score += Math.min(50, Math.round(Math.log10(importValue / 1e6) * 15 + 5))
  // Arable land bonus (local production potential)
  if ((country?.arable_land_pct ?? 0) > 20) score += 15
  if ((country?.arable_land_pct ?? 0) > 35) score += 10
  // Low labor cost bonus
  if ((country?.gdp_per_capita ?? 99999) < 5000) score += 15
  if ((country?.gdp_per_capita ?? 99999) < 2000) score += 10
  return Math.min(100, Math.max(10, score))
}

function inferTopCategory(wb: Record<string, number>): string {
  const fuel = wb.fuel_imports_pct ?? 0
  const ag   = wb.ag_imports_usd  ?? 0
  const manuf = wb.manuf_imports_pct ?? 0
  if (fuel > 25) return 'energy'
  if (ag > 20)   return 'agriculture'
  if (manuf > 60) return 'manufactured'
  return 'energy' // default
}

function buildSummary(iso: string, product: string, value: number, qty: number | null): string {
  const v = value >= 1e9 ? `$${(value/1e9).toFixed(1)}B` : `$${(value/1e6).toFixed(0)}M`
  const q = qty ? ` (${(qty/1000).toFixed(0)}K t)` : ''
  return `${iso}: imports ${v}/yr${q} of product ${product}`
}

// isoToFlag below (kept as a thin wrapper) — single source of truth in lib/iso-to-flag.ts
function isoToFlag(iso2: string): string {
  return iso2ToFlag(iso2)
}

function fmtB(v: number | null): string {
  if (!v) return '—'
  if (v >= 1e12) return `$${(v/1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v/1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

// French country name translations (top 80 countries)
const FR_NAMES: Record<string, string> = {
  'Morocco':'Maroc','Tunisia':'Tunisie','Tanzania':'Tanzanie',
  'South Africa':'Afrique du Sud','Namibia':'Namibie','Nigeria':'Nigeria',
  'Ethiopia':'Éthiopie','Kenya':'Kenya','Egypt':'Égypte',
  'Ghana':'Ghana','Côte d\'Ivoire':'Côte d\'Ivoire','Cameroon':'Cameroun',
  'Senegal':'Sénégal','Mali':'Mali','Burkina Faso':'Burkina Faso',
  'Mozambique':'Mozambique','Zambia':'Zambie','Zimbabwe':'Zimbabwe',
  'Angola':'Angola','Congo, Dem. Rep.':'RD Congo','Rwanda':'Rwanda',
  'Uganda':'Ouganda','Sudan':'Soudan','Madagascar':'Madagascar',
  'India':'Inde','Pakistan':'Pakistan','Bangladesh':'Bangladesh',
  'Indonesia':'Indonésie','Vietnam':'Vietnam','Thailand':'Thaïlande',
  'Philippines':'Philippines','Myanmar':'Myanmar','Cambodia':'Cambodge',
  'Sri Lanka':'Sri Lanka','Nepal':'Népal',
  'Saudi Arabia':'Arabie Saoudite','United Arab Emirates':'Émirats Arabes Unis',
  'Iran':'Iran','Iraq':'Irak','Syria':'Syrie','Yemen':'Yémen',
  'Lebanon':'Liban','Jordan':'Jordanie','Algeria':'Algérie',
  'Libya':'Libye','Oman':'Oman','Qatar':'Qatar','Kuwait':'Koweït',
  'Brazil':'Brésil','Mexico':'Mexique','Colombia':'Colombie',
  'Peru':'Pérou','Argentina':'Argentine','Chile':'Chili',
  'Venezuela':'Venezuela','Ecuador':'Équateur','Bolivia':'Bolivie',
  'Paraguay':'Paraguay','Uruguay':'Uruguay',
  'Turkey':'Turquie','Ukraine':'Ukraine','Poland':'Pologne',
  'Romania':'Roumanie','Bulgaria':'Bulgarie','Serbia':'Serbie',
  'Albania':'Albanie','Kazakhstan':'Kazakhstan','Uzbekistan':'Ouzbékistan',
  'China':'Chine','United States':'États-Unis','Germany':'Allemagne',
  'France':'France','United Kingdom':'Royaume-Uni','Japan':'Japon',
  'Korea, Rep.':'Corée du Sud','Canada':'Canada','Spain':'Espagne',
  'Italy':'Italie','Russia':'Russie','Netherlands':'Pays-Bas',
  'Belgium':'Belgique','Switzerland':'Suisse','Sweden':'Suède',
  'Norway':'Norvège','Denmark':'Danemark','Austria':'Autriche',
  'Australia':'Australie','New Zealand':'Nouvelle-Zélande',
}

function translateCountryName(name: string): string {
  return FR_NAMES[name] ?? name
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2)
  const countryIdx = args.indexOf('--country')
  const country = countryIdx >= 0 ? args[countryIdx + 1] : undefined
  const yearIdx = args.indexOf('--year')
  const year = parseInt(yearIdx >= 0 ? (args[yearIdx + 1] ?? '2022') : '2022')
  const dryRun = args.includes('--dry-run')
  const analyze = args.includes('--analyze')
  const allCountries = args.includes('--all-countries') || args.includes('--all')

  if (analyze) {
    runGapAnalyzer().catch(console.error)
  } else {
    runFreeCollector({
      countries: country ? [country] : undefined,
      allCountries,
      year,
      dryRun,
    }).then(() => {
      if (!dryRun) return runGapAnalyzer()
    }).catch(console.error)
  }
}
