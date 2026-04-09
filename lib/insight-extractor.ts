// Structured extraction from YouTube videos and gov pages
// Uses Gemini 2.0 Flash via @ai-sdk/google — Gemini supports YouTube URLs natively

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ExtractedInsight {
  topic: 'import_export' | 'production' | 'regulation' | 'business_case' | 'market_analysis' | 'logistics' | 'tips' | 'warning';
  prices: Array<{
    item: string;
    value: number;
    currency: string;
    unit: string;
    context?: string;
  }>;
  costs: Array<{
    type: string;         // labor, land, machinery, energy, raw_material, permit, certification
    description: string;
    value?: number;
    currency?: string;
    unit?: string;
  }>;
  regulations: Array<{
    category: string;     // customs, sanitary, fiscal, labor, technical
    title: string;
    detail: string;
    source_reference?: string;
  }>;
  contacts: Array<{
    name: string;
    role?: string;
    type: string;         // exporter, importer, broker, expert, consultant
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
  }>;
  tips: string[];
  warnings: string[];
  key_facts: string[];
  products_mentioned: string[];
  countries_mentioned: string[];
}

export interface RegulationExtract {
  title: string;
  category: 'customs_tariff' | 'sanitary' | 'technical' | 'fiscal' | 'labor' | 'environment' | 'licensing' | 'incoterms' | 'investment';
  subcategory?: string;
  summary: string;
  content: string;
  product_hs?: string;
  published_date?: string; // ISO
  tags: string[];
  confidence: number;      // 0-1
}

export interface CostBenchmarkExtract {
  product: string;
  sector: string;
  cost_type: string;
  scenario: 'artisanal' | 'mechanized' | 'ai_automated';
  quality_tier?: 'entry' | 'mid' | 'premium';
  value_min?: number;
  value_avg: number;
  value_max?: number;
  currency: string;
  unit: string;
  assumptions: Record<string, unknown>;
  confidence: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function stripJsonFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

async function callGemini(prompt: string, maxOutputTokens = 3000, jsonMode = false): Promise<string> {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt,
    maxOutputTokens,
    providerOptions: jsonMode
      ? { google: { responseMimeType: 'application/json' } }
      : undefined,
  });
  return text;
}

/**
 * Text extraction with Groq fallback (cheaper, faster for pure text tasks).
 * Gemini is reserved for multimodal tasks (video analysis).
 */
async function callGroqFallback(prompt: string, maxOutputTokens = 3000): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

async function callOpenAIFallback(prompt: string, maxOutputTokens = 3000): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

function isRateLimitError(msg: string): boolean {
  return (
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('rate_limit')
  );
}

async function callLLM(prompt: string, maxOutputTokens = 3000, jsonMode = false): Promise<string> {
  // Try Gemini with one retry on transient TPM errors
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callGemini(prompt, maxOutputTokens, jsonMode);
    } catch (err) {
      const msg = (err as Error).message;
      if (isRateLimitError(msg) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (!isRateLimitError(msg)) throw err;
      break;
    }
  }

  // Gemini saturated — try Groq
  try {
    return await callGroqFallback(prompt, maxOutputTokens);
  } catch (err) {
    const msg = (err as Error).message;
    if (!isRateLimitError(msg)) throw err;
  }

  // Groq saturated — final fallback OpenAI
  console.warn('[insight-extractor] Gemini+Groq saturated, falling back to OpenAI');
  return callOpenAIFallback(prompt, maxOutputTokens);
}

// ─── 1. YouTube video URL → structured insights (native Gemini) ────────────
const INSIGHT_EXTRACTION_PROMPT = (countryHint?: string, productHint?: string) =>
  `Tu es un analyste specialise en commerce international, import/export et entrepreneuriat agricole/industriel.

Analyse cette video YouTube et extrais des informations structurees utiles a un entrepreneur qui veut importer/exporter ou produire localement.

**Pays d'interet (hint)**: ${countryHint ?? 'tous'}
**Produit d'interet (hint)**: ${productHint ?? 'tous'}

Reponds UNIQUEMENT avec un JSON valide, aucun markdown, aucune explication. Si une information n'est pas presente, utilise un tableau vide.

Schema JSON attendu:
{
  "topic": "import_export" | "production" | "regulation" | "business_case" | "market_analysis" | "logistics" | "tips" | "warning",
  "prices": [{ "item": "...", "value": 1500, "currency": "EUR", "unit": "tonne", "context": "..." }],
  "costs": [{ "type": "labor|land|machinery|energy|raw_material|permit|certification", "description": "...", "value": 500, "currency": "EUR", "unit": "mois" }],
  "regulations": [{ "category": "customs|sanitary|fiscal|labor|technical", "title": "...", "detail": "...", "source_reference": "..." }],
  "contacts": [{ "name": "...", "role": "...", "type": "exporter|importer|broker|expert", "country": "FR", "phone": "...", "email": "...", "website": "..." }],
  "tips": ["astuce 1", "astuce 2"],
  "warnings": ["piege 1", "arnaque 2"],
  "key_facts": ["fait 1", "fait 2"],
  "products_mentioned": ["cacao", "huile de palme"],
  "countries_mentioned": ["CIV", "GHA", "FRA"]
}

IMPORTANT:
- Convertis les prix en EUR quand possible (taux approximatif acceptable)
- Les codes pays en ISO 3166-1 alpha-3 (FRA, CIV, SEN...)
- Les chiffres prix/couts en numeriques, pas en chaines
- Si la video n'a rien d'exploitable, renvoie tous les tableaux vides mais garde la structure
`;

/**
 * Extract insights directly from a YouTube video URL.
 * Gemini 2.0 Flash natively supports YouTube URL input.
 */
export async function extractInsightsFromYouTubeUrl(args: {
  videoUrl: string;           // https://www.youtube.com/watch?v=XXX
  countryHint?: string;
  productHint?: string;
  timeoutMs?: number;
}): Promise<ExtractedInsight | null> {
  const timeoutMs = args.timeoutMs ?? 90_000; // 90s hard cap per video
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      maxOutputTokens: 3000,
      timeout: timeoutMs,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INSIGHT_EXTRACTION_PROMPT(args.countryHint, args.productHint) },
            {
              type: 'file',
              data: args.videoUrl,
              mediaType: 'video/mp4',
            },
          ],
        },
      ],
    });
    const cleaned = stripJsonFences(text);
    return JSON.parse(cleaned) as ExtractedInsight;
  } catch (err) {
    console.warn(`[insight-extractor] Video extraction failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Fallback: extract from transcript text (kept for gov pages, whisper transcripts, etc.)
 */
export async function extractInsightsFromText(args: {
  text: string;
  title: string;
  description?: string;
  countryHint?: string;
  productHint?: string;
}): Promise<ExtractedInsight | null> {
  const trimmed = args.text.slice(0, 18000);
  const prompt = `${INSIGHT_EXTRACTION_PROMPT(args.countryHint, args.productHint)}

**Titre**: ${args.title}
**Description**: ${args.description ?? ''}

**Contenu**:
"""
${trimmed}
"""
`;
  try {
    const text = await callLLM(prompt, 3000);
    const cleaned = stripJsonFences(text);
    return JSON.parse(cleaned) as ExtractedInsight;
  } catch (err) {
    console.warn(`[insight-extractor] Text extraction failed: ${(err as Error).message}`);
    return null;
  }
}

// ─── 2. Government page → regulation extract ──────────────────────────────
export async function extractRegulationFromPage(args: {
  url: string;
  html: string;         // raw HTML or already-cleaned text
  countryIso: string;
  language?: string;
}): Promise<RegulationExtract[] | null> {
  // Clean HTML to text (simple strip)
  const text = args.html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);

  const prompt = `Tu es un juriste expert en commerce international, douanes, fiscalite et reglementations.

A partir de cette page web, extrais TOUTES les reglementations, taxes, normes, licences et obligations pertinentes pour l'import/export ou la production locale.

**Pays**: ${args.countryIso}
**URL**: ${args.url}
**Langue**: ${args.language ?? 'fr'}

**Contenu**:
"""
${text}
"""

Reponds UNIQUEMENT avec un JSON valide contenant un tableau de reglementations. Aucun markdown, aucune explication.

Schema:
[
  {
    "title": "Titre court de la reglementation",
    "category": "customs_tariff" | "sanitary" | "technical" | "fiscal" | "labor" | "environment" | "licensing" | "incoterms" | "investment",
    "subcategory": "optionnel",
    "summary": "Resume en 2-3 phrases",
    "content": "Detail precis avec chiffres, taux, conditions (max 1500 chars)",
    "product_hs": "code HS si specifique, sinon omettre",
    "published_date": "YYYY-MM-DD si trouvee dans la page",
    "tags": ["tag1", "tag2"],
    "confidence": 0.85
  }
]

IMPORTANT:
- Priorise les donnees recentes, indique la date si trouvee
- Extrais les taux/montants precis (droits de douane, TVA, taxes diverses)
- Une reglementation par entree, ne groupe pas
- Si aucune reglementation extractable, renvoie un tableau vide []
`;

  try {
    const text = await callLLM(prompt, 4000);
    const cleaned = stripJsonFences(text);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed as RegulationExtract[];
  } catch (err) {
    console.warn(`[insight-extractor] Regulation extraction failed: ${(err as Error).message}`);
    return null;
  }
}

// ─── 2b. LLM-native regulation generation (no web scraping) ──────────────
/**
 * Generate a comprehensive set of country regulations using LLM knowledge
 * directly, without scraping flaky government websites. Covers all 9
 * regulatory categories defined in the country_regulations schema check.
 *
 * Used by agents/regulatory-collector.ts as the primary ingestion path.
 */
export async function generateRegulationsForCountry(args: {
  countryIso: string;
  countryName: string;
  productHints?: string[]; // e.g. ['cacao', 'cafe', 'textile']
  language?: 'fr' | 'en';
}): Promise<RegulationExtract[] | null> {
  const lang = args.language ?? 'fr';
  const productsLine = args.productHints?.length
    ? `Concentre-toi sur ces produits/secteurs pilotes : ${args.productHints.join(', ')}`
    : 'Couvre les secteurs transversaux (import general, fiscalite societe, droit du travail)';

  const prompt = `Tu es un juriste international expert en commerce, douanes, fiscalite et reglementations pays. Tu produis des fiches reglementaires factuelles a destination d'entrepreneurs qui veulent importer, exporter ou produire localement.

**Pays cible**: ${args.countryName} (${args.countryIso})
**Langue**: ${lang}
${productsLine}

Produis un tableau JSON de 10 a 12 entrees couvrant TOUTES les categories suivantes (1 entree par categorie, 1 extra pour les 2-3 plus importantes):

1. customs_tariff — droits de douane NPF moyens, regimes preferentiels (ALE, ZLECAF, APE UE), HS codes sensibles
2. sanitary — normes SPS, phyto, halal, exigences d'etiquetage alimentaire, agrements abattoirs
3. technical — normes ISO/locales, homologation equipements, certification produits (ex: COC, SONCAP, EAC)
4. fiscal — taux TVA, impot societe (IS), retenue a la source, zones franches, taxe specifique
5. labor — SMIC/salaire minimum, cotisations sociales employeur, duree legale du travail, licenciement
6. environment — normes emissions, gestion dechets industriels, EIE obligatoire, taxe carbone eventuelle
7. licensing — licence d'importation, agrement grossiste, autorisations sectorielles
8. incoterms — regles locales particulieres (ex: obligation CIF Maroc, interdictions port)
9. investment — code des investissements, incitations fiscales, zones economiques speciales, rapatriement profits

Reponds UNIQUEMENT avec un JSON valide (tableau). Aucun markdown.

Schema par entree:
{
  "title": "Titre court et precis (max 100 chars)",
  "category": "customs_tariff|sanitary|technical|fiscal|labor|environment|licensing|incoterms|investment",
  "subcategory": "optionnel — mot cle fin",
  "summary": "Resume 2-3 phrases, lisible par un non-juriste",
  "content": "Detail precis avec chiffres/taux/conditions (max 800 chars). Cite les autorites competentes et dates si possibles.",
  "product_hs": "code HS si specifique, sinon omettre",
  "published_date": "YYYY-MM-DD de la source de reference si connue, sinon omettre",
  "tags": ["2-4 tags lowercase"],
  "confidence": 0.6 a 0.95
}

IMPORTANT:
- Donne des taux, seuils, montants PRECIS. Pas de "environ" vague.
- Cite les autorites (ex: "Douanes senegalaises", "DGI Maroc", "ANSES", "SGS").
- Si une regle recente (2024-2026) s'applique, mentionne-la explicitement.
- confidence > 0.8 pour les regles majeures etablies (droits de douane NPF OMC, TVA standard), < 0.7 pour les regles sectorielles pointues qui varient.
- NE JAMAIS inventer. Si tu n'es pas sur d'un chiffre, formule prudemment ou baisse la confidence.
`;

  try {
    const text = await callLLM(prompt, 10000, true);
    const cleaned = stripJsonFences(text).trim();

    // Extract the array substring first (LLMs sometimes wrap with objects or prose)
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    const arrText = arrStart >= 0 && arrEnd > arrStart
      ? cleaned.slice(arrStart, arrEnd + 1)
      : cleaned;

    try {
      const parsed = JSON.parse(arrText);
      if (!Array.isArray(parsed)) return [];
      return parsed as RegulationExtract[];
    } catch {
      // Truncation recovery: iteratively walk back to the last complete entry
      // by finding "}," boundaries. Also handle the case where the LAST entry
      // is complete but the array close "]" is missing.
      const candidates = [
        arrText + ']', // missing closing bracket only
        arrText.replace(/,\s*$/, '') + ']', // trailing comma
      ];
      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed)) {
            console.warn(`[insight-extractor] Fixed trailing JSON for ${args.countryIso}: ${parsed.length} entries`);
            return parsed as RegulationExtract[];
          }
        } catch {}
      }

      // Walk back to last "}," and cut there
      let cut = arrText.length;
      for (let i = 0; i < 20; i++) {
        const lastComma = arrText.lastIndexOf('},', cut - 1);
        if (lastComma <= 0) break;
        const salvaged = arrText.slice(0, lastComma + 1) + ']';
        try {
          const parsed = JSON.parse(salvaged);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.warn(`[insight-extractor] Salvaged ${parsed.length} entries from truncated JSON for ${args.countryIso}`);
            return parsed as RegulationExtract[];
          }
        } catch {}
        cut = lastComma;
      }
      throw new Error('JSON parse + salvage failed');
    }
  } catch (err) {
    console.warn(`[insight-extractor] Country regulation generation failed for ${args.countryIso}: ${(err as Error).message}`);
    return null;
  }
}

// ─── 3. Text → cost benchmarks (3 scenarios) ──────────────────────────────
export async function extractCostBenchmarks(args: {
  sourceText: string;
  countryIso: string;
  product: string;
  sector: string;
}): Promise<CostBenchmarkExtract[] | null> {
  const prompt = `Tu es un expert en couts de production industrielle et agricole.

Produis une estimation des couts de production pour **${args.product}** (secteur: ${args.sector}) au pays **${args.countryIso}**, classes par scenario:

1. **artisanal**: main d'oeuvre intensive, outils simples, faible capital, qualite variable
2. **mechanized**: industriel mecanise classique, equipement moderne, equipe qualifiee
3. **ai_automated**: automatise avec IA, robotique, rendement maximal, capital eleve

Base tes estimations sur:
- tes connaissances du secteur et du pays (salaires, cout foncier, energie, certifications)
- ce contexte extrait de videos YouTube recentes:
"""
${args.sourceText.slice(0, 12000)}
"""

**IMPORTANT**: meme si le texte YouTube ne contient pas de chiffres precis, tu DOIS generer des estimations realistes pour le pays et le produit en utilisant tes connaissances. Ne renvoie JAMAIS un tableau vide.

Produis EXACTEMENT 12 entrees (pas plus) couvrant: land_hectare, labor_month, machine_capex, energy_kwh, raw_material, certification. 2 entrees par cost_type en variant scenario (artisanal, mechanized, ai_automated). cost_type DOIT etre strictement une valeur parmi: land_m2, land_hectare, labor_hour, labor_month, labor_density, machine_capex, machine_opex, energy_kwh, water_m3, raw_material, certification, rent_m2, permit. scenario DOIT etre l'un de: artisanal, mechanized, ai_automated. Sois concis dans assumptions (max 3 cles).

Reponds UNIQUEMENT avec un JSON valide (tableau), aucun markdown.

Schema:
[
  {
    "product": "${args.product}",
    "sector": "${args.sector}",
    "cost_type": "land_m2" | "land_hectare" | "labor_hour" | "labor_month" | "labor_density" | "machine_capex" | "machine_opex" | "energy_kwh" | "water_m3" | "raw_material" | "certification" | "rent_m2" | "permit",
    "scenario": "artisanal" | "mechanized" | "ai_automated",
    "quality_tier": "entry" | "mid" | "premium",
    "value_min": 100,
    "value_avg": 150,
    "value_max": 200,
    "currency": "EUR",
    "unit": "EUR/mois",
    "assumptions": { "team_size": 10, "production_volume": "100t/an", "hours_per_day": 8 },
    "confidence": 0.7
  }
]

Si le texte ne permet pas d'extraire de couts fiables, renvoie [].
`;

  try {
    const text = await callLLM(prompt, 8000, true);
    const cleaned = stripJsonFences(text);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed as CostBenchmarkExtract[];
  } catch (err) {
    console.warn(`[insight-extractor] Cost extraction failed: ${(err as Error).message}`);
    return null;
  }
}

// ─── 4. Relevance scoring (cheap heuristic + LLM fallback) ────────────────
export function scoreRelevance(args: {
  title: string;
  description: string;
  viewCount: number;
  publishedAt: string;
  targetCountry: string;
  targetProduct?: string;
}): number {
  let score = 0;

  // Freshness (up to 0.3)
  const ageMonths = (Date.now() - new Date(args.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (ageMonths < 6) score += 0.3;
  else if (ageMonths < 12) score += 0.25;
  else if (ageMonths < 24) score += 0.15;
  else if (ageMonths < 36) score += 0.05;

  // Views (up to 0.3, log scale)
  if (args.viewCount > 100_000) score += 0.3;
  else if (args.viewCount > 10_000) score += 0.2;
  else if (args.viewCount > 1_000) score += 0.1;

  // Keyword match in title/description (up to 0.4)
  const text = `${args.title} ${args.description}`.toLowerCase();
  const keywords = [
    'import', 'export', 'business', 'entrepreneur', 'marche',
    'douane', 'taxe', 'reglementation', 'prix', 'cout',
  ];
  const matches = keywords.filter((k) => text.includes(k)).length;
  score += Math.min(0.3, matches * 0.04);

  if (args.targetProduct && text.includes(args.targetProduct.toLowerCase())) {
    score += 0.1;
  }

  return Math.min(1, score);
}
