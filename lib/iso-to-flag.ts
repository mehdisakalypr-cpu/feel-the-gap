// Single source of truth for ISO2 → emoji flag.
// Bug history: data-collector.ts and free-collector.ts both used 0x1F1E0
// (which falls BEFORE the Regional Indicator Symbol range starting at U+1F1E6),
// shifting every flag by -6 and producing tofu glyphs in the UI.
// The DB-side `iso2_to_flag()` SQL function uses the same constants.
// A BEFORE INSERT/UPDATE trigger on `countries` enforces this from the DB,
// so even if a future caller passes a wrong flag string, the DB will
// recompute it from `iso2`. This module exists for client-side rendering only.

const REGIONAL_INDICATOR_A = 0x1F1E6 // U+1F1E6 = 🇦
const ASCII_A = 65

export function iso2ToFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return '🏳'
  return String.fromCodePoint(
    ...iso2.toUpperCase().split('').map(c => REGIONAL_INDICATOR_A + c.charCodeAt(0) - ASCII_A)
  )
}
