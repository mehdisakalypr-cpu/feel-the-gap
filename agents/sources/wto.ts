// @ts-nocheck
/**
 * WTO Statistics API — No auth required
 * Merchandise trade + services trade for all WTO members
 */

const WTO_BASE = 'https://stats.wto.org/api'

export interface WTODataPoint {
  reporterCode: string
  reporterLabel: string
  indicatorCode: string
  indicatorLabel: string
  year: number
  value: number
  unit: string
}

// Key WTO indicators for trade intelligence
const WTO_INDICATORS = [
  { code: 'ITS_MTV_AX',  label: 'Merchandise exports (USD)',  flow: 'export' },
  { code: 'ITS_MTV_AM',  label: 'Merchandise imports (USD)',  flow: 'import' },
  { code: 'ITS_CS_AX',   label: 'Services exports (USD)',     flow: 'export' },
  { code: 'ITS_CS_AM',   label: 'Services imports (USD)',     flow: 'import' },
]

export async function fetchWTOMerchandiseTrade(
  year = 2022,
): Promise<Record<string, { exports_usd: number; imports_usd: number }>> {
  const result: Record<string, { exports_usd: number; imports_usd: number }> = {}

  try {
    // WTO timeseries endpoint
    const url = `${WTO_BASE}/v1/indicator/${year}?`
    // Try direct data download (CSV format more reliable for bulk)
    const csvUrl = `https://stats.wto.org/indicator/ITS_MTV_AM,ITS_MTV_AX/year/${year}?format=csv`
    const res = await fetch(csvUrl)
    if (!res.ok) return result

    const text = await res.text()
    const lines = text.split('\n').slice(1) // skip header
    for (const line of lines) {
      const parts = line.split(',')
      if (parts.length < 6) continue
      const [reporterCode, , indicatorCode, , , valueStr] = parts
      const value = parseFloat(valueStr)
      if (!reporterCode || isNaN(value)) continue

      if (!result[reporterCode]) result[reporterCode] = { exports_usd: 0, imports_usd: 0 }
      if (indicatorCode?.includes('AX')) result[reporterCode].exports_usd = value * 1e6
      if (indicatorCode?.includes('AM')) result[reporterCode].imports_usd = value * 1e6
    }
  } catch {}

  return result
}

// Sector-level WTO trade data
export async function fetchWTOSectoralTrade(
  reporterIso: string,
  year = 2022,
): Promise<Array<{ sector: string; imports_usd: number; exports_usd: number }>> {
  const sectors = [
    { code: 'ITS_MTV_AM_AG', label: 'agricultural' },
    { code: 'ITS_MTV_AM_FU', label: 'fuels'        },
    { code: 'ITS_MTV_AM_MA', label: 'manufactured'  },
    { code: 'ITS_MTV_AM_MI', label: 'materials'     },
  ]

  const results = []
  for (const sector of sectors) {
    try {
      const url = `${WTO_BASE}/v1/indicator/${sector.code}/reporter/${reporterIso}/year/${year}?format=json`
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      const value = data?.data?.[0]?.value ?? 0
      results.push({ sector: sector.label, imports_usd: value * 1e6, exports_usd: 0 })
    } catch {}
    await sleep(300)
  }
  return results
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
