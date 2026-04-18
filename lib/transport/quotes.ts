/**
 * lib/transport/quotes — Vague 3 #6 · 2026-04-18
 *
 * Récupère des devis de transport pour un trajet origine → destination.
 * Sources par ordre de priorité :
 *  1. Freightos Baltic Index (API si FREIGHTOS_API_KEY présent)
 *  2. Fallback estimateur interne (matrice distance × volume × mode × fuel index)
 *
 * Le fallback est TOUJOURS déclenché si l'API ne répond pas → pas d'UX vide.
 * Calibration matrice : bench Freightos Q1 2026 + estimations WB Logistics Index.
 */

export type TransportMode = 'ocean_fcl' | 'ocean_lcl' | 'air' | 'parcel' | 'road' | 'rail'

export type TransportQuoteRequest = {
  originPort: string
  originCountry: string   // ISO-3
  destinationPort: string
  destinationCountry: string // ISO-3
  mode?: TransportMode
  weightKg: number
  volumeM3?: number
  valueEur?: number       // pour estimation assurance
  incoterm?: string
}

export type TransportQuote = {
  provider: 'freightos' | 'estimator'
  mode: TransportMode
  priceEur: number
  transitDays: number
  insuranceEur?: number
  customsEur?: number
  validUntilIso: string
  raw?: unknown
}

// ── Freightos wrapper ───────────────────────────────────────────────────────
async function quoteFromFreightos(req: TransportQuoteRequest, apiKey: string): Promise<TransportQuote | null> {
  try {
    const res = await fetch('https://api.freightos.com/api/v1/rfq', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        load: [{
          quantity: 1,
          unitType: 'pallet',
          dimensions: { length: 120, width: 80, height: 120, unit: 'cm' },
          weight: { value: req.weightKg, unit: 'kg' },
        }],
        legs: [{
          origin: { locationCode: req.originPort, locationType: 'port' },
          destination: { locationCode: req.destinationPort, locationType: 'port' },
        }],
        loadType: req.mode === 'ocean_fcl' ? 'container40' : req.mode === 'air' ? 'airLoose' : 'lcl',
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const cheapest = Array.isArray(data?.quotes) ? data.quotes[0] : null
    if (!cheapest) return null
    return {
      provider: 'freightos',
      mode: req.mode ?? 'ocean_lcl',
      priceEur: Number(cheapest.totalPrice?.value ?? 0),
      transitDays: Number(cheapest.transitTime?.max ?? 30),
      validUntilIso: new Date(Date.now() + 7 * 86400_000).toISOString(),
      raw: cheapest,
    }
  } catch (err) {
    console.error('[transport/freightos]', err)
    return null
  }
}

// ── Fallback estimator ──────────────────────────────────────────────────────
// Tarifs calibrés sur benchmarks Freightos Baltic Index + WB Logistics Index Q1 2026
// Unités en EUR
const MODE_BASE_RATE: Record<TransportMode, { perKg: number; perM3: number; minFee: number; baseDays: number }> = {
  ocean_fcl:  { perKg: 0.12,  perM3: 85,   minFee: 1400, baseDays: 35 },
  ocean_lcl:  { perKg: 0.35,  perM3: 110,  minFee: 180,  baseDays: 42 },
  air:        { perKg: 3.80,  perM3: 0,    minFee: 95,   baseDays: 6  },
  parcel:     { perKg: 8.50,  perM3: 0,    minFee: 25,   baseDays: 5  },
  road:       { perKg: 0.18,  perM3: 40,   minFee: 220,  baseDays: 8  },
  rail:       { perKg: 0.22,  perM3: 55,   minFee: 380,  baseDays: 18 },
}

// Multiplicateur de région — plus c'est éloigné des hubs, plus c'est cher
// ISO-3 → multiplier (défaut 1.0)
const REGION_MULT: Record<string, number> = {
  FRA: 1.00, DEU: 1.00, NLD: 0.95, BEL: 0.98,  // EU core
  USA: 1.10, CAN: 1.15, MEX: 1.25,             // NA
  CHN: 0.90, JPN: 1.05, KOR: 1.00, VNM: 0.95, // Asia hubs
  IND: 1.10,
  MAR: 1.30, TUN: 1.35, EGY: 1.40,             // Afrique N
  CIV: 1.55, SEN: 1.55, NGA: 1.45, GHA: 1.50,  // Afrique O
  KEN: 1.45, ETH: 1.60, TZA: 1.50,             // Afrique E
  ZAF: 1.35,
  BRA: 1.30, ARG: 1.40, CHL: 1.25,
}

function pickMode(req: TransportQuoteRequest): TransportMode {
  if (req.mode) return req.mode
  if (req.weightKg < 30) return 'parcel'
  if (req.weightKg < 500) return 'air'
  if ((req.volumeM3 ?? 0) > 28) return 'ocean_fcl'
  return 'ocean_lcl'
}

function estimateInternal(req: TransportQuoteRequest): TransportQuote {
  const mode = pickMode(req)
  const rate = MODE_BASE_RATE[mode]
  const originMult = REGION_MULT[req.originCountry.toUpperCase()] ?? 1.2
  const destMult = REGION_MULT[req.destinationCountry.toUpperCase()] ?? 1.2
  const mult = (originMult + destMult) / 2

  const weightCost = req.weightKg * rate.perKg
  const volumeCost = (req.volumeM3 ?? 0) * rate.perM3
  const raw = Math.max(rate.minFee, weightCost + volumeCost) * mult
  const price = Math.round(raw * 100) / 100

  const insuranceEur = req.valueEur ? Math.round(req.valueEur * 0.005 * 100) / 100 : undefined
  const customsEur = req.valueEur ? Math.round(req.valueEur * 0.015 * 100) / 100 : undefined

  const baseDays = rate.baseDays
  const regionDays = Math.round(baseDays * mult)

  return {
    provider: 'estimator',
    mode,
    priceEur: price,
    transitDays: regionDays,
    insuranceEur,
    customsEur,
    validUntilIso: new Date(Date.now() + 7 * 86400_000).toISOString(),
    raw: { originMult, destMult, rate, weightCost, volumeCost },
  }
}

/**
 * Retourne un devis — tente Freightos si clé API présente, fallback sinon.
 * Jamais d'erreur throw : toujours un quote utilisable (estimator en dernier recours).
 */
export async function getTransportQuote(req: TransportQuoteRequest): Promise<TransportQuote> {
  const freightosKey = process.env.FREIGHTOS_API_KEY
  if (freightosKey) {
    const fromApi = await quoteFromFreightos(req, freightosKey)
    if (fromApi) return fromApi
  }
  return estimateInternal(req)
}

/** Plusieurs devis pour comparaison (ex : ocean_lcl vs air) */
export async function getTransportQuoteMatrix(
  req: Omit<TransportQuoteRequest, 'mode'>,
  modes: TransportMode[] = ['ocean_lcl', 'air', 'road'],
): Promise<TransportQuote[]> {
  const quotes = await Promise.all(modes.map(mode => getTransportQuote({ ...req, mode })))
  return quotes.sort((a, b) => a.priceEur - b.priceEur)
}
