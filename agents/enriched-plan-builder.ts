// @ts-nocheck
/**
 * Feel The Gap — Enriched Business Plan Builder (3 scenarios)
 *
 * Produit un business plan enrichi qui s'appuie sur toutes les donnees de
 * recherche (YouTube insights, reglementaire, couts de production, logistique)
 * et compare systematiquement 3 scenarios:
 *   1. Artisanal           — main d'oeuvre intensive, outils simples
 *   2. Industriel mecanise — equipement moderne, equipe qualifiee
 *   3. Automatise IA       — robotique + IA, rendement max
 *
 * Accepte un formulaire de precision optionnel pour affiner les estimations.
 *
 * Usage:
 *   npx tsx agents/enriched-plan-builder.ts --opportunity <uuid>
 *   npx tsx agents/enriched-plan-builder.ts --country CIV --product cacao
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
export type Scenario = 'artisanal' | 'mechanized' | 'ai_automated';

export interface PrecisionInputs {
  target_volume_tonnes?: number;       // production annuelle cible
  budget_eur?: number;                 // budget disponible
  team_size?: number;                  // equipe deja constituee
  expertise_level?: 'novice' | 'intermediate' | 'expert';
  target_region?: string;              // region precise (ex: "Bouake", "Anyama")
  horizon_years?: number;              // horizon planification
  quality_tier?: 'entry' | 'mid' | 'premium';
}

export interface ScenarioBlock {
  scenario: Scenario;
  label: string;
  description: string;
  capex_eur: number;
  opex_year_eur: number;
  revenue_year_eur: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  payback_months: number;
  roi_3y_pct: number;
  employees: number;
  land_required_m2: number;
  production_capacity_tonnes_year: number;
  machinery_list: Array<{ name: string; cost_eur: number; origin: string }>;
  quality_output: 'entry' | 'mid' | 'premium';
  advantages: string[];
  disadvantages: string[];
  risk_level: 'low' | 'medium' | 'high';
}

export interface EnrichedBusinessPlan {
  // Meta
  opportunity_id?: string;
  country_iso: string;
  product: string;
  generated_at: string;

  // Section 1: Executive Summary
  executive_summary: string;

  // Section 2: Market Study (enrichie par les agents de recherche)
  market_study: {
    market_size_eur: number;
    growth_rate_pct: number;
    key_players: string[];
    demand_drivers: string[];
    barriers_to_entry: string[];
    regulations: Array<{ category: string; title: string; detail: string }>;
    logistics_corridors: Array<{ mode: string; cost_eur: number; transit_days: number }>;
    insights_from_field: string[];          // extraits YouTube
  };

  // Section 3: Comparatif 3 scenarios
  scenarios: {
    artisanal: ScenarioBlock;
    mechanized: ScenarioBlock;
    ai_automated: ScenarioBlock;
  };
  scenarios_comparison: {
    best_for_low_capital: Scenario;
    best_for_speed: Scenario;
    best_for_margin: Scenario;
    average_capex_eur: number;
    average_roi_3y_pct: number;
    recommended_scenario: Scenario;
    recommendation_rationale: string;
  };

  // Section 4: Precision form (optional)
  precision_applied: PrecisionInputs | null;

  // Section 5: Action plan
  action_plan: Array<{
    phase: number;
    name: string;
    duration_months: number;
    milestones: string[];
    budget_eur: number;
  }>;

  // Section 6: Risks
  risks: Array<{ risk: string; probability: 'low' | 'medium' | 'high'; impact: 'low' | 'medium' | 'high'; mitigation: string }>;

  // Section 7: Optional forms prompts
  precision_form_prompts: string[];         // questions a poser a l'utilisateur pour affiner
}

// ─── Data loaders ───────────────────────────────────────────────────────────
async function loadResearchData(
  admin: ReturnType<typeof supabaseAdmin>,
  countryIso: string,
  productSlug: string,
) {
  const [regs, insights, benchmarks, corridors] = await Promise.all([
    admin
      .from('country_regulations')
      .select('category, title, summary, content, published_date')
      .eq('country_iso', countryIso)
      .eq('is_active', true)
      .order('published_date', { ascending: false, nullsFirst: false })
      .limit(30),
    admin
      .from('youtube_insights')
      .select('title, channel_name, view_count, extracted_insights')
      .eq('country_iso', countryIso)
      .eq('product_category', productSlug)
      .order('relevance_score', { ascending: false, nullsFirst: false })
      .limit(20),
    admin
      .from('production_cost_benchmarks')
      .select('cost_type, scenario, quality_tier, value_avg, unit, currency, assumptions')
      .eq('country_iso', countryIso)
      .eq('product', productSlug),
    admin
      .from('logistics_corridors')
      .select('destination_iso, mode, container_type, incoterm, cost_eur, transit_days_avg')
      .eq('origin_iso', countryIso)
      .order('cost_eur', { ascending: true })
      .limit(20),
  ]);

  return {
    regulations: regs.data ?? [],
    youtube_insights: insights.data ?? [],
    cost_benchmarks: benchmarks.data ?? [],
    logistics: corridors.data ?? [],
  };
}

// ─── Prompt builder ─────────────────────────────────────────────────────────
function buildPlanPrompt(args: {
  countryName: string;
  countryIso: string;
  productName: string;
  productSlug: string;
  research: Awaited<ReturnType<typeof loadResearchData>>;
  precision: PrecisionInputs | null;
  lang?: 'fr' | 'en';
}): string {
  const { research, precision, countryName, productName } = args;
  const lang = args.lang ?? 'fr';

  const regBrief = research.regulations.slice(0, 10).map((r) =>
    `- [${r.category}] ${r.title}: ${r.summary ?? r.content?.slice(0, 200)}`,
  ).join('\n');

  const insightBrief = research.youtube_insights.slice(0, 10).map((i) => {
    const ins = i.extracted_insights as Record<string, unknown> | null;
    const tips = (ins?.tips as string[])?.slice(0, 2).join(' | ');
    const facts = (ins?.key_facts as string[])?.slice(0, 2).join(' | ');
    return `- ${i.title} (${i.view_count?.toLocaleString()} vues) — Tips: ${tips ?? '-'} — Facts: ${facts ?? '-'}`;
  }).join('\n');

  const benchBrief = research.cost_benchmarks.slice(0, 20).map((b) =>
    `- ${b.scenario}/${b.quality_tier ?? '-'} ${b.cost_type}: ${b.value_avg} ${b.unit}`,
  ).join('\n');

  const logiBrief = research.logistics.slice(0, 10).map((l) =>
    `- → ${l.destination_iso} (${l.mode}): ${l.cost_eur ?? '?'} EUR ${l.container_type ?? ''} ${l.incoterm ?? ''} — ${l.transit_days_avg ?? '?'}j`,
  ).join('\n');

  const precisionBlock = precision
    ? `\n**Precisions fournies par l'utilisateur:**\n${Object.entries(precision)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')}`
    : '';

  const langInstruction =
    lang === 'en'
      ? '\n\n**LANGUAGE**: Write ALL free-text fields (executive_summary, descriptions, labels, advantages, disadvantages, market_study strings, action_plan milestones, risks, precision_form_prompts) strictly in ENGLISH. Keep JSON keys unchanged.\n'
      : '\n\n**LANGUE**: Redige TOUS les champs texte libres en FRANCAIS. Garde les cles JSON inchangees.\n';

  return `Tu es un consultant senior en commerce international et en montage de projets industriels/agricoles dans les pays emergents.

Genere un business plan enrichi pour:
- Pays: ${countryName} (${args.countryIso})
- Produit: ${productName}
${langInstruction}
Utilise les DONNEES DE RECHERCHE ci-dessous (issues de videos terrain, sites gouvernementaux et benchmarks) comme source primaire.

**Reglementation recente (${research.regulations.length} entrees):**
${regBrief || '(aucune donnee)'}

**Insights terrain YouTube (${research.youtube_insights.length} videos):**
${insightBrief || '(aucune donnee)'}

**Benchmarks de couts collectes (${research.cost_benchmarks.length} entrees):**
${benchBrief || '(aucune donnee — utilise des estimations 2026 realistes)'}

**Corridors logistiques (${research.logistics.length} entrees):**
${logiBrief || '(aucune donnee)'}
${precisionBlock}

**INSTRUCTIONS**:
Genere un business plan JSON complet couvrant 3 scenarios systematiques:
1. **artisanal** — main d'oeuvre intensive, outils simples, capital faible, qualite entry/mid
2. **mechanized** — equipement moderne, equipe qualifiee, capital moyen, qualite mid/premium
3. **ai_automated** — robotique + IA, rendement maximum, capital eleve, qualite premium

Pour chaque scenario, calcule: CapEx, OpEx annuel, revenus annuels, marges, employes, surface necessaire, capacite, liste machines, avantages/inconvenients, niveau de risque.

Au milieu du document, compare explicitement les 3 scenarios et recommande le meilleur selon le contexte (ou selon les precisions fournies).

Reponds UNIQUEMENT avec un JSON valide. Aucun markdown, aucune explication.

Schema:
{
  "executive_summary": "string (3-4 paragraphes)",
  "market_study": {
    "market_size_eur": number,
    "growth_rate_pct": number,
    "key_players": ["string"],
    "demand_drivers": ["string"],
    "barriers_to_entry": ["string"],
    "regulations": [{ "category": "string", "title": "string", "detail": "string" }],
    "logistics_corridors": [{ "mode": "string", "cost_eur": number, "transit_days": number }],
    "insights_from_field": ["string"]
  },
  "scenarios": {
    "artisanal":    { "scenario": "artisanal", "label": "Artisanal", "description": "...", "capex_eur": N, "opex_year_eur": N, "revenue_year_eur": N, "gross_margin_pct": N, "net_margin_pct": N, "payback_months": N, "roi_3y_pct": N, "employees": N, "land_required_m2": N, "production_capacity_tonnes_year": N, "machinery_list": [{"name":"...","cost_eur":N,"origin":"CN|FR|..."}], "quality_output": "entry|mid|premium", "advantages": ["..."], "disadvantages": ["..."], "risk_level": "low|medium|high" },
    "mechanized":   { ... meme structure ... },
    "ai_automated": { ... meme structure ... }
  },
  "scenarios_comparison": {
    "best_for_low_capital": "artisanal|mechanized|ai_automated",
    "best_for_speed": "...",
    "best_for_margin": "...",
    "average_capex_eur": N,
    "average_roi_3y_pct": N,
    "recommended_scenario": "...",
    "recommendation_rationale": "2-3 phrases expliquant le choix"
  },
  "action_plan": [{ "phase": 1, "name": "...", "duration_months": N, "milestones": ["..."], "budget_eur": N }],
  "risks": [{ "risk": "...", "probability": "low|medium|high", "impact": "low|medium|high", "mitigation": "..." }],
  "precision_form_prompts": [
    "Quelle est votre production annuelle cible (tonnes) ?",
    "Quel est votre budget disponible (EUR) ?",
    "Combien de personnes composent deja votre equipe ?",
    "Quelle region precise ciblez-vous ?",
    "Quel niveau de qualite visez-vous (entry/mid/premium) ?",
    "Avez-vous une expertise dans ce domaine ?",
    "Sur combien d'annees planifiez-vous ?"
  ]
}

IMPORTANT:
- Toutes les valeurs financieres en EUR
- Les benchmarks fournis doivent servir de base aux estimations
- Les reglementations recentes doivent etre refletees dans les risks et le market_study
- Les 3 scenarios doivent etre internement coherents (capex ↑ = opex ↓ = employes ↓ = marge ↑)
`;
}

// ─── LLM call with Groq fallback ────────────────────────────────────────────
async function callLLM(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      maxOutputTokens: 32000,
      providerOptions: {
        google: {
          responseMimeType: 'application/json',
        },
      },
    });
    return text;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[enriched-plan] Gemini quota exhausted, fallback to Groq');
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw err;
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 8000,
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    }
    throw err;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export async function buildEnrichedPlan(args: {
  countryIso: string;
  productSlug: string;      // 'cacao' | 'cafe' | ...
  productName: string;      // affichage
  opportunityId?: string;
  precision?: PrecisionInputs;
  lang?: 'fr' | 'en';
}): Promise<EnrichedBusinessPlan> {
  const admin = supabaseAdmin();
  const lang = args.lang ?? 'fr';
  const { data: country } = await admin.from('countries').select('name, name_fr').eq('id', args.countryIso).single();
  const countryName = (lang === 'en' ? country?.name : country?.name_fr) ?? country?.name_fr ?? country?.name ?? args.countryIso;

  console.log(`[enriched-plan] Loading research for ${args.countryIso}/${args.productSlug} (lang=${lang})…`);
  const research = await loadResearchData(admin, args.countryIso, args.productSlug);
  console.log(
    `  regs=${research.regulations.length} yt=${research.youtube_insights.length} costs=${research.cost_benchmarks.length} logi=${research.logistics.length}`,
  );

  const prompt = buildPlanPrompt({
    countryName,
    countryIso: args.countryIso,
    productName: args.productName,
    productSlug: args.productSlug,
    research,
    precision: args.precision ?? null,
    lang,
  });

  console.log('[enriched-plan] Calling LLM…');
  const text = await callLLM(prompt);
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let parsed: Partial<EnrichedBusinessPlan>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`[enriched-plan] Failed to parse LLM JSON: ${(err as Error).message}\n\nRaw: ${cleaned.slice(0, 500)}`);
  }

  return {
    opportunity_id: args.opportunityId,
    country_iso: args.countryIso,
    product: args.productName,
    generated_at: new Date().toISOString(),
    executive_summary: parsed.executive_summary ?? '',
    market_study: parsed.market_study ?? {
      market_size_eur: 0,
      growth_rate_pct: 0,
      key_players: [],
      demand_drivers: [],
      barriers_to_entry: [],
      regulations: [],
      logistics_corridors: [],
      insights_from_field: [],
    },
    scenarios: parsed.scenarios ?? {
      artisanal: {} as ScenarioBlock,
      mechanized: {} as ScenarioBlock,
      ai_automated: {} as ScenarioBlock,
    },
    scenarios_comparison: parsed.scenarios_comparison ?? {
      best_for_low_capital: 'artisanal',
      best_for_speed: 'mechanized',
      best_for_margin: 'ai_automated',
      average_capex_eur: 0,
      average_roi_3y_pct: 0,
      recommended_scenario: 'mechanized',
      recommendation_rationale: '',
    },
    precision_applied: args.precision ?? null,
    action_plan: parsed.action_plan ?? [],
    risks: parsed.risks ?? [],
    precision_form_prompts: parsed.precision_form_prompts ?? [
      "Quelle est votre production annuelle cible (tonnes) ?",
      "Quel est votre budget disponible (EUR) ?",
      "Combien de personnes composent deja votre equipe ?",
      "Quelle region precise ciblez-vous ?",
      "Quel niveau de qualite visez-vous (entry/mid/premium) ?",
      "Avez-vous une expertise dans ce domaine ?",
      "Sur combien d'annees planifiez-vous ?",
    ],
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  function getArg(flag: string) {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  }

  const oppId = getArg('--opportunity');
  const country = getArg('--country');
  const productSlug = getArg('--product');

  (async () => {
    if (oppId) {
      const admin = supabaseAdmin();
      const { data: opp } = await admin
        .from('opportunities')
        .select('country_iso, product_id, products(name_fr)')
        .eq('id', oppId)
        .single();
      if (!opp) {
        console.error('Opportunity not found');
        process.exit(1);
      }
      const plan = await buildEnrichedPlan({
        countryIso: opp.country_iso,
        productSlug: opp.product_id,
        productName: (opp.products as { name_fr: string })?.name_fr ?? opp.product_id,
        opportunityId: oppId,
      });
      console.log(JSON.stringify(plan, null, 2));
    } else if (country && productSlug) {
      const plan = await buildEnrichedPlan({
        countryIso: country,
        productSlug,
        productName: productSlug,
      });
      console.log(JSON.stringify(plan, null, 2));
    } else {
      console.error('Usage: --opportunity <uuid>  OR  --country <iso> --product <slug>');
      process.exit(1);
    }
  })().catch((err) => {
    console.error('[enriched-plan] Fatal:', err);
    process.exit(1);
  });
}
