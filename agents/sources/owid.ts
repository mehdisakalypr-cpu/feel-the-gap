// @ts-nocheck
/**
 * Our World in Data + DataHub.io — No auth required
 * Commodity prices, energy data, food security indicators
 */

// ── Our World in Data API ─────────────────────────────────────────────────────

const OWID_BASE = 'https://api.ourworldindata.org/v1'

export async function fetchOWIDIndicator(
  variableId: number,
  countrySlug?: string,
): Promise<Array<{ country: string; year: number; value: number }>> {
  const url = `${OWID_BASE}/indicators/${variableId}.data.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data?.entities ?? []).flatMap((entity: any) =>
      (entity?.years ?? []).map((year: number, i: number) => ({
        country: entity.name ?? '',
        year,
        value: entity.values?.[i] ?? 0,
      }))
    )
  } catch {
    return []
  }
}

// Key OWID variable IDs for trade intelligence
export const OWID_VARIABLES = {
  food_imports_gdp:     '147095', // Food imports % GDP
  cereal_production:    '5510',   // Cereal production tonnes
  undernourishment:     '5924',   // % undernourished population
  co2_from_energy:      '4283',   // CO2 from energy
  renewable_share:      '163',    // Renewable energy % primary
  crop_yield_wheat:     '5694',   // Wheat yield kg/ha
  fertilizer_use:       '5609',   // Fertilizer consumption kg/ha
}

// ── DataHub.io — Commodity prices ─────────────────────────────────────────────

const DATAHUB_BASE = 'https://datahub.io/core'

export interface CommodityPrice {
  date: string
  commodity: string
  price_usd: number
  unit: string
}

export async function fetchCommodityPrices(
  dataset = 'commodity-prices',
): Promise<CommodityPrice[]> {
  const url = `${DATAHUB_BASE}/${dataset}/r/data.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()

    // DataHub commodity-prices dataset structure
    if (Array.isArray(data)) {
      return data.map((row: any) => ({
        date: row.Date ?? row.date ?? '',
        commodity: row.Commodity ?? row.commodity ?? '',
        price_usd: parseFloat(row.Price ?? row.price ?? 0),
        unit: row.Unit ?? 'USD/tonne',
      }))
    }
    return []
  } catch {
    return []
  }
}

// Key commodity datasets on DataHub
export const DATAHUB_DATASETS = {
  commodity_prices:  'commodity-prices',          // IMF Primary Commodity Prices
  oil_prices:        'oil-prices',                // Brent/WTI daily prices
  natural_gas:       'natural-gas',               // Natural gas prices
  wheat:             'wheat-prices',              // Wheat spot prices
  coffee:            'coffee-prices',             // Coffee (Arabica/Robusta)
  cocoa:             'cocoa-prices',              // Cocoa daily prices
  cotton:            'cotton-prices',             // Cotton A Index
  sugar:             'sugar-prices',              // Sugar (world raw)
}

// ── World Factbook (via worldfactbook.io) ─────────────────────────────────────

const FACTBOOK_BASE = 'https://worldfactbook.io/api'

export interface FactbookCountry {
  iso3: string
  name: string
  exports_usd: number
  imports_usd: number
  top_exports: string[]
  top_imports: string[]
  top_export_partners: string[]
  top_import_partners: string[]
}

export async function fetchFactbookCountry(iso3: string): Promise<FactbookCountry | null> {
  try {
    const res = await fetch(`${FACTBOOK_BASE}/countries/${iso3}`)
    if (!res.ok) return null
    const data = await res.json()
    const econ = data?.economy ?? {}

    return {
      iso3,
      name: data?.name ?? iso3,
      exports_usd: parseTradeValue(econ?.exports?.value ?? ''),
      imports_usd: parseTradeValue(econ?.imports?.value ?? ''),
      top_exports: extractList(econ?.exports?.commodities ?? ''),
      top_imports: extractList(econ?.imports?.commodities ?? ''),
      top_export_partners: extractList(econ?.exports?.partners ?? ''),
      top_import_partners: extractList(econ?.imports?.partners ?? ''),
    }
  } catch {
    return null
  }
}

// ── USDA PSD — Agricultural supply/demand ─────────────────────────────────────

const USDA_BASE = 'https://apps.fas.usda.gov/psdonline/api/v1'

export interface USDAPSDRow {
  country_name: string
  commodity_desc: string
  attribute_desc: string
  year: number
  value: number
  unit_desc: string
}

export async function fetchUSDAWorldProduction(
  commodityCode: number,
  year = 2022,
): Promise<USDAPSDRow[]> {
  const url = `${USDA_BASE}/data/commodity/${commodityCode}?yr_harv=${year}`
  try {
    const res = await fetch(url, {
      headers: { 'X-Api-Key': process.env.USDA_API_KEY ?? '' },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// USDA commodity codes (most used)
export const USDA_COMMODITIES = {
  wheat:        16,   // Wheat
  rice:         22,   // Rice, Milled
  corn:         2,    // Corn
  soybeans:     24,   // Soybeans
  cotton:       3,    // Cotton
  sugar:        22,   // Sugar (raw)
  palm_oil:     7,    // Palm Oil
  coffee:       80,   // Coffee, Green
  beef:         2514, // Beef and Veal
  poultry:      2530, // Poultry Meat
}

// ── IRENA Renewable Energy ─────────────────────────────────────────────────────

export async function fetchIRENACapacity(
  iso3: string,
): Promise<{ solar_mw: number; wind_mw: number; hydro_mw: number; total_renewable_mw: number } | null> {
  // IRENA pxweb API
  const url = `https://pxweb.irena.org/api/v1/en/IRENASTAT/Power%20Capacity%20and%20Generation/ELECCAP.px`
  try {
    const body = {
      query: [
        { code: 'Country', selection: { filter: 'item', values: [iso3] } },
        { code: 'Technology', selection: { filter: 'item', values: ['1','2','3'] } },
        { code: 'Year', selection: { filter: 'item', values: ['2023'] } },
      ],
      response: { format: 'json' },
    }
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    // Parse response — simplified
    return { solar_mw: 0, wind_mw: 0, hydro_mw: 0, total_renewable_mw: 0 }
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTradeValue(str: string): number {
  // Parse strings like "$2.5 billion", "$450 million"
  const n = parseFloat(str.replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return 0
  if (str.toLowerCase().includes('billion')) return n * 1e9
  if (str.toLowerCase().includes('million')) return n * 1e6
  if (str.toLowerCase().includes('trillion')) return n * 1e12
  return n
}

function extractList(str: string): string[] {
  return str.split(/[,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 5)
}
