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

export async function generatePotentialClients(
  opp: any,
  productName: string,
  countryName: string,
  lang: string = 'fr',
): Promise<{ payload: unknown; cost_eur: number }> {
  const gap = opp.gap_value_usd
    ? `Gap d'import annuel: $${(opp.gap_value_usd/1e6).toFixed(1)}M`
    : ''

  const prompt = PROMPT_FR(productName, countryName, gap)

  const payload = await runCascadeJson({
    tier: 'standard',
    task: 'potential-clients',
    basePrompt: prompt,
  })

  return { payload, cost_eur: 0.003 }
}
