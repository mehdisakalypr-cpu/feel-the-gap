/**
 * FTG Store — Shippo integration (carriers + labels)
 *
 * Envs:
 *   SHIPPO_API_TOKEN      — production ou test token
 *   SHIPPO_DEFAULT_PARCEL — JSON optionnel `{ length, width, height, distance_unit, weight, mass_unit }`
 *
 * Stub mode : si SHIPPO_API_TOKEN absent, les fonctions renvoient `{ ok: false, stub: true, error }`
 * → l'app continue de fonctionner sur les rates statiques du store (store_shipping_rates).
 */

const SHIPPO_URL = 'https://api.goshippo.com'

function token(): string | null {
  return process.env.SHIPPO_API_TOKEN ?? null
}

export function shippoConfigured(): boolean {
  return !!token()
}

export interface ShippoAddress {
  name: string
  company?: string | null
  street1: string
  street2?: string | null
  city: string
  state?: string | null
  zip: string
  country: string // ISO-2
  phone?: string | null
  email?: string | null
}

export interface ShippoParcel {
  length: number
  width: number
  height: number
  distance_unit: 'cm' | 'in'
  weight: number
  mass_unit: 'g' | 'kg' | 'oz' | 'lb'
}

const DEFAULT_PARCEL: ShippoParcel = (() => {
  const raw = process.env.SHIPPO_DEFAULT_PARCEL
  if (raw) {
    try { return JSON.parse(raw) as ShippoParcel } catch { /* ignore */ }
  }
  return { length: 20, width: 15, height: 10, distance_unit: 'cm', weight: 500, mass_unit: 'g' }
})()

export interface ShippoRate {
  object_id: string
  provider: string
  servicelevel: { name: string; token: string }
  amount: string
  currency: string
  estimated_days: number | null
  duration_terms: string | null
}

async function shippoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const tk = token()
  if (!tk) throw new Error('SHIPPO_API_TOKEN missing')
  const res = await fetch(`${SHIPPO_URL}${path}`, {
    ...init,
    headers: {
      'Authorization': `ShippoToken ${tk}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Shippo ${path} ${res.status}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

export async function getShippoRates(args: {
  from: ShippoAddress
  to: ShippoAddress
  parcel?: ShippoParcel
}): Promise<{ ok: true; rates: ShippoRate[]; shipment_id: string } | { ok: false; stub?: boolean; error: string }> {
  if (!shippoConfigured()) return { ok: false, stub: true, error: 'shippo_not_configured' }
  try {
    const shipment = await shippoFetch<{ object_id: string; rates: ShippoRate[] }>('/shipments/', {
      method: 'POST',
      body: JSON.stringify({
        address_from: args.from,
        address_to: args.to,
        parcels: [args.parcel ?? DEFAULT_PARCEL],
        async: false,
      }),
    })
    return { ok: true, rates: shipment.rates ?? [], shipment_id: shipment.object_id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export interface ShippoLabel {
  tracking_number: string | null
  tracking_url_provider: string | null
  label_url: string | null
  status: string
  object_id: string
}

export async function createShippoLabel(args: {
  rate_id: string
  label_file_type?: 'PDF' | 'PDF_4x6' | 'PNG' | 'ZPLII'
}): Promise<{ ok: true; label: ShippoLabel } | { ok: false; stub?: boolean; error: string }> {
  if (!shippoConfigured()) return { ok: false, stub: true, error: 'shippo_not_configured' }
  try {
    const tx = await shippoFetch<{
      object_id: string
      status: string
      tracking_number: string | null
      tracking_url_provider: string | null
      label_url: string | null
      messages?: Array<{ text: string }>
    }>('/transactions/', {
      method: 'POST',
      body: JSON.stringify({
        rate: args.rate_id,
        label_file_type: args.label_file_type ?? 'PDF_4x6',
        async: false,
      }),
    })
    if (tx.status !== 'SUCCESS') {
      return { ok: false, error: `label_status_${tx.status}: ${tx.messages?.map(m => m.text).join('; ') ?? ''}` }
    }
    return { ok: true, label: {
      object_id: tx.object_id,
      status: tx.status,
      tracking_number: tx.tracking_number,
      tracking_url_provider: tx.tracking_url_provider,
      label_url: tx.label_url,
    }}
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function trackShippoShipment(args: { carrier: string; tracking_number: string }): Promise<{
  ok: true
  status: string
  eta: string | null
  history: Array<{ status: string; status_date: string; location: string | null }>
} | { ok: false; stub?: boolean; error: string }> {
  if (!shippoConfigured()) return { ok: false, stub: true, error: 'shippo_not_configured' }
  try {
    const data = await shippoFetch<{
      tracking_status: { status: string; status_date: string; location?: { city?: string; country?: string } } | null
      eta: string | null
      tracking_history: Array<{ status: string; status_date: string; location?: { city?: string; country?: string } }>
    }>(`/tracks/${encodeURIComponent(args.carrier)}/${encodeURIComponent(args.tracking_number)}`)
    return {
      ok: true,
      status: data.tracking_status?.status ?? 'UNKNOWN',
      eta: data.eta,
      history: (data.tracking_history ?? []).map(h => ({
        status: h.status,
        status_date: h.status_date,
        location: [h.location?.city, h.location?.country].filter(Boolean).join(', ') || null,
      })),
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
