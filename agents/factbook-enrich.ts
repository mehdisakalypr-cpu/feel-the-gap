// @ts-nocheck
/**
 * Enrichit les pays en DB avec les données CIA World Factbook (GitHub, fiable)
 * Usage: npx tsx agents/factbook-enrich.ts
 */

import { supabaseAdmin } from '@/lib/supabase'

const admin = supabaseAdmin()

// Factbook uses its own 2-letter codes (different from ISO2!)
const FACTBOOK_CODES: Record<string, { code: string; region: string }> = {
  ALB: { code: 'al', region: 'europe' },
  AND: { code: 'ad', region: 'europe' },
  AUT: { code: 'au', region: 'europe' },
  BEL: { code: 'be', region: 'europe' },
  BIH: { code: 'bk', region: 'europe' },
  BGR: { code: 'bu', region: 'europe' },
  HRV: { code: 'hr', region: 'europe' },
  CYP: { code: 'cy', region: 'europe' },
  CZE: { code: 'ez', region: 'europe' },
  DNK: { code: 'da', region: 'europe' },
  EST: { code: 'en', region: 'europe' },
  FIN: { code: 'fi', region: 'europe' },
  FRA: { code: 'fr', region: 'europe' },
  DEU: { code: 'gm', region: 'europe' },
  GRC: { code: 'gr', region: 'europe' },
  HUN: { code: 'hu', region: 'europe' },
  ISL: { code: 'ic', region: 'europe' },
  IRL: { code: 'ei', region: 'europe' },
  ITA: { code: 'it', region: 'europe' },
  LVA: { code: 'lg', region: 'europe' },
  LIE: { code: 'ls', region: 'europe' },
  LTU: { code: 'lh', region: 'europe' },
  LUX: { code: 'lu', region: 'europe' },
  MLT: { code: 'mt', region: 'europe' },
  MDA: { code: 'md', region: 'europe' },
  MNE: { code: 'mj', region: 'europe' },
  NLD: { code: 'nl', region: 'europe' },
  MKD: { code: 'mk', region: 'europe' },
  NOR: { code: 'no', region: 'europe' },
  POL: { code: 'pl', region: 'europe' },
  PRT: { code: 'po', region: 'europe' },
  ROU: { code: 'ro', region: 'europe' },
  SRB: { code: 'ri', region: 'europe' },
  SVK: { code: 'lo', region: 'europe' },
  SVN: { code: 'si', region: 'europe' },
  ESP: { code: 'sp', region: 'europe' },
  SWE: { code: 'sw', region: 'europe' },
  CHE: { code: 'sz', region: 'europe' },
  UKR: { code: 'up', region: 'europe' },
  GBR: { code: 'uk', region: 'europe' },
  BLR: { code: 'bo', region: 'europe' },
  RUS: { code: 'rs', region: 'europe' },
  USA: { code: 'us', region: 'north-america' },
  CAN: { code: 'ca', region: 'north-america' },
  MEX: { code: 'mx', region: 'north-america' },
  BRA: { code: 'br', region: 'south-america' },
  ARG: { code: 'ar', region: 'south-america' },
  CHL: { code: 'ci', region: 'south-america' },
  COL: { code: 'co', region: 'south-america' },
  PER: { code: 'pe', region: 'south-america' },
  BOL: { code: 'bl', region: 'south-america' },
  PRY: { code: 'pa', region: 'south-america' },
  URY: { code: 'uy', region: 'south-america' },
  ECU: { code: 'ec', region: 'south-america' },
  GUY: { code: 'gy', region: 'south-america' },
  SUR: { code: 'ns', region: 'south-america' },
  JAM: { code: 'jm', region: 'central-america-n-caribbean' },
  TTO: { code: 'td', region: 'central-america-n-caribbean' },
  BRB: { code: 'bb', region: 'central-america-n-caribbean' },
  BLZ: { code: 'bh', region: 'central-america-n-caribbean' },
  SLV: { code: 'es', region: 'central-america-n-caribbean' },
  NIC: { code: 'nu', region: 'central-america-n-caribbean' },
  HTI: { code: 'ha', region: 'central-america-n-caribbean' },
  CHN: { code: 'ch', region: 'east-n-southeast-asia' },
  JPN: { code: 'ja', region: 'east-n-southeast-asia' },
  KOR: { code: 'ks', region: 'east-n-southeast-asia' },
  TWN: { code: 'tw', region: 'east-n-southeast-asia' },
  HKG: { code: 'hk', region: 'east-n-southeast-asia' },
  SGP: { code: 'sn', region: 'east-n-southeast-asia' },
  MYS: { code: 'my', region: 'east-n-southeast-asia' },
  THA: { code: 'th', region: 'east-n-southeast-asia' },
  IDN: { code: 'id', region: 'east-n-southeast-asia' },
  VNM: { code: 'vm', region: 'east-n-southeast-asia' },
  PHL: { code: 'rp', region: 'east-n-southeast-asia' },
  MMR: { code: 'bm', region: 'east-n-southeast-asia' },
  KHM: { code: 'cb', region: 'east-n-southeast-asia' },
  LAO: { code: 'la', region: 'east-n-southeast-asia' },
  BRN: { code: 'bx', region: 'east-n-southeast-asia' },
  IND: { code: 'in', region: 'south-asia' },
  PAK: { code: 'pk', region: 'south-asia' },
  BGD: { code: 'bg', region: 'south-asia' },
  LKA: { code: 'ce', region: 'south-asia' },
  NPL: { code: 'np', region: 'south-asia' },
  AUS: { code: 'as', region: 'australia-oceania' },
  NZL: { code: 'nz', region: 'australia-oceania' },
  SAU: { code: 'sa', region: 'middle-east' },
  ARE: { code: 'ae', region: 'middle-east' },
  IRN: { code: 'ir', region: 'middle-east' },
  IRQ: { code: 'iz', region: 'middle-east' },
  ISR: { code: 'is', region: 'middle-east' },
  JOR: { code: 'jo', region: 'middle-east' },
  KWT: { code: 'ku', region: 'middle-east' },
  LBN: { code: 'le', region: 'middle-east' },
  OMN: { code: 'mu', region: 'middle-east' },
  QAT: { code: 'qa', region: 'middle-east' },
  SYR: { code: 'sy', region: 'middle-east' },
  TUR: { code: 'tu', region: 'middle-east' },
  YEM: { code: 'ym', region: 'middle-east' },
  BHR: { code: 'ba', region: 'middle-east' },
  GEO: { code: 'gg', region: 'middle-east' },
  ARM: { code: 'am', region: 'middle-east' },
  AZE: { code: 'aj', region: 'middle-east' },
  EGY: { code: 'eg', region: 'africa' },
  NGA: { code: 'ni', region: 'africa' },
  ZAF: { code: 'sf', region: 'africa' },
  ETH: { code: 'et', region: 'africa' },
  KEN: { code: 'ke', region: 'africa' },
  MAR: { code: 'mo', region: 'africa' },
  TZA: { code: 'tz', region: 'africa' },
  GHA: { code: 'gh', region: 'africa' },
  COD: { code: 'cg', region: 'africa' },
  DZA: { code: 'ag', region: 'africa' },
  TUN: { code: 'ts', region: 'africa' },
  CMR: { code: 'cm', region: 'africa' },
  CIV: { code: 'iv', region: 'africa' },
  SEN: { code: 'sg', region: 'africa' },
  MLI: { code: 'ml', region: 'africa' },
  KAZ: { code: 'kz', region: 'central-asia' },
  UZB: { code: 'uz', region: 'central-asia' },
  TKM: { code: 'tx', region: 'central-asia' },
  TJK: { code: 'ti', region: 'central-asia' },
  KGZ: { code: 'kg', region: 'central-asia' },
}

async function enrichCountry(iso3: string): Promise<boolean> {
  const entry = FACTBOOK_CODES[iso3]
  if (!entry) return false

  try {
    const url = `https://raw.githubusercontent.com/factbook/factbook.json/master/${entry.region}/${entry.code}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return false
    const json = await res.json()

    const updates: any = {}

    // Top imports text
    const imports = json?.Economy?.['Imports - commodities']?.text
    if (imports) updates.top_import_text = imports.slice(0, 500)

    // Top exports text (for context)
    const exports = json?.Economy?.['Exports - commodities']?.text
    if (exports) updates.top_export_text = exports.slice(0, 500)

    if (Object.keys(updates).length > 0) {
      await admin.from('countries').update(updates).eq('id', iso3)
      return true
    }
    return false
  } catch {
    return false
  }
}

async function main() {
  const { data: countries } = await admin.from('countries').select('id')
  const isos = (countries ?? []).map((c: any) => c.id)
  console.log(`[FactbookEnrich] ${isos.length} countries to enrich`)

  let enriched = 0
  let failed = 0
  for (const iso of isos) {
    const ok = await enrichCountry(iso)
    if (ok) { enriched++; console.log(`✓ ${iso}`) }
    else { failed++; console.log(`✗ ${iso} (no data)`) }
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`[FactbookEnrich] Done: ${enriched} enriched, ${failed} skipped`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
