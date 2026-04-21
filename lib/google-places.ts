/**
 * Google Places API adapter — real B2B data source for Hancock agent.
 *
 * Free tier: $200/month credit on new GCP accounts covers ~11k Place Details
 * requests. When GOOGLE_PLACES_API_KEY is not set, consumers should fall back
 * to the LLM-generic Hancock output.
 *
 * Uses Places API (New) — https://developers.google.com/maps/documentation/places/web-service/search-text
 */

export interface PlaceResult {
  name: string
  city: string | null
  website: string | null
  phone: string | null
  rating: number | null
  userRatingCount: number | null
  businessStatus: string | null
  address: string | null
  placeId: string
}

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

// Field mask caps cost: snippet fields = $0.005/req, atmosphere = $0.015/req,
// contact = $0.003/req. We stay on snippet+contact = ~$0.008/request.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.websiteUri',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
].join(',')

export function isConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY
}

/**
 * Text-search real businesses for a (category, country, city?) context.
 * Returns up to 20 results. Falls back silently to [] on API error.
 */
export async function searchBusinesses(opts: {
  query: string            // e.g. "coffee wholesaler importer Kenya"
  regionCode?: string      // ISO 3166-1 alpha-2 (bias toward that country)
  locationBiasLat?: number
  locationBiasLng?: number
  maxResults?: number      // default 10
}): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return []

  try {
    const body: Record<string, unknown> = {
      textQuery: opts.query,
      maxResultCount: Math.min(opts.maxResults ?? 10, 20),
    }
    if (opts.regionCode) body.regionCode = opts.regionCode.toLowerCase()
    if (opts.locationBiasLat && opts.locationBiasLng) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.locationBiasLat, longitude: opts.locationBiasLng },
          radius: 50_000,
        },
      }
    }

    const res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.warn('[google-places] non-OK response', res.status)
      return []
    }

    const json = (await res.json()) as { places?: any[] }
    const places = json.places ?? []

    return places.map((p: any): PlaceResult => {
      // Extract city from address components
      let city: string | null = null
      for (const c of p.addressComponents ?? []) {
        if (Array.isArray(c.types) && (c.types.includes('locality') || c.types.includes('administrative_area_level_2'))) {
          city = c.longText ?? c.shortText ?? null
          if (city) break
        }
      }
      return {
        name: p.displayName?.text ?? 'Unknown',
        city,
        website: p.websiteUri ?? null,
        phone: p.internationalPhoneNumber ?? null,
        rating: p.rating ?? null,
        userRatingCount: p.userRatingCount ?? null,
        businessStatus: p.businessStatus ?? null,
        address: p.formattedAddress ?? null,
        placeId: p.id,
      }
    })
  } catch (e) {
    console.warn('[google-places] error', (e as Error).message.slice(0, 120))
    return []
  }
}

/**
 * Compose a Hancock-compatible payload from real Place results. Groups
 * results by heuristic category (from query terms) so the UI renders the
 * same structure as LLM-generated payloads.
 */
export function placesToHancockPayload(
  places: PlaceResult[],
  params: { productName: string; countryName: string; categoryLabel: string },
) {
  return {
    category: params.categoryLabel,
    typical_buyer_profile: `Entreprises actives dans ${params.categoryLabel.toLowerCase()} pour ${params.productName}`,
    companies: places.map((p) => ({
      name: p.name,
      city: p.city ?? '',
      website: p.website,
      phone: p.phone,
      rating: p.rating,
      rating_count: p.userRatingCount,
      place_id: p.placeId,
      why_relevant: p.businessStatus === 'OPERATIONAL'
        ? `Opérationnel · ${p.rating ? `Note ${p.rating}/5 (${p.userRatingCount} avis)` : 'Vérifié Google Maps'}`
        : `Statut ${p.businessStatus ?? 'inconnu'}`,
      source: 'google_places',
    })),
  }
}
