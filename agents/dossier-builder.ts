// @ts-nocheck
/**
 * Feel The Gap — Dossier Builder Agent
 *
 * Génère la STRUCTURE (sections + questions) d'un dossier d'analyse à remplir
 * par l'utilisateur pour obtenir un financement ou un investissement.
 *
 * Type:
 *  - 'financement'    → dossier orienté analyse crédit (ratios, garanties, cashflow)
 *  - 'investissement' → dossier orienté due diligence (équipe, marché, traction, cap table)
 *
 * Le dossier est adapté au montant demandé, au secteur/produit et au stade de
 * l'entreprise fournis par l'utilisateur.
 *
 * Sortie: JSON { sections: [{ key, title, description, questions: [Question] }] }
 * où Question = {
 *   key, label, type, required, help?, options?, min?, max?, placeholder?
 * }
 *
 * Usage (CLI pour debug) :
 *   npx tsx agents/dossier-builder.ts --type financement --amount 150000 \
 *     --sector agriculture --product cacao --country CIV --stage growth
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DossierType = 'financement' | 'investissement';

export interface DossierQuestion {
  key: string;                 // snake_case unique key
  label: string;               // question visible
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'currency_eur'
    | 'percent'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'boolean'
    | 'file';
  required: boolean;
  help?: string;               // aide contextuelle
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

export interface DossierSection {
  key: string;
  title: string;
  description: string;
  questions: DossierQuestion[];
}

export interface DossierStructure {
  version: 1;
  type: DossierType;
  generated_at: string;
  context: {
    amount_eur: number;
    country_iso?: string;
    product_slug?: string;
    sector?: string;
    stage?: string;
  };
  sections: DossierSection[];
}

export interface BuildDossierInput {
  type: DossierType;
  amount_eur: number;
  country_iso?: string;
  product_slug?: string;
  sector?: string;            // ex: "agroalimentaire", "textile", "énergie"
  stage?: string;             // ex: "idée", "amorçage", "croissance", "scale"
  company_name?: string;      // si déjà connu
  language?: 'fr' | 'en';
}

// ─── LLM fallback chain (Gemini → Groq → OpenAI) ───────────────────────────

function stripJsonFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim();
}

async function callGemini(prompt: string, maxOutputTokens = 8000): Promise<string> {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt,
    temperature: 0.2,
    providerOptions: {
      google: {
        responseMimeType: 'application/json',
        maxOutputTokens,
      } as any,
    },
  });
  return text;
}

async function callGroq(prompt: string, maxOutputTokens = 8000): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

async function callOpenAI(prompt: string, maxOutputTokens = 8000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? '';
}

function isRateLimit(msg: string): boolean {
  return /quota|429|RESOURCE_EXHAUSTED|rate_limit/i.test(msg);
}

async function callLLM(prompt: string, maxOutputTokens = 8000): Promise<string> {
  try {
    return await callGemini(prompt, maxOutputTokens);
  } catch (err) {
    const msg = (err as Error).message;
    if (!isRateLimit(msg) && !/unavailable|overloaded|5\d\d/i.test(msg)) throw err;
    console.warn('[dossier-builder] Gemini failed, trying Groq:', msg.slice(0, 120));
  }
  try {
    return await callGroq(prompt, maxOutputTokens);
  } catch (err) {
    const msg = (err as Error).message;
    console.warn('[dossier-builder] Groq failed, trying OpenAI:', msg.slice(0, 120));
  }
  return callOpenAI(prompt, maxOutputTokens);
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const DOSSIER_FINANCEMENT_PROMPT = (input: BuildDossierInput) => `Tu es un analyste crédit senior (banque / institution de financement) spécialisé en évaluation de demandes de financement d'entrepreneurs import/export et production.

Un entrepreneur cherche un FINANCEMENT de ${input.amount_eur.toLocaleString('fr-FR')} € pour un projet :
- Pays: ${input.country_iso ?? 'non spécifié'}
- Produit: ${input.product_slug ?? 'non spécifié'}
- Secteur: ${input.sector ?? 'non spécifié'}
- Stade de l'entreprise: ${input.stage ?? 'non spécifié'}

Tu dois construire la STRUCTURE d'un dossier de demande de financement complet à faire remplir à cet entrepreneur. Le dossier doit couvrir tout ce qu'un comité de crédit exige pour évaluer la capacité de remboursement, la qualité du projet, les garanties et le risque.

Adapte le nombre et la profondeur des questions au montant demandé :
- Montant < 20 k€: dossier léger (micro-crédit, ~15 questions)
- 20-100 k€: dossier standard PME (~30 questions)
- 100-500 k€: dossier étoffé (~50 questions)
- > 500 k€: dossier corporate (~70 questions)

Pour ce dossier de ${input.amount_eur.toLocaleString('fr-FR')} €, construis les sections suivantes dans cet ordre :
1. **company** — Identité de l'entreprise (raison sociale, forme juridique, SIREN, date création, effectifs, adresse, secteur d'activité, site web)
2. **founder** — Profil du ou des dirigeants (identité, expérience, formation, patrimoine personnel, autres mandats)
3. **project** — Description du projet (objectif, produit, marché cible, calendrier, localisation, usage précis du financement demandé)
4. **market** — Marché et positionnement (taille du marché, concurrents identifiés, clients cibles, canal de distribution, barrières d'entrée, avantages concurrentiels)
5. **financials_historical** — Historique financier (CA, résultat net, EBE, endettement bancaire, capitaux propres sur 3 derniers exercices si disponibles)
6. **financials_projected** — Projections financières à 3 ans (CA prévisionnel, marges, résultat, BFR, investissements, plan de trésorerie mensuel sur 12 mois)
7. **financing_plan** — Plan de financement (apport personnel, autres financements sollicités ou obtenus, part du financement demandé, usage détaillé)
8. **collateral** — Garanties et sûretés proposées (hypothèque, nantissement, caution personnelle, caution BPI, garantie Europe, assurance prêt)
9. **risks** — Risques identifiés et plan de mitigation (risque marché, opérationnel, de change, juridique, fournisseur, climatique)
10. **documents** — Pièces justificatives à joindre (Kbis, statuts, bilans, plan d'affaires, CV dirigeants, tableau d'amortissement, justificatifs apport)

Pour chaque question, fournis :
- key (snake_case unique dans le dossier)
- label (formulation claire en français, entrepreneur-friendly mais précise)
- type ('text' | 'textarea' | 'number' | 'currency_eur' | 'percent' | 'date' | 'select' | 'multiselect' | 'boolean' | 'file')
- required (true/false — critique pour la décision)
- help (aide contextuelle 1 phrase, optionnel)
- options (pour select/multiselect)
- placeholder (optionnel)

Retourne UNIQUEMENT un JSON valide de la forme :
{
  "sections": [
    { "key": "company", "title": "...", "description": "...", "questions": [
      { "key": "...", "label": "...", "type": "...", "required": true, "help": "..." },
      ...
    ] },
    ...
  ]
}

Aucun texte hors JSON. Les clés doivent être en snake_case ASCII, uniques à l'échelle du dossier (préfixe par section si besoin).`;

const DOSSIER_INVESTISSEMENT_PROMPT = (input: BuildDossierInput) => `Tu es un analyste en capital-investissement senior (fonds d'amorçage / business angels / VC) spécialisé en évaluation de projets entrepreneuriaux import/export et production.

Un entrepreneur recherche un INVESTISSEMENT en capital de ${input.amount_eur.toLocaleString('fr-FR')} € en ouverture minoritaire (max 33 %) pour un projet :
- Pays: ${input.country_iso ?? 'non spécifié'}
- Produit: ${input.product_slug ?? 'non spécifié'}
- Secteur: ${input.sector ?? 'non spécifié'}
- Stade: ${input.stage ?? 'non spécifié'}

Tu dois construire la STRUCTURE d'un dossier de levée de fonds à faire remplir par l'entrepreneur. Le dossier doit couvrir tout ce qu'un comité d'investissement exige pour réaliser une due diligence : équipe, marché, produit, traction, finances, gouvernance, cap table, projections, stratégie de sortie.

Adapte la profondeur au montant :
- < 100 k€ (pré-amorçage): dossier synthétique (~25 questions)
- 100-500 k€ (amorçage): dossier complet (~45 questions)
- 500 k€ - 2 M€ (Série A): dossier étoffé (~60 questions)
- > 2 M€: dossier institutionnel (~80 questions)

Construis les sections dans cet ordre :
1. **company** — Identité société (raison sociale, forme juridique, date création, localisation, site web, stade)
2. **team** — Équipe fondatrice et clé (founders, expérience, complémentarité, répartition capital, engagement temps plein, mentors/advisors)
3. **product** — Produit / offre (description, USP, stade de développement, roadmap, IP, technos clés)
4. **problem_solution** — Problème adressé et solution (pain point, taille du problème, solution proposée, différenciateurs)
5. **market** — Marché (TAM/SAM/SOM, dynamiques, tendances, géographies, clients cibles)
6. **competition** — Concurrence et positionnement (concurrents directs/indirects, matrice de positionnement, barrières à l'entrée, avantage défendable)
7. **business_model** — Business model (sources de revenus, pricing, canaux de vente, unit economics, CAC/LTV)
8. **traction** — Traction à date (CA réalisé, clients signés, partenariats, pipeline, métriques clés, croissance)
9. **financials_historical** — Historique financier 2-3 exercices (CA, résultat, burn rate, runway, levées précédentes)
10. **financials_projected** — Projections 3-5 ans (CA, marges, EBITDA, besoin de trésorerie, break-even)
11. **use_of_funds** — Emploi des fonds (R&D, commercial, marketing, équipe, stock, CAPEX — ventilation détaillée)
12. **captable** — Table de capitalisation (actuelle et post-levée cible, pactes existants, BSA/BSPCE)
13. **valuation** — Valorisation (pré-money proposée par l'entrepreneur, base de calcul, comparables de marché)
14. **governance** — Gouvernance (conseil d'administration / comité stratégique, reporting aux investisseurs, pactes envisagés)
15. **exit_strategy** — Stratégie de sortie envisagée (IPO, rachat industriel, rachat financier, horizon, comparables)
16. **risks** — Risques principaux et mitigation (marché, tech, équipe, réglementation, opérationnel, financier)
17. **documents** — Pièces à joindre (pitch deck, Kbis, statuts, comptes, business plan, cap table Excel, CV équipe)

Pour chaque question, fournis :
- key (snake_case, unique)
- label (FR, précis mais accessible)
- type ('text' | 'textarea' | 'number' | 'currency_eur' | 'percent' | 'date' | 'select' | 'multiselect' | 'boolean' | 'file')
- required (true si bloquant pour la décision)
- help (1 phrase, optionnel)
- options (pour select/multiselect)
- placeholder (optionnel)

Retourne UNIQUEMENT un JSON valide de la forme :
{
  "sections": [
    { "key": "...", "title": "...", "description": "...", "questions": [ ... ] },
    ...
  ]
}

Aucun texte hors JSON. Les clés en snake_case ASCII, uniques.`;

// ─── Builder ───────────────────────────────────────────────────────────────

export async function buildDossierStructure(input: BuildDossierInput): Promise<DossierStructure> {
  const prompt = input.type === 'financement'
    ? DOSSIER_FINANCEMENT_PROMPT(input)
    : DOSSIER_INVESTISSEMENT_PROMPT(input);

  const raw = await callLLM(prompt, 10000);
  const cleaned = stripJsonFences(raw);

  let parsed: { sections?: DossierSection[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Retry once: ask the LLM to fix
    console.warn('[dossier-builder] First JSON parse failed, attempting repair');
    const repairPrompt = `Le JSON suivant est invalide. Corrige-le et retourne UNIQUEMENT un JSON valide, sans texte autour.\n\n${cleaned}`;
    const retry = await callLLM(repairPrompt, 10000);
    parsed = JSON.parse(stripJsonFences(retry));
  }

  if (!parsed?.sections || !Array.isArray(parsed.sections)) {
    throw new Error('[dossier-builder] LLM did not return sections[]');
  }

  // Normalize: ensure each question has required defaults
  const sections: DossierSection[] = parsed.sections.map((s: any) => ({
    key: String(s.key ?? '').trim(),
    title: String(s.title ?? ''),
    description: String(s.description ?? ''),
    questions: Array.isArray(s.questions)
      ? s.questions.map((q: any) => ({
          key: String(q.key ?? '').trim(),
          label: String(q.label ?? ''),
          type: (q.type ?? 'text') as DossierQuestion['type'],
          required: Boolean(q.required),
          help: q.help ? String(q.help) : undefined,
          placeholder: q.placeholder ? String(q.placeholder) : undefined,
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => ({
                value: String(o.value ?? o),
                label: String(o.label ?? o.value ?? o),
              }))
            : undefined,
          min: typeof q.min === 'number' ? q.min : undefined,
          max: typeof q.max === 'number' ? q.max : undefined,
        }))
      : [],
  })).filter((s) => s.key && s.questions.length > 0);

  return {
    version: 1,
    type: input.type,
    generated_at: new Date().toISOString(),
    context: {
      amount_eur: input.amount_eur,
      country_iso: input.country_iso,
      product_slug: input.product_slug,
      sector: input.sector,
      stage: input.stage,
    },
    sections,
  };
}

// ─── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  // tsx doesn't auto-load .env.local
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }

  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const type = (getArg('--type') ?? 'financement') as DossierType;
  const amount = Number(getArg('--amount') ?? '100000');
  const country = getArg('--country');
  const product = getArg('--product');
  const sector = getArg('--sector');
  const stage = getArg('--stage');

  console.log(`[dossier-builder] Generating ${type} dossier for ${amount}€, ${country ?? '?'}/${product ?? '?'}…`);
  const structure = await buildDossierStructure({
    type,
    amount_eur: amount,
    country_iso: country,
    product_slug: product,
    sector,
    stage,
  });

  console.log(`\n━━━ Generated ${structure.sections.length} sections ━━━`);
  for (const section of structure.sections) {
    console.log(`\n[${section.key}] ${section.title}`);
    console.log(`  ${section.description}`);
    console.log(`  ${section.questions.length} question(s)`);
    for (const q of section.questions.slice(0, 3)) {
      console.log(`   • ${q.label} (${q.type}${q.required ? ', required' : ''})`);
    }
    if (section.questions.length > 3) console.log(`   … +${section.questions.length - 3}`);
  }

  const totalQuestions = structure.sections.reduce((n, s) => n + s.questions.length, 0);
  console.log(`\n━━━ Total: ${totalQuestions} questions ━━━`);
}

// Run CLI only if invoked directly
if (process.argv[1]?.endsWith('dossier-builder.ts')) {
  main().catch((err) => {
    console.error('[dossier-builder] Fatal:', err);
    process.exit(1);
  });
}
