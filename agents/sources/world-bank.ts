// @ts-nocheck
/**
 * World Bank Open Data + WITS — No auth required
 * Covers: 189+ countries, macro trade indicators + bilateral flows
 */

const WB_BASE  = 'https://api.worldbank.org/v2'
const WITS_BASE = 'https://wits.worldbank.org/API/V1/wits/datasource'

// ── Indicators map ────────────────────────────────────────────────────────────
export const WB_INDICATORS = {
  total_imports_usd:   'TM.VAL.MRCH.CD.WT',  // Merchandise imports (current USD)
  total_exports_usd:   'TX.VAL.MRCH.CD.WT',  // Merchandise exports (current USD)
  gdp_usd:             'NY.GDP.MKTP.CD',       // GDP (current USD)
  gdp_per_capita:      'NY.GDP.PCAP.CD',       // GDP per capita
  population:          'SP.POP.TOTL',          // Total population
  arable_land_pct:     'AG.LND.ARBL.ZS',       // Arable land (% of land area)
  land_area_km2:       'AG.LND.TOTL.K2',       // Land area (km²)
  ag_imports_usd:      'TM.VAL.FOOD.ZS.UN',    // Food imports (% merchandise imports)
  energy_imports_pct:  'EG.IMP.CONS.ZS',       // Energy imports (% energy use)
  fuel_imports_pct:    'TM.VAL.FUEL.ZS.UN',    // Fuel imports (% merchandise imports)
  manuf_imports_pct:   'TM.VAL.MANF.ZS.UN',    // Manufactures imports (%)
  tariff_rate:         'TM.TAX.MANF.SM.AR.ZS', // Applied tariff rate
  wage_workers_pct:    'SL.EMP.WORK.ZS',       // Wage and salaried workers (%)
  labor_force:         'SL.TLF.TOTL.IN',       // Labour force total
  internet_pct:        'IT.NET.USER.ZS',       // Internet users (%)
}

export async function fetchWorldBankIndicators(
  countries: string[], // ISO2 codes, or 'all'
  year = 2022,
): Promise<Record<string, Record<string, number>>> {
  const results: Record<string, Record<string, number>> = {}

  // Batch all indicators in one request per indicator using 'all' countries
  for (const [key, code] of Object.entries(WB_INDICATORS)) {
    const url = `${WB_BASE}/country/all/indicator/${code}?format=json&per_page=300&date=${year}`
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const [, rows] = await res.json() as [unknown, Array<{countryiso3code:string; value:number|null}>]
      for (const row of (rows ?? [])) {
        if (!row.countryiso3code || row.value == null) continue
        const iso = row.countryiso3code.toUpperCase()
        if (!results[iso]) results[iso] = {}
        results[iso][key] = row.value
      }
    } catch {}
    await sleep(200) // polite rate limiting
  }
  return results
}

export async function fetchWorldBankCountries(): Promise<Array<{
  id: string; iso2Code: string; name: string;
  region: { id: string; value: string };
  latitude: string; longitude: string;
}>> {
  const url = `${WB_BASE}/country?format=json&per_page=300`
  const res = await fetch(url)
  if (!res.ok) return []
  const [, rows] = await res.json()
  return (rows ?? []).filter((c: any) =>
    c.id?.length === 3 &&
    c.region?.id &&
    c.region.id !== 'NA' &&   // excludes aggregates
    parseFloat(c.latitude) !== 0
  )
}

// ── WITS bilateral trade flows ────────────────────────────────────────────────
// Returns top import partners + product categories for a country

export async function fetchWITSCountryImports(
  iso3: string,
  year = 2022,
): Promise<Array<{ product: string; value_usd: number; partner: string }>> {
  // WITS categorizes products differently — use aggregate categories
  const url = `${WITS_BASE}/tradestats-trade/reporter/${iso3}/year/${year}/partner/WLD/product/ALL/indicator/MPRT_VL`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    // Parse WITS XML/JSON response
    const items = data?.dataSets?.[0]?.series ?? {}
    return Object.values(items).map((s: any) => ({
      product: s.attributes?.PRODUCT ?? 'Unknown',
      value_usd: s.observations?.['0']?.[0] ?? 0,
      partner: 'WLD',
    })).filter((i: any) => i.value_usd > 0)
  } catch {
    return []
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
