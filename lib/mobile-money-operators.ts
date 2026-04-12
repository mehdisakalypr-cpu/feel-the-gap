/**
 * mobile-money-operators — country ISO → available operators in that country.
 * Used to display localized payment options (OFA checkout, FTG pricing page,
 * marketing badges) so African visitors immediately see they can pay by MoMo.
 */

export type Operator = {
  code: string
  name: string
  logo?: string
}

export type CountryMoMo = {
  iso: string
  name: string
  currency: string
  operators: Operator[]
}

const O = {
  mtn: { code: 'mtn', name: 'MTN Mobile Money' },
  orange: { code: 'orange', name: 'Orange Money' },
  moov: { code: 'moov', name: 'Moov Money' },
  wave: { code: 'wave', name: 'Wave' },
  free: { code: 'free', name: 'Free Money' },
  airtel: { code: 'airtel', name: 'Airtel Money' },
  mpesa: { code: 'mpesa', name: 'M-Pesa' },
  tigo: { code: 'tigo', name: 'Tigo Pesa' },
  tmoney: { code: 'tmoney', name: 'T-Money' },
  flooz: { code: 'flooz', name: 'Flooz' },
  opay: { code: 'opay', name: 'OPay' },
  telecel: { code: 'telecel', name: 'Telecel Cash' },
  airteltigo: { code: 'airteltigo', name: 'AirtelTigo Money' },
}

export const COUNTRY_MOMO: Record<string, CountryMoMo> = {
  CI: { iso: 'CI', name: "Côte d'Ivoire", currency: 'XOF', operators: [O.mtn, O.orange, O.moov, O.wave] },
  SN: { iso: 'SN', name: 'Sénégal', currency: 'XOF', operators: [O.orange, O.wave, O.free] },
  CM: { iso: 'CM', name: 'Cameroun', currency: 'XAF', operators: [O.mtn, O.orange] },
  GA: { iso: 'GA', name: 'Gabon', currency: 'XAF', operators: [O.airtel] },
  BF: { iso: 'BF', name: 'Burkina Faso', currency: 'XOF', operators: [O.orange, O.moov] },
  ML: { iso: 'ML', name: 'Mali', currency: 'XOF', operators: [O.orange, O.moov] },
  GN: { iso: 'GN', name: 'Guinée', currency: 'GNF', operators: [O.orange, O.mtn] },
  BJ: { iso: 'BJ', name: 'Bénin', currency: 'XOF', operators: [O.mtn, O.moov] },
  TG: { iso: 'TG', name: 'Togo', currency: 'XOF', operators: [O.tmoney, O.flooz] },
  NG: { iso: 'NG', name: 'Nigeria', currency: 'NGN', operators: [O.mtn, O.airtel, O.opay] },
  GH: { iso: 'GH', name: 'Ghana', currency: 'GHS', operators: [O.mtn, O.telecel, O.airteltigo] },
  KE: { iso: 'KE', name: 'Kenya', currency: 'KES', operators: [O.mpesa, O.airtel] },
  UG: { iso: 'UG', name: 'Ouganda', currency: 'UGX', operators: [O.mtn, O.airtel] },
  TZ: { iso: 'TZ', name: 'Tanzanie', currency: 'TZS', operators: [O.mpesa, O.airtel, O.tigo] },
  RW: { iso: 'RW', name: 'Rwanda', currency: 'RWF', operators: [O.mtn, O.airtel] },
  CD: { iso: 'CD', name: 'RDC', currency: 'CDF', operators: [O.airtel, O.orange, O.mpesa] },
  ZA: { iso: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', operators: [O.mtn] },
  ZM: { iso: 'ZM', name: 'Zambie', currency: 'ZMW', operators: [O.mtn, O.airtel] },
  ET: { iso: 'ET', name: 'Éthiopie', currency: 'ETB', operators: [] }, // telebirr — non couvert agrégateurs
}

export function getMoMoForCountry(iso?: string | null): CountryMoMo | null {
  if (!iso) return null
  const key = iso.toUpperCase()
  return COUNTRY_MOMO[key] ?? null
}

export function isMoMoCountry(iso?: string | null): boolean {
  const c = getMoMoForCountry(iso)
  return !!c && c.operators.length > 0
}

export function operatorsList(iso?: string | null): Operator[] {
  return getMoMoForCountry(iso)?.operators ?? []
}
