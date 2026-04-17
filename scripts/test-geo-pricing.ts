/**
 * Quick spot-check for lib/geo-pricing.ts.
 * Run: npx tsx scripts/test-geo-pricing.ts
 */
import {
  getGeoPrice,
  countryCoverage,
  GEO_FLOOR,
  GEO_CAP,
} from '../lib/geo-pricing'

type Case = { cc: string; base: number; expectedMin: number; expectedMax: number; note?: string }

const BASE_STARTER = 29
const BASE_PREMIUM = 79
const BASE_DATA = 149 // reserved for future premium-plus tier

const cases: Case[] = [
  // FR → multiplier ~ 1.0
  { cc: 'FR', base: BASE_STARTER, expectedMin: 28, expectedMax: 30, note: 'FR at baseline' },
  // US → multiplier ~ 1.1 (Big Mac index places US above EU15 mean)
  { cc: 'US', base: BASE_STARTER, expectedMin: 31, expectedMax: 33, note: 'US ~1.1' },
  // MA → ~ 0.45
  { cc: 'MA', base: BASE_STARTER, expectedMin: 12, expectedMax: 14, note: 'Morocco ~0.45' },
  // IN → floor 0.40
  { cc: 'IN', base: BASE_STARTER, expectedMin: 11, expectedMax: 12, note: 'India floor' },
  // NG → floor 0.40
  { cc: 'NG', base: BASE_STARTER, expectedMin: 11, expectedMax: 12, note: 'Nigeria floor' },

  // Premium plan spot checks
  { cc: 'CH', base: BASE_PREMIUM, expectedMin: 100, expectedMax: 104, note: 'Swiss cap 1.30' },
  { cc: 'DE', base: BASE_PREMIUM, expectedMin: 78, expectedMax: 80 },
  { cc: 'BR', base: BASE_PREMIUM, expectedMin: 42, expectedMax: 44, note: 'Brazil ~0.55' },

  // Unknown country → EU default
  { cc: 'ZZ', base: BASE_STARTER, expectedMin: 29, expectedMax: 29, note: 'Unknown → 29€' },

  // Data plan (future 149€)
  { cc: 'FR', base: BASE_DATA, expectedMin: 148, expectedMax: 150 },
  { cc: 'IN', base: BASE_DATA, expectedMin: 59, expectedMax: 60, note: 'floor 0.40 * 149' },
]

let fails = 0
for (const c of cases) {
  const g = getGeoPrice(c.base, c.cc)
  const ok = g.price >= c.expectedMin && g.price <= c.expectedMax
  const mark = ok ? 'PASS' : 'FAIL'
  if (!ok) fails++
  const line = `${mark} ${c.cc.padEnd(3)} base=${c.base}€ → ${g.price}€ (x${g.multiplier.toFixed(2)}, ${g.currency})  [expected ${c.expectedMin}-${c.expectedMax}]${c.note ? '  — ' + c.note : ''}`
  console.log(line)
  if (g.multiplier < GEO_FLOOR - 1e-6 || g.multiplier > GEO_CAP + 1e-6) {
    console.log(`  !! multiplier out of bounds [${GEO_FLOOR}, ${GEO_CAP}]`)
    fails++
  }
}

console.log('')
console.log(`Countries covered: ${countryCoverage()}`)
console.log(`Floor=${GEO_FLOOR}  Cap=${GEO_CAP}`)

if (fails > 0) {
  console.error(`\n${fails} test(s) FAILED`)
  process.exit(1)
}
console.log('All spot checks passed.')
