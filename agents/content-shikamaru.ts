// @ts-nocheck
/**
 * content-shikamaru — génère des méthodes de production structurées par
 * (opp × country × lang). Template logique uniforme pour présenter plusieurs
 * modes (artisanal / mécanisé / AI-automatisé) et remplir pour tout type de
 * ressource (agri, industriel, service, numérique).
 *
 * Réutilise runCascadeJson + provider rotation (Gemini×4 → Groq → Mistral → Cerebras).
 */
import { runCascadeJson } from '@/lib/ai/cascade'

const PROMPT_FR = (product: string, country: string, ctx: string) => `Tu es un consultant en investissement et production industriel/agricole spécialisé marchés émergents.

Produit : ${product}
Pays : ${country}
${ctx}

Génère un plan structuré "Méthodes de Production" avec 3 modes (artisanal, mécanisé, AI-automatisé) applicable à ${product}.

Retourne UNIQUEMENT du JSON valide (pas de markdown), structure exacte :

{
  "product": "${product}",
  "country": "${country}",
  "resource_type": "agri | industriel | service | numerique",
  "template_version": "1.0",
  "modes": [
    {
      "mode": "artisanal",
      "description": "string — 2-3 phrases sur l'approche",
      "steps": [
        { "step": 1, "label": "string", "duration_days": number, "detail": "string" }
      ],
      "resources": { "land_ha": number|null, "water_m3_year": number|null, "energy_kwh_year": number|null, "raw_materials": ["string"] },
      "equipment": [ { "name": "string", "quantity": number, "unit_cost_usd": number, "source_country": "string" } ],
      "staffing": { "total_fte": number, "roles": [ { "role": "string", "count": number, "monthly_usd": number } ] },
      "costs": { "capex_usd": number, "opex_year_usd": number, "cost_per_unit_usd": number, "unit": "string" },
      "yield": { "annual_volume": number, "unit": "string", "quality_grade": "A|B|C" },
      "pros": ["string"],
      "cons": ["string"]
    },
    { "mode": "mecanise", "description": "...", "steps": [...], "resources": {...}, "equipment": [...], "staffing": {...}, "costs": {...}, "yield": {...}, "pros": [...], "cons": [...] },
    { "mode": "ai_automatise", "description": "...", "steps": [...], "resources": {...}, "equipment": [...], "staffing": {...}, "costs": {...}, "yield": {...}, "pros": [...], "cons": [...] }
  ],
  "comparison_table": [
    { "criterion": "CAPEX", "artisanal": "string", "mecanise": "string", "ai_automatise": "string" },
    { "criterion": "Volume annuel", "artisanal": "string", "mecanise": "string", "ai_automatise": "string" },
    { "criterion": "Coût unitaire", "artisanal": "string", "mecanise": "string", "ai_automatise": "string" },
    { "criterion": "Employés", "artisanal": "string", "mecanise": "string", "ai_automatise": "string" },
    { "criterion": "Délai mise en route", "artisanal": "string", "mecanise": "string", "ai_automatise": "string" }
  ],
  "recommended_mode": "artisanal|mecanise|ai_automatise",
  "recommendation_reasoning": "string — 2-3 phrases pourquoi ce mode est optimal pour ce couple pays/produit"
}`

const PROMPT_EN = (product: string, country: string, ctx: string) => `You are an investment and production consultant specialized in emerging markets.

Product: ${product}
Country: ${country}
${ctx}

Generate a structured "Production Methods" plan with 3 modes (artisanal, mechanized, AI-automated) applicable to ${product}.

Return ONLY valid JSON (no markdown), exact same structure as French version but in English.`

export async function generateProductionMethods(
  opp: any,
  productName: string,
  countryName: string,
  lang: string = 'fr',
): Promise<{ payload: unknown; cost_eur: number }> {
  const ctx = [
    opp.gap_value_usd ? `Gap d'import annuel: $${(opp.gap_value_usd/1e6).toFixed(1)}M` : '',
    opp.avg_import_price_usd_tonne ? `Prix import moyen: $${opp.avg_import_price_usd_tonne}/tonne` : '',
    opp.land_availability ? `Disponibilité foncière: ${opp.land_availability}` : '',
    opp.labor_cost_index ? `Index coût main-d'œuvre (1-100): ${opp.labor_cost_index}` : '',
  ].filter(Boolean).join('\n')

  const prompt = lang === 'en'
    ? PROMPT_EN(productName, countryName, ctx)
    : PROMPT_FR(productName, countryName, ctx)

  const payload = await runCascadeJson({
    tier: 'standard',
    task: 'production-methods',
    basePrompt: prompt,
  })

  // Cost estimation: standard tier ~1 cascade pass, ~4K tokens, Gemini free = €0
  // Fallback providers bill; we estimate €0.002 worst case for budgeting
  return { payload, cost_eur: 0.002 }
}
