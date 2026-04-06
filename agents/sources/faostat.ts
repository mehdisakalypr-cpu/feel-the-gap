// @ts-nocheck
/**
 * FAOSTAT API — No auth required
 * Agricultural trade: 245+ countries, crops/livestock/fisheries
 * from 1961 to present
 */

const FAO_BASE = 'https://www.fao.org/faostat/api/v1'

// FAOSTAT dataset codes for trade
const FAO_DATASETS = {
  crop_trade:      'TCL',   // Trade - Crops and livestock products
  detailed_trade:  'TM',    // Trade - Detailed trade matrix
  food_balances:   'FBS',   // Food Balance Sheets
  production:      'QCL',   // Crops and livestock products
}

// Key agricultural items (FAO item codes)
export const FAO_KEY_ITEMS = [
  { code: '15',   name: 'Wheat',            hs2: '10', subcategory: 'cereals' },
  { code: '27',   name: 'Rice (paddy)',      hs2: '10', subcategory: 'cereals' },
  { code: '56',   name: 'Maize (corn)',      hs2: '10', subcategory: 'cereals' },
  { code: '236',  name: 'Soybeans',          hs2: '12', subcategory: 'oilseeds' },
  { code: '257',  name: 'Palm oil',          hs2: '15', subcategory: 'oilseeds' },
  { code: '406',  name: 'Sugar (raw)',       hs2: '17', subcategory: 'sugar' },
  { code: '574',  name: 'Tomatoes',          hs2: '07', subcategory: 'vegetables' },
  { code: '397',  name: 'Onions (dry)',      hs2: '07', subcategory: 'vegetables' },
  { code: '490',  name: 'Oranges',           hs2: '08', subcategory: 'fruits' },
  { code: '446',  name: 'Bananas',           hs2: '08', subcategory: 'fruits' },
  { code: '867',  name: 'Bovine meat',       hs2: '02', subcategory: 'meat' },
  { code: '1058', name: 'Poultry meat',      hs2: '02', subcategory: 'meat' },
  { code: '2761', name: 'Fish (marine)',     hs2: '03', subcategory: 'seafood' },
  { code: '882',  name: 'Whole milk',        hs2: '04', subcategory: 'dairy' },
  { code: '767',  name: 'Cotton lint',       hs2: '52', subcategory: 'textiles' },
  { code: '661',  name: 'Coffee (green)',    hs2: '09', subcategory: 'beverages' },
  { code: '656',  name: 'Cocoa (beans)',     hs2: '18', subcategory: 'beverages' },
]

export interface FAOTradeRow {
  country_iso: string
  item_code: string
  item_name: string
  year: number
  flow: 'import' | 'export'
  value_usd: number
  quantity_tonnes: number | null
  unit: string
}

export async function fetchFAOCountryTrade(
  faoCountryCode: string | number,
  year = 2022,
  flow: 'Import Quantity' | 'Export Quantity' | 'Import Value' | 'Export Value' = 'Import Value',
): Promise<FAOTradeRow[]> {
  const url = `${FAO_BASE}/data/TCL?`
  const params = new URLSearchParams({
    area: String(faoCountryCode),
    element: flow === 'Import Value' ? '62' : flow === 'Export Value' ? '57' : flow === 'Import Quantity' ? '61' : '56',
    year: String(year),
    output_type: 'objects',
    download_data: 'false',
  })

  try {
    const res = await fetch(`${FAO_BASE}/data/TCL?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data ?? []).map((row: any) => ({
      country_iso: String(faoCountryCode),
      item_code: String(row.Item_Code ?? ''),
      item_name: row.Item ?? '',
      year: parseInt(row.Year ?? year),
      flow: flow.includes('Import') ? 'import' : 'export',
      value_usd: parseFloat(row.Value ?? 0) * 1000, // FAO values in 1000 USD
      quantity_tonnes: row.Unit === 't' ? parseFloat(row.Value ?? 0) : null,
      unit: row.Unit ?? '',
    }))
  } catch {
    return []
  }
}

// Fetch all countries bulk trade — uses FAO bulk download
export async function fetchFAOBulkTrade(year = 2022): Promise<string> {
  // FAO provides bulk CSV downloads
  const url = `${FAO_BASE}/data/TCL?area=*&element=62,57&year=${year}&output_type=csv`
  try {
    const res = await fetch(url)
    return res.ok ? await res.text() : ''
  } catch {
    return ''
  }
}

// FAO country code lookup (FAO uses different numeric codes than ISO)
export const FAO_COUNTRY_MAP: Record<string, number> = {
  'MAR': 143, 'TUN': 222, 'TZA': 215, 'ZAF': 202, 'NAM': 153,
  'ARE': 225, 'NGA': 159, 'ETH': 62,  'KEN': 114, 'EGY': 59,
  'IND': 100, 'PAK': 165, 'BGD': 16,  'IDN': 101, 'VNM': 237,
  'THA': 216, 'PHL': 171, 'MMR': 149, 'BRA': 21,  'MEX': 138,
  'COL': 44,  'PER': 169, 'ARG': 9,   'SAU': 193, 'IRN': 102,
  'TUR': 223, 'CHN': 351, 'USA': 231, 'FRA': 68,  'DEU': 79,
  'RUS': 185, 'GBR': 229, 'JPN': 110, 'KOR': 116, 'AUS': 10,
  'CAN': 33,  'ESP': 203, 'ITA': 106, 'UKR': 230, 'POL': 174,
  'GHA': 81,  'CIV': 45,  'CMR': 32,  'SEN': 195, 'MLI': 134,
  'BFA': 233, 'MOZ': 150, 'ZMB': 251, 'ZWE': 181, 'AGO': 7,
  'COD': 250, 'MWI': 130, 'RWA': 184, 'UGA': 226, 'SDN': 206,
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
