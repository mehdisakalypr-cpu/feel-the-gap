// @ts-nocheck
/**
 * IMF Direction of Trade Statistics (DOTS/IMTS) — No auth required
 * Bilateral merchandise trade: 184 countries, monthly data from 1960
 */

const IMF_BASE = 'http://dataservices.imf.org/REST/SDMX_JSON.svc'

export interface IMFTradeFlow {
  reporter: string   // ISO2 code
  partner: string    // ISO2 code or 'W00' (world)
  year: number
  exports_usd: number
  imports_usd: number
}

export async function fetchIMFBilateralTrade(
  reporterISO2: string,
  year = 2022,
): Promise<IMFTradeFlow[]> {
  // DOTS dataset: TXG_FOB_USD = exports FOB, TMG_CIF_USD = imports CIF
  const url = `${IMF_BASE}/CompactData/DOT/A.${reporterISO2}..TXG_FOB_USD,TMG_CIF_USD.?startPeriod=${year}&endPeriod=${year}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []

    const data = await res.json()
    const series = data?.CompactData?.DataSet?.Series
    if (!series) return []

    const arr = Array.isArray(series) ? series : [series]
    const results: IMFTradeFlow[] = []

    for (const s of arr) {
      const indicator = s?.['@INDICATOR']
      const partner = s?.['@COUNTERPART_AREA'] ?? 'W00'
      const obs = s?.Obs

      if (!obs) continue
      const obArr = Array.isArray(obs) ? obs : [obs]
      const latestObs = obArr.find((o: any) => o?.['@TIME_PERIOD'] === String(year))
      if (!latestObs) continue

      const value = parseFloat(latestObs['@OBS_VALUE'] ?? '0') * 1e6

      const existing = results.find(r => r.partner === partner)
      if (existing) {
        if (indicator === 'TXG_FOB_USD') existing.exports_usd = value
        if (indicator === 'TMG_CIF_USD') existing.imports_usd = value
      } else {
        results.push({
          reporter: reporterISO2,
          partner,
          year,
          exports_usd: indicator === 'TXG_FOB_USD' ? value : 0,
          imports_usd: indicator === 'TMG_CIF_USD' ? value : 0,
        })
      }
    }

    return results
  } catch {
    return []
  }
}

// Fetch world total for a country (partner = 'W00')
export async function fetchIMFWorldTotals(
  year = 2022,
): Promise<Record<string, { exports_usd: number; imports_usd: number }>> {
  // Use CompactData for all countries at once
  const url = `${IMF_BASE}/CompactData/DOT/A...W00.TXG_FOB_USD,TMG_CIF_USD.?startPeriod=${year}&endPeriod=${year}`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return {}

    const data = await res.json()
    const series = data?.CompactData?.DataSet?.Series
    if (!series) return {}

    const arr = Array.isArray(series) ? series : [series]
    const result: Record<string, { exports_usd: number; imports_usd: number }> = {}

    for (const s of arr) {
      const reporter = s?.['@REF_AREA']
      const indicator = s?.['@INDICATOR']
      const obs = s?.Obs
      if (!reporter || !obs) continue

      const obArr = Array.isArray(obs) ? obs : [obs]
      const latestObs = obArr.find((o: any) => o?.['@TIME_PERIOD'] === String(year))
      if (!latestObs) continue

      const value = parseFloat(latestObs['@OBS_VALUE'] ?? '0') * 1e6
      if (!result[reporter]) result[reporter] = { exports_usd: 0, imports_usd: 0 }
      if (indicator === 'TXG_FOB_USD') result[reporter].exports_usd = value
      if (indicator === 'TMG_CIF_USD') result[reporter].imports_usd = value
    }

    return result
  } catch {
    return {}
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
