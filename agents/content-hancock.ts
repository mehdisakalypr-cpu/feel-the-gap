// @ts-nocheck
/**
 * content-hancock — identifie les clients potentiels B2B pour (opp × country).
 *
 * V1 : génération LLM (Gemini) basée sur catégories d'acheteurs typiques par produit.
 * V2 plus tard : intégrer Apollo / Google Maps Places API / LinkedIn Sales pour data réelle.
 *
 * Schema de sortie compatible avec commerce_leads pattern existant.
 */
import { runCascadeJson } from '@/lib/ai/cascade'
import { searchBusinesses, placesToHancockPayload, isConfigured as placesConfigured } from '@/lib/google-places'
import { toIso2 } from '@/lib/iso3-to-iso2'

const PROMPT_FR = (product: string, country: string, gap: string) => `Tu es un expert en prospection B2B sur marchés émergents.

Produit : ${product}
Pays : ${country}
${gap}

Identifie 10 catégories d'acheteurs/clients potentiels B2B qui importent/consomment ce produit dans ce pays. Pour chaque catégorie, donne 2-3 exemples d'entreprises RÉELLES et VÉRIFIABLES (pas inventées).

Retourne UNIQUEMENT du JSON valide (pas de markdown) :

{
  "product": "${product}",
  "country": "${country}",
  "market_size_note": "string — estimation taille marché",
  "categories": [
    {
      "category": "string — ex: Grossistes alimentaires, Industriels transformateurs, Distributeurs retail, etc.",
      "typical_buyer_profile": "string — décrire l'acheteur type",
      "volume_range_tonnes_year": { "min": number, "max": number },
      "typical_pricing_usd_tonne": { "min": number, "max": number },
      "companies": [
        {
          "name": "string — nom réel entreprise",
          "city": "string",
          "website": "string|null",
          "estimated_annual_volume_tonnes": number,
          "contact_hint": "string — ex: LinkedIn, Yellow Pages, salon sectoriel",
          "why_relevant": "string"
        }
      ]
    }
  ],
  "recommended_approach": "string — comment approcher ces clients (LinkedIn, salons, MOUs gouvernement, etc.)",
  "key_trade_events": [ { "event": "string", "city": "string", "month": "string" } ]
}`

// Buyer category archetypes used to query Google Places when available.
// Each category yields a targeted text search like "grossistes café Kenya".
const BUYER_CATEGORIES = [
  { label: 'Grossistes', q: (p: string, c: string) => `grossistes ${p} ${c}` },
  { label: 'Importateurs', q: (p: string, c: string) => `importateurs ${p} ${c}` },
  { label: 'Industriels transformateurs', q: (p: string, c: string) => `industriel transformation ${p} ${c}` },
  { label: 'Distributeurs retail', q: (p: string, c: string) => `distributeur ${p} ${c}` },
]

export async function generatePotentialClients(
  opp: any,
  productName: string,
  countryName: string,
  lang: string = 'fr',
): Promise<{ payload: unknown; cost_eur: number }> {
  // Adapter pattern: real data via Google Places when the key is set;
  // LLM fallback otherwise. When Places returns >= 8 companies across all
  // categories, we skip the LLM entirely (saves a cascade call).
  if (placesConfigured()) {
    const iso2 = toIso2(opp.country_iso) || undefined
    const categoryResults = await Promise.all(
      BUYER_CATEGORIES.map(async (cat) => {
        const places = await searchBusinesses({
          query: cat.q(productName, countryName),
          regionCode: iso2,
          maxResults: 5,
        })
        return placesToHancockPayload(places, { productName, countryName, categoryLabel: cat.label })
      })
    )
    const totalCompanies = categoryResults.reduce((sum, c) => sum + (c.companies?.length ?? 0), 0)
    if (totalCompanies >= 8) {
      return {
        payload: {
          product: productName,
          country: countryName,
          market_size_note: `${totalCompanies} entreprises vérifiées Google Maps`,
          categories: categoryResults.filter((c) => c.companies.length > 0),
          data_source: 'google_places',
          generated_at: new Date().toISOString(),
        },
        cost_eur: 0.032,  // 4 text-search × $0.008/req
      }
    }
  }

  // Fallback LLM (original behavior)
  const gap = opp.gap_value_usd
    ? `Gap d'import annuel: $${(opp.gap_value_usd/1e6).toFixed(1)}M`
    : ''
  const prompt = PROMPT_FR(productName, countryName, gap)
  const payload = await runCascadeJson({
    tier: 'standard',
    task: 'potential-clients',
    basePrompt: prompt,
  })
  return { payload: { ...(payload as any), data_source: 'llm' }, cost_eur: 0.003 }
}
