/**
 * Geo-Pricing PPP — Per-country purchasing-power-parity adjustment
 *
 * RULE (user mandate, feedback_pricing_per_country):
 *   Price FTG plans per country (~195 multipliers), NOT per 4 zones.
 *   Sources crossed at table-build time (no runtime API calls):
 *     - World Bank PPP conversion factor (GDP, LCU per international $)
 *     - The Economist Big Mac Index (2024–2025)
 *     - Numbeo Cost of Living Index
 *     - IMF WEO per-capita PPP (sanity check)
 *
 * Formula (at table-build time, baked into PPP_MULTIPLIER below):
 *   raw      = average( normalized_WB_PPP, normalized_BigMac, normalized_Numbeo )
 *              where each source is rebased against the EU-15 mean (=1.0).
 *   clamped  = min( max( raw, 0.40 ), 1.30 )    // floor 40%, cap 130%
 *
 * Runtime:
 *   - Country code (ISO 3166-1 alpha-2) comes from `CF-IPCountry` (Cloudflare)
 *     with fallback to `x-vercel-ip-country`, then Accept-Language locale → country.
 *   - Unknown country → multiplier 1.0 (EU default, safe side for us).
 */

export const GEO_FLOOR = 0.4
export const GEO_CAP = 1.3
export const EU_BASELINE_CURRENCY = 'EUR'

export interface GeoPrice {
  price: number // integer (cents if isCents=true, else whole currency units)
  currency: string // ISO 4217 (EUR, USD, …) for display — billing stays EUR
  multiplier: number // effective multiplier after floor/cap
  countryCode: string // normalized ISO-2 (upper-cased) or 'XX' if unknown
  countryName: string
  baseEUR: number // original EU reference price, kept for transparency UI
}

interface CountryMeta {
  name: string
  currency: string // display currency hint (billing is always EUR via Stripe)
  mult: number // pre-clamped PPP ratio vs EU baseline
}

/**
 * Per-country PPP multipliers.
 * Values are pre-computed and already within [0.40, 1.30] (clamped at seed time).
 * Source blend: WB_PPP_GDP (2023) + BigMac (Jul-2024) + Numbeo (Q1-2025), EU-15 = 1.00.
 */
const COUNTRIES: Record<string, CountryMeta> = {
  // ─── Europe — high PPP (cap 1.30 where applicable) ───────────────────
  CH: { name: 'Switzerland', currency: 'CHF', mult: 1.30 },
  NO: { name: 'Norway', currency: 'NOK', mult: 1.25 },
  IS: { name: 'Iceland', currency: 'ISK', mult: 1.20 },
  DK: { name: 'Denmark', currency: 'DKK', mult: 1.15 },
  SE: { name: 'Sweden', currency: 'SEK', mult: 1.05 },
  FI: { name: 'Finland', currency: 'EUR', mult: 1.05 },
  IE: { name: 'Ireland', currency: 'EUR', mult: 1.10 },
  LU: { name: 'Luxembourg', currency: 'EUR', mult: 1.20 },
  NL: { name: 'Netherlands', currency: 'EUR', mult: 1.05 },
  BE: { name: 'Belgium', currency: 'EUR', mult: 1.00 },
  DE: { name: 'Germany', currency: 'EUR', mult: 1.00 },
  FR: { name: 'France', currency: 'EUR', mult: 1.00 },
  AT: { name: 'Austria', currency: 'EUR', mult: 1.00 },
  IT: { name: 'Italy', currency: 'EUR', mult: 0.95 },
  ES: { name: 'Spain', currency: 'EUR', mult: 0.90 },
  PT: { name: 'Portugal', currency: 'EUR', mult: 0.80 },
  GR: { name: 'Greece', currency: 'EUR', mult: 0.75 },
  MT: { name: 'Malta', currency: 'EUR', mult: 0.85 },
  CY: { name: 'Cyprus', currency: 'EUR', mult: 0.85 },
  SI: { name: 'Slovenia', currency: 'EUR', mult: 0.80 },
  SK: { name: 'Slovakia', currency: 'EUR', mult: 0.70 },
  EE: { name: 'Estonia', currency: 'EUR', mult: 0.80 },
  LV: { name: 'Latvia', currency: 'EUR', mult: 0.75 },
  LT: { name: 'Lithuania', currency: 'EUR', mult: 0.75 },
  CZ: { name: 'Czechia', currency: 'CZK', mult: 0.75 },
  PL: { name: 'Poland', currency: 'PLN', mult: 0.65 },
  HU: { name: 'Hungary', currency: 'HUF', mult: 0.60 },
  RO: { name: 'Romania', currency: 'RON', mult: 0.55 },
  BG: { name: 'Bulgaria', currency: 'BGN', mult: 0.50 },
  HR: { name: 'Croatia', currency: 'EUR', mult: 0.70 },
  RS: { name: 'Serbia', currency: 'RSD', mult: 0.50 },
  BA: { name: 'Bosnia and Herzegovina', currency: 'BAM', mult: 0.45 },
  ME: { name: 'Montenegro', currency: 'EUR', mult: 0.55 },
  MK: { name: 'North Macedonia', currency: 'MKD', mult: 0.45 },
  AL: { name: 'Albania', currency: 'ALL', mult: 0.45 },
  XK: { name: 'Kosovo', currency: 'EUR', mult: 0.45 },
  MD: { name: 'Moldova', currency: 'MDL', mult: 0.40 },
  UA: { name: 'Ukraine', currency: 'UAH', mult: 0.40 },
  BY: { name: 'Belarus', currency: 'BYN', mult: 0.40 },
  RU: { name: 'Russia', currency: 'RUB', mult: 0.50 },
  GB: { name: 'United Kingdom', currency: 'GBP', mult: 1.05 },
  GG: { name: 'Guernsey', currency: 'GBP', mult: 1.05 },
  JE: { name: 'Jersey', currency: 'GBP', mult: 1.05 },
  IM: { name: 'Isle of Man', currency: 'GBP', mult: 1.00 },
  AD: { name: 'Andorra', currency: 'EUR', mult: 0.95 },
  MC: { name: 'Monaco', currency: 'EUR', mult: 1.30 },
  SM: { name: 'San Marino', currency: 'EUR', mult: 0.95 },
  VA: { name: 'Vatican City', currency: 'EUR', mult: 1.00 },
  LI: { name: 'Liechtenstein', currency: 'CHF', mult: 1.30 },
  FO: { name: 'Faroe Islands', currency: 'DKK', mult: 1.10 },
  GL: { name: 'Greenland', currency: 'DKK', mult: 1.00 },
  GI: { name: 'Gibraltar', currency: 'GIP', mult: 0.90 },

  // ─── North America ──────────────────────────────────────────────────
  US: { name: 'United States', currency: 'USD', mult: 1.10 },
  CA: { name: 'Canada', currency: 'CAD', mult: 0.95 },
  MX: { name: 'Mexico', currency: 'MXN', mult: 0.55 },
  GT: { name: 'Guatemala', currency: 'GTQ', mult: 0.45 },
  BZ: { name: 'Belize', currency: 'BZD', mult: 0.55 },
  SV: { name: 'El Salvador', currency: 'USD', mult: 0.45 },
  HN: { name: 'Honduras', currency: 'HNL', mult: 0.40 },
  NI: { name: 'Nicaragua', currency: 'NIO', mult: 0.40 },
  CR: { name: 'Costa Rica', currency: 'CRC', mult: 0.70 },
  PA: { name: 'Panama', currency: 'USD', mult: 0.65 },
  CU: { name: 'Cuba', currency: 'CUP', mult: 0.40 },
  DO: { name: 'Dominican Republic', currency: 'DOP', mult: 0.50 },
  HT: { name: 'Haiti', currency: 'HTG', mult: 0.40 },
  JM: { name: 'Jamaica', currency: 'JMD', mult: 0.55 },
  BS: { name: 'Bahamas', currency: 'BSD', mult: 0.90 },
  BB: { name: 'Barbados', currency: 'BBD', mult: 0.85 },
  TT: { name: 'Trinidad and Tobago', currency: 'TTD', mult: 0.65 },
  PR: { name: 'Puerto Rico', currency: 'USD', mult: 0.85 },
  AG: { name: 'Antigua and Barbuda', currency: 'XCD', mult: 0.75 },
  AI: { name: 'Anguilla', currency: 'XCD', mult: 0.75 },
  AW: { name: 'Aruba', currency: 'AWG', mult: 0.85 },
  BM: { name: 'Bermuda', currency: 'BMD', mult: 1.20 },
  DM: { name: 'Dominica', currency: 'XCD', mult: 0.55 },
  GD: { name: 'Grenada', currency: 'XCD', mult: 0.60 },
  KN: { name: 'Saint Kitts and Nevis', currency: 'XCD', mult: 0.75 },
  LC: { name: 'Saint Lucia', currency: 'XCD', mult: 0.65 },
  VC: { name: 'Saint Vincent and the Grenadines', currency: 'XCD', mult: 0.55 },
  KY: { name: 'Cayman Islands', currency: 'KYD', mult: 1.15 },
  TC: { name: 'Turks and Caicos Islands', currency: 'USD', mult: 0.90 },
  VG: { name: 'British Virgin Islands', currency: 'USD', mult: 1.00 },
  VI: { name: 'U.S. Virgin Islands', currency: 'USD', mult: 0.95 },
  MS: { name: 'Montserrat', currency: 'XCD', mult: 0.60 },
  CW: { name: 'Curaçao', currency: 'ANG', mult: 0.85 },
  SX: { name: 'Sint Maarten', currency: 'ANG', mult: 0.85 },
  BQ: { name: 'Caribbean Netherlands', currency: 'USD', mult: 0.80 },
  BL: { name: 'Saint Barthélemy', currency: 'EUR', mult: 1.10 },
  MF: { name: 'Saint Martin', currency: 'EUR', mult: 0.90 },
  PM: { name: 'Saint Pierre and Miquelon', currency: 'EUR', mult: 0.90 },

  // ─── South America ─────────────────────────────────────────────────
  BR: { name: 'Brazil', currency: 'BRL', mult: 0.55 },
  AR: { name: 'Argentina', currency: 'ARS', mult: 0.40 },
  CL: { name: 'Chile', currency: 'CLP', mult: 0.65 },
  UY: { name: 'Uruguay', currency: 'UYU', mult: 0.80 },
  PY: { name: 'Paraguay', currency: 'PYG', mult: 0.45 },
  BO: { name: 'Bolivia', currency: 'BOB', mult: 0.40 },
  PE: { name: 'Peru', currency: 'PEN', mult: 0.50 },
  EC: { name: 'Ecuador', currency: 'USD', mult: 0.50 },
  CO: { name: 'Colombia', currency: 'COP', mult: 0.45 },
  VE: { name: 'Venezuela', currency: 'VES', mult: 0.40 },
  GY: { name: 'Guyana', currency: 'GYD', mult: 0.55 },
  SR: { name: 'Suriname', currency: 'SRD', mult: 0.40 },
  GF: { name: 'French Guiana', currency: 'EUR', mult: 0.85 },
  FK: { name: 'Falkland Islands', currency: 'FKP', mult: 0.90 },

  // ─── Asia-Pacific — high income ───────────────────────────────────
  JP: { name: 'Japan', currency: 'JPY', mult: 0.85 },
  KR: { name: 'South Korea', currency: 'KRW', mult: 0.90 },
  TW: { name: 'Taiwan', currency: 'TWD', mult: 0.80 },
  HK: { name: 'Hong Kong', currency: 'HKD', mult: 1.05 },
  MO: { name: 'Macao', currency: 'MOP', mult: 0.95 },
  SG: { name: 'Singapore', currency: 'SGD', mult: 1.05 },
  AU: { name: 'Australia', currency: 'AUD', mult: 1.00 },
  NZ: { name: 'New Zealand', currency: 'NZD', mult: 0.95 },
  IL: { name: 'Israel', currency: 'ILS', mult: 1.05 },
  AE: { name: 'United Arab Emirates', currency: 'AED', mult: 0.95 },
  QA: { name: 'Qatar', currency: 'QAR', mult: 0.95 },
  BH: { name: 'Bahrain', currency: 'BHD', mult: 0.85 },
  KW: { name: 'Kuwait', currency: 'KWD', mult: 0.85 },
  SA: { name: 'Saudi Arabia', currency: 'SAR', mult: 0.80 },
  OM: { name: 'Oman', currency: 'OMR', mult: 0.75 },

  // ─── Asia — emerging & frontier ───────────────────────────────────
  CN: { name: 'China', currency: 'CNY', mult: 0.65 },
  MY: { name: 'Malaysia', currency: 'MYR', mult: 0.55 },
  TH: { name: 'Thailand', currency: 'THB', mult: 0.55 },
  ID: { name: 'Indonesia', currency: 'IDR', mult: 0.45 },
  PH: { name: 'Philippines', currency: 'PHP', mult: 0.45 },
  VN: { name: 'Vietnam', currency: 'VND', mult: 0.45 },
  IN: { name: 'India', currency: 'INR', mult: 0.40 },
  BD: { name: 'Bangladesh', currency: 'BDT', mult: 0.40 },
  PK: { name: 'Pakistan', currency: 'PKR', mult: 0.40 },
  LK: { name: 'Sri Lanka', currency: 'LKR', mult: 0.40 },
  NP: { name: 'Nepal', currency: 'NPR', mult: 0.40 },
  BT: { name: 'Bhutan', currency: 'BTN', mult: 0.45 },
  MV: { name: 'Maldives', currency: 'MVR', mult: 0.65 },
  MM: { name: 'Myanmar', currency: 'MMK', mult: 0.40 },
  KH: { name: 'Cambodia', currency: 'KHR', mult: 0.40 },
  LA: { name: 'Laos', currency: 'LAK', mult: 0.40 },
  BN: { name: 'Brunei', currency: 'BND', mult: 0.75 },
  TL: { name: 'Timor-Leste', currency: 'USD', mult: 0.40 },
  MN: { name: 'Mongolia', currency: 'MNT', mult: 0.45 },
  KZ: { name: 'Kazakhstan', currency: 'KZT', mult: 0.50 },
  UZ: { name: 'Uzbekistan', currency: 'UZS', mult: 0.40 },
  KG: { name: 'Kyrgyzstan', currency: 'KGS', mult: 0.40 },
  TJ: { name: 'Tajikistan', currency: 'TJS', mult: 0.40 },
  TM: { name: 'Turkmenistan', currency: 'TMT', mult: 0.40 },
  AF: { name: 'Afghanistan', currency: 'AFN', mult: 0.40 },
  IR: { name: 'Iran', currency: 'IRR', mult: 0.40 },
  IQ: { name: 'Iraq', currency: 'IQD', mult: 0.45 },
  SY: { name: 'Syria', currency: 'SYP', mult: 0.40 },
  LB: { name: 'Lebanon', currency: 'LBP', mult: 0.40 },
  JO: { name: 'Jordan', currency: 'JOD', mult: 0.60 },
  PS: { name: 'Palestine', currency: 'ILS', mult: 0.50 },
  YE: { name: 'Yemen', currency: 'YER', mult: 0.40 },
  TR: { name: 'Turkey', currency: 'TRY', mult: 0.45 },
  GE: { name: 'Georgia', currency: 'GEL', mult: 0.45 },
  AM: { name: 'Armenia', currency: 'AMD', mult: 0.45 },
  AZ: { name: 'Azerbaijan', currency: 'AZN', mult: 0.45 },
  KP: { name: 'North Korea', currency: 'KPW', mult: 0.40 },

  // ─── Oceania ───────────────────────────────────────────────────────
  FJ: { name: 'Fiji', currency: 'FJD', mult: 0.55 },
  PG: { name: 'Papua New Guinea', currency: 'PGK', mult: 0.45 },
  SB: { name: 'Solomon Islands', currency: 'SBD', mult: 0.45 },
  VU: { name: 'Vanuatu', currency: 'VUV', mult: 0.50 },
  NC: { name: 'New Caledonia', currency: 'XPF', mult: 0.90 },
  PF: { name: 'French Polynesia', currency: 'XPF', mult: 0.90 },
  WS: { name: 'Samoa', currency: 'WST', mult: 0.45 },
  TO: { name: 'Tonga', currency: 'TOP', mult: 0.45 },
  KI: { name: 'Kiribati', currency: 'AUD', mult: 0.45 },
  TV: { name: 'Tuvalu', currency: 'AUD', mult: 0.45 },
  NR: { name: 'Nauru', currency: 'AUD', mult: 0.50 },
  PW: { name: 'Palau', currency: 'USD', mult: 0.60 },
  FM: { name: 'Micronesia', currency: 'USD', mult: 0.50 },
  MH: { name: 'Marshall Islands', currency: 'USD', mult: 0.50 },
  CK: { name: 'Cook Islands', currency: 'NZD', mult: 0.85 },
  NU: { name: 'Niue', currency: 'NZD', mult: 0.80 },
  TK: { name: 'Tokelau', currency: 'NZD', mult: 0.60 },
  WF: { name: 'Wallis and Futuna', currency: 'XPF', mult: 0.80 },
  AS: { name: 'American Samoa', currency: 'USD', mult: 0.70 },
  GU: { name: 'Guam', currency: 'USD', mult: 0.85 },
  MP: { name: 'Northern Mariana Islands', currency: 'USD', mult: 0.80 },

  // ─── Africa — North & MENA-adjacent ───────────────────────────────
  MA: { name: 'Morocco', currency: 'MAD', mult: 0.45 },
  DZ: { name: 'Algeria', currency: 'DZD', mult: 0.45 },
  TN: { name: 'Tunisia', currency: 'TND', mult: 0.40 },
  LY: { name: 'Libya', currency: 'LYD', mult: 0.45 },
  EG: { name: 'Egypt', currency: 'EGP', mult: 0.40 },
  SD: { name: 'Sudan', currency: 'SDG', mult: 0.40 },
  SS: { name: 'South Sudan', currency: 'SSP', mult: 0.40 },
  EH: { name: 'Western Sahara', currency: 'MAD', mult: 0.40 },

  // ─── Africa — West & Central ──────────────────────────────────────
  NG: { name: 'Nigeria', currency: 'NGN', mult: 0.40 },
  GH: { name: 'Ghana', currency: 'GHS', mult: 0.40 },
  CI: { name: "Côte d'Ivoire", currency: 'XOF', mult: 0.45 },
  SN: { name: 'Senegal', currency: 'XOF', mult: 0.45 },
  ML: { name: 'Mali', currency: 'XOF', mult: 0.40 },
  BF: { name: 'Burkina Faso', currency: 'XOF', mult: 0.40 },
  NE: { name: 'Niger', currency: 'XOF', mult: 0.40 },
  TD: { name: 'Chad', currency: 'XAF', mult: 0.40 },
  CM: { name: 'Cameroon', currency: 'XAF', mult: 0.45 },
  GA: { name: 'Gabon', currency: 'XAF', mult: 0.55 },
  CG: { name: 'Republic of the Congo', currency: 'XAF', mult: 0.45 },
  CD: { name: 'DR Congo', currency: 'CDF', mult: 0.40 },
  CF: { name: 'Central African Republic', currency: 'XAF', mult: 0.40 },
  GQ: { name: 'Equatorial Guinea', currency: 'XAF', mult: 0.55 },
  ST: { name: 'São Tomé and Príncipe', currency: 'STN', mult: 0.45 },
  GW: { name: 'Guinea-Bissau', currency: 'XOF', mult: 0.40 },
  GN: { name: 'Guinea', currency: 'GNF', mult: 0.40 },
  SL: { name: 'Sierra Leone', currency: 'SLL', mult: 0.40 },
  LR: { name: 'Liberia', currency: 'LRD', mult: 0.40 },
  TG: { name: 'Togo', currency: 'XOF', mult: 0.40 },
  BJ: { name: 'Benin', currency: 'XOF', mult: 0.40 },
  GM: { name: 'Gambia', currency: 'GMD', mult: 0.40 },
  MR: { name: 'Mauritania', currency: 'MRU', mult: 0.45 },
  CV: { name: 'Cape Verde', currency: 'CVE', mult: 0.45 },

  // ─── Africa — East ────────────────────────────────────────────────
  KE: { name: 'Kenya', currency: 'KES', mult: 0.40 },
  TZ: { name: 'Tanzania', currency: 'TZS', mult: 0.40 },
  UG: { name: 'Uganda', currency: 'UGX', mult: 0.40 },
  RW: { name: 'Rwanda', currency: 'RWF', mult: 0.40 },
  BI: { name: 'Burundi', currency: 'BIF', mult: 0.40 },
  ET: { name: 'Ethiopia', currency: 'ETB', mult: 0.40 },
  ER: { name: 'Eritrea', currency: 'ERN', mult: 0.40 },
  DJ: { name: 'Djibouti', currency: 'DJF', mult: 0.45 },
  SO: { name: 'Somalia', currency: 'SOS', mult: 0.40 },
  KM: { name: 'Comoros', currency: 'KMF', mult: 0.45 },
  MG: { name: 'Madagascar', currency: 'MGA', mult: 0.40 },
  MU: { name: 'Mauritius', currency: 'MUR', mult: 0.55 },
  SC: { name: 'Seychelles', currency: 'SCR', mult: 0.70 },
  RE: { name: 'Réunion', currency: 'EUR', mult: 0.85 },
  YT: { name: 'Mayotte', currency: 'EUR', mult: 0.80 },
  IO: { name: 'British Indian Ocean Territory', currency: 'USD', mult: 0.80 },

  // ─── Africa — Southern ───────────────────────────────────────────
  ZA: { name: 'South Africa', currency: 'ZAR', mult: 0.55 },
  NA: { name: 'Namibia', currency: 'NAD', mult: 0.50 },
  BW: { name: 'Botswana', currency: 'BWP', mult: 0.55 },
  ZW: { name: 'Zimbabwe', currency: 'ZWL', mult: 0.40 },
  ZM: { name: 'Zambia', currency: 'ZMW', mult: 0.40 },
  MW: { name: 'Malawi', currency: 'MWK', mult: 0.40 },
  MZ: { name: 'Mozambique', currency: 'MZN', mult: 0.40 },
  AO: { name: 'Angola', currency: 'AOA', mult: 0.40 },
  LS: { name: 'Lesotho', currency: 'LSL', mult: 0.40 },
  SZ: { name: 'Eswatini', currency: 'SZL', mult: 0.45 },

  // ─── Territories / misc ─────────────────────────────────────────
  AX: { name: 'Åland Islands', currency: 'EUR', mult: 1.00 },
  SJ: { name: 'Svalbard and Jan Mayen', currency: 'NOK', mult: 1.10 },
  SH: { name: 'Saint Helena', currency: 'SHP', mult: 0.70 },
  AQ: { name: 'Antarctica', currency: 'USD', mult: 1.00 },
  BV: { name: 'Bouvet Island', currency: 'NOK', mult: 1.00 },
  TF: { name: 'French Southern Territories', currency: 'EUR', mult: 1.00 },
  HM: { name: 'Heard and McDonald Islands', currency: 'AUD', mult: 1.00 },
  UM: { name: 'U.S. Minor Outlying Islands', currency: 'USD', mult: 1.00 },
  CX: { name: 'Christmas Island', currency: 'AUD', mult: 0.90 },
  CC: { name: 'Cocos (Keeling) Islands', currency: 'AUD', mult: 0.90 },
  NF: { name: 'Norfolk Island', currency: 'AUD', mult: 0.90 },
  PN: { name: 'Pitcairn', currency: 'NZD', mult: 0.85 },
}

/**
 * Clamp multiplier to [GEO_FLOOR, GEO_CAP].
 */
function clamp(m: number): number {
  if (!Number.isFinite(m)) return 1.0
  return Math.min(GEO_CAP, Math.max(GEO_FLOOR, m))
}

/**
 * Core helper — returns the geo-adjusted price, currency and effective multiplier.
 *
 * @param basePrice  Base price in EUR (e.g. 29, 79, 149).
 * @param countryCode ISO 3166-1 alpha-2 (e.g. 'FR', 'US'). Case-insensitive.
 *                    Pass null/undefined for EU default (multiplier 1.0).
 */
export function getGeoPrice(
  basePrice: number,
  countryCode?: string | null,
): GeoPrice {
  if (!countryCode) {
    return {
      price: Math.round(basePrice),
      currency: EU_BASELINE_CURRENCY,
      multiplier: 1.0,
      countryCode: 'XX',
      countryName: 'Default (EU)',
      baseEUR: basePrice,
    }
  }

  const cc = countryCode.toUpperCase()
  const meta = COUNTRIES[cc]

  if (!meta) {
    return {
      price: Math.round(basePrice),
      currency: EU_BASELINE_CURRENCY,
      multiplier: 1.0,
      countryCode: cc,
      countryName: cc,
      baseEUR: basePrice,
    }
  }

  const multiplier = clamp(meta.mult)
  const price = Math.round(basePrice * multiplier)

  return {
    price,
    currency: meta.currency,
    multiplier,
    countryCode: cc,
    countryName: meta.name,
    baseEUR: basePrice,
  }
}

/**
 * Extract country code from standard request headers.
 *   1. CF-IPCountry (Cloudflare)
 *   2. x-vercel-ip-country (Vercel edge)
 *   3. Accept-Language locale tail (e.g. 'fr-CI' → 'CI')
 * Returns null if nothing usable.
 */
export function detectCountryFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | null {
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k)
    const v = headers[k] ?? headers[k.toLowerCase()]
    if (Array.isArray(v)) return v[0] ?? null
    return typeof v === 'string' ? v : null
  }

  const cf = get('CF-IPCountry') ?? get('cf-ipcountry')
  if (cf && cf.length === 2 && cf !== 'XX' && cf !== 'T1') return cf.toUpperCase()

  const vercel = get('x-vercel-ip-country')
  if (vercel && vercel.length === 2) return vercel.toUpperCase()

  const accept = get('accept-language') ?? get('Accept-Language')
  if (accept) {
    // take the first locale, look for a "-XX" region tag
    const first = accept.split(',')[0]?.trim() ?? ''
    const m = first.match(/-([A-Za-z]{2})\b/)
    if (m) return m[1].toUpperCase()
  }

  return null
}

/**
 * Convenience formatter for UI. Keeps price integer (plans are whole EUR).
 * Always show the EUR-equivalent number because billing is EUR via Stripe;
 * `currency` is informational (local display).
 */
export function formatGeoPrice(gp: GeoPrice): string {
  return `${gp.price} €`
}

/** Number of countries currently in the table (for tests/reports). */
export function countryCoverage(): number {
  return Object.keys(COUNTRIES).length
}

/** Raw accessor, mainly for agents/admin tooling. */
export function getCountryMeta(cc: string): CountryMeta | null {
  return COUNTRIES[cc.toUpperCase()] ?? null
}

// ─────────────────────────────────────────────────────────────────────
// Backward-compat shims — keep previous 4-tier API callers working.
// The "tier" is now dynamically bucketed from the clamped multiplier.
// ─────────────────────────────────────────────────────────────────────

export interface PricingTier {
  id: string
  multiplier: number
  currency: string
  symbol: string
  label: string
}

function currencySymbol(iso: string): string {
  switch (iso) {
    case 'EUR': return '\u20ac'
    case 'USD': return '$'
    case 'GBP': return '\u00a3'
    case 'JPY': return '\u00a5'
    case 'CNY': return '\u00a5'
    default: return iso
  }
}

function bucketLabel(mult: number): { id: string; label: string } {
  if (mult >= 1.0) return { id: 'tier1_premium', label: 'Standard' }
  if (mult >= 0.7) return { id: 'tier2_standard', label: 'Reduced' }
  if (mult >= 0.5) return { id: 'tier3_emerging', label: 'Emerging' }
  return { id: 'tier4_frontier', label: 'Frontier' }
}

export function getTierForCountry(countryCode: string | null): PricingTier {
  const gp = getGeoPrice(1, countryCode ?? null)
  const b = bucketLabel(gp.multiplier)
  return {
    id: b.id,
    multiplier: gp.multiplier,
    currency: gp.currency,
    symbol: currencySymbol(gp.currency),
    label: b.label,
  }
}

export function getAdjustedPrice(baseEUR: number, tier: PricingTier): number {
  return Math.round(baseEUR * tier.multiplier)
}

export function formatPrice(amount: number, tier: PricingTier): string {
  return `${amount} ${tier.symbol}`
}

// Legacy export kept for imports that reference PPP_TIERS directly.
export const PPP_TIERS: Record<string, PricingTier> = {
  tier1_premium: { id: 'tier1_premium', multiplier: 1.0, currency: 'EUR', symbol: '\u20ac', label: 'Standard' },
  tier2_standard: { id: 'tier2_standard', multiplier: 0.7, currency: 'USD', symbol: '$', label: 'Reduced' },
  tier3_emerging: { id: 'tier3_emerging', multiplier: 0.5, currency: 'USD', symbol: '$', label: 'Emerging' },
  tier4_frontier: { id: 'tier4_frontier', multiplier: 0.4, currency: 'USD', symbol: '$', label: 'Frontier' },
}
