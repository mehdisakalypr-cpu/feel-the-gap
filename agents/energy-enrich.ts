// @ts-nocheck
/**
 * Enrichit les pays avec les données énergétiques OWID
 * - renewable_pct : % électricité renouvelable (OWID 2022)
 * - energy_cost_index : indice coût énergie 0-100 (0=très bon marché, 100=très cher)
 * Usage: npx tsx agents/energy-enrich.ts
 */

import { supabaseAdmin } from '@/lib/supabase'

const admin = supabaseAdmin()

async function fetchOWIDRenewables(): Promise<Record<string, number>> {
  const url = 'https://ourworldindata.org/grapher/share-electricity-renewables.csv?tab=chart&time=2022'
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`OWID HTTP ${res.status}`)
  const text = await res.text()

  const result: Record<string, number> = {}
  const lines = text.split('\n').slice(1) // skip header
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length < 4) continue
    const code = parts[1]?.trim()
    const year = parts[2]?.trim()
    const val = parseFloat(parts[3]?.trim() ?? '')
    if (code && code.length === 3 && year === '2022' && !isNaN(val)) {
      result[code] = Math.round(val * 10) / 10
    }
  }
  return result
}

// Energy cost index: higher renewable % = lower cost index
// Also factors in region (Africa/Asia = lower grid cost base)
function computeEnergyCostIndex(renewablePct: number, region: string): number {
  // Base: pure fossil = 80, pure renewable = 20
  const base = Math.round(80 - (renewablePct / 100) * 60)

  // Regional adjustment: developing regions have lower industrial energy costs
  const regionAdj: Record<string, number> = {
    'Africa': -10,
    'Asia': -5,
    'Americas': 0,
    'Europe': +8,
    'Oceania': +5,
  }
  const adj = regionAdj[region] ?? 0
  return Math.max(10, Math.min(95, base + adj))
}

async function main() {
  console.log('[EnergyEnrich] Fetching OWID renewables data...')
  const renewables = await fetchOWIDRenewables()
  console.log(`[EnergyEnrich] Got data for ${Object.keys(renewables).length} countries`)

  const { data: countries } = await admin.from('countries').select('id, region')
  if (!countries?.length) { console.error('No countries in DB'); process.exit(1) }

  let updated = 0
  let missing = 0

  for (const country of countries) {
    const pct = renewables[country.id]
    if (pct === undefined) { missing++; continue }

    const energyCostIndex = computeEnergyCostIndex(pct, country.region ?? 'Africa')

    const { error } = await admin.from('countries').update({
      renewable_pct: pct,
      energy_cost_index: energyCostIndex,
    }).eq('id', country.id)

    if (!error) {
      updated++
      console.log(`✓ ${country.id}: ${pct}% renouvelable → coût énergie ${energyCostIndex}/100`)
    } else {
      console.log(`✗ ${country.id}: ${error.message}`)
    }
    await new Promise(r => setTimeout(r, 50))
  }

  console.log(`[EnergyEnrich] Done: ${updated} updated, ${missing} no OWID data`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
