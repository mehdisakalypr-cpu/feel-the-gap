import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUser } from '@/lib/supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OppInput {
  id: string
  product: string
  category: string
  type: string
  score: number
  gap_value_usd: number | null
  summary: string | null
}

interface UserContext {
  qty_tons?: string
  price_eur_kg?: string
  budget_eur?: string
  timeline?: string
  sector?: string
  notes?: string
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM = `Tu es un consultant senior en commerce international et développement des affaires, spécialisé sur l'Afrique subsaharienne et les marchés émergents.

Tu génères des business plans de haut niveau, professionnels et actionnables pour des entrepreneurs et investisseurs souhaitant saisir des opportunités d'import/export ou de production dans ces marchés.

Règles absolues :
- Sois ultra-précis avec des chiffres réels basés sur ta connaissance du pays et du secteur
- Donne des fourchettes d'investissement réalistes (pas trop larges)
- Identifie des types de clients B2B réels avec des noms d'entreprises crédibles pour la région
- L'action plan doit être séquentiel et opérationnel (pas de vœux pieux)
- Les projections financières doivent être cohérentes entre elles
- Réponds UNIQUEMENT en JSON valide, aucun texte avant ou après`

// ── Build prompt ───────────────────────────────────────────────────────────────

function buildPrompt(
  countryName: string,
  iso: string,
  opps: OppInput[],
  models: string[],
  ctx: UserContext,
): string {
  const modelLabels: Record<string, string> = {
    import_sell:     'Import & Revente — acheter à l\'étranger, importer et distribuer localement',
    produce_locally: 'Production locale — installer une capacité de fabrication/transformation sur place',
    train_locals:    'Former les locaux — modèle services/consulting, transfert de compétences',
  }

  const oppsText = opps.map(o =>
    `• ${o.product} (${o.category}) — Gap estimé: $${o.gap_value_usd ? (o.gap_value_usd/1e6).toFixed(1) + 'M' : 'N/A'}/an, Score: ${o.score}/100, Type: ${o.type}${o.summary ? `. ${o.summary}` : ''}`
  ).join('\n')

  const modelsText = models.map(m => `• ${modelLabels[m] ?? m}`).join('\n')

  const ctxLines = [
    ctx.qty_tons    ? `• Volume visé : ${ctx.qty_tons} tonnes/mois` : '',
    ctx.price_eur_kg ? `• Prix de vente cible : ${ctx.price_eur_kg} €/kg` : '',
    ctx.budget_eur  ? `• Budget disponible : ${ctx.budget_eur} €` : '',
    ctx.timeline    ? `• Horizon de temps : ${ctx.timeline}` : '',
    ctx.sector      ? `• Secteur actuel de l'investisseur : ${ctx.sector}` : '',
    ctx.notes       ? `• Notes supplémentaires : ${ctx.notes}` : '',
  ].filter(Boolean).join('\n') || '• Aucun contexte spécifique fourni — utilise des hypothèses raisonnables'

  return `Génère un business plan complet pour les opportunités suivantes en ${countryName} (${iso}).

OPPORTUNITÉS SÉLECTIONNÉES :
${oppsText}

MODÈLES COMMERCIAUX RETENUS :
${modelsText}

CONTEXTE DE L'INVESTISSEUR :
${ctxLines}

Retourne EXACTEMENT ce JSON (complète chaque champ avec du vrai contenu, pas de placeholder) :

{
  "title": "Titre accrocheur du business plan",
  "tagline": "Sous-titre résumant l'opportunité en 1 phrase",
  "hero_image_query": "mot-clé anglais pour image Unsplash (ex: guinea agriculture market)",
  "executive_summary": "Synthèse exécutive complète de 3-4 phrases avec chiffres clés",
  "market_context": "Analyse du contexte marché local en 2-3 phrases avec chiffres",
  "opportunity_rationale": "Pourquoi ces opportunités maintenant, 2-3 phrases convaincantes",
  "strategies": [
    {
      "model": "import_sell|produce_locally|train_locals",
      "title": "Titre de la stratégie",
      "description": "Description détaillée 3-4 phrases",
      "pros": ["avantage 1", "avantage 2", "avantage 3"],
      "cons": ["inconvénient 1", "inconvénient 2"],
      "investment_min_eur": 50000,
      "investment_max_eur": 200000,
      "timeline_months": 18,
      "margin_pct_min": 20,
      "margin_pct_max": 35,
      "breakeven_months": 14
    }
  ],
  "action_plan": [
    {
      "phase": 1,
      "title": "Titre de la phase",
      "duration": "ex: Mois 1-3",
      "actions": ["action 1", "action 2", "action 3", "action 4"],
      "milestones": ["livrable 1", "livrable 2"],
      "budget_eur": 25000,
      "icon": "🔍"
    }
  ],
  "financials": {
    "initial_investment_min": 80000,
    "initial_investment_max": 250000,
    "monthly_revenue_y1": 18000,
    "monthly_revenue_y3": 55000,
    "monthly_costs_y1": 13000,
    "monthly_costs_y3": 35000,
    "margin_pct": 28,
    "breakeven_months": 16,
    "roi_3y_pct": 165,
    "notes": "note sur les hypothèses financières"
  },
  "b2b_targets": [
    {
      "segment": "Nom du segment",
      "description": "Description du segment en 1-2 phrases",
      "potential": "Volume ou valeur estimée du segment",
      "examples": ["Nom entreprise 1 (pays)", "Nom entreprise 2 (pays)", "Nom entreprise 3 (pays)"],
      "approach": "Comment approcher ce segment en 1 phrase",
      "decision_cycle": "court|moyen|long",
      "volume_per_client": "ex: 5-20 tonnes/mois"
    }
  ],
  "risks": [
    {
      "title": "Titre du risque",
      "description": "Description courte",
      "impact": "high|medium|low",
      "probability": "high|medium|low",
      "mitigation": "Stratégie de mitigation concrète"
    }
  ],
  "key_success_factors": ["facteur 1", "facteur 2", "facteur 3"],
  "quick_wins": ["action rapide 1", "action rapide 2", "action rapide 3"],
  "useful_resources": [
    {
      "name": "Nom de la ressource",
      "description": "Ce qu'on y trouve",
      "url": "url si connue sinon null",
      "type": "institution|marketplace|database|tool"
    }
  ],
  "products_focus": ["produit 1", "produit 2"]
}`
}

// ── Providers ─────────────────────────────────────────────────────────────────

function parseJson(text: string) {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('Invalid JSON in response')
}

/** Groq — 100% gratuit, 14 400 req/jour, Llama 3.3 70B */
async function generateWithGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

/** Gemini — Google AI Studio (nécessite billing ou nouveau projet) */
async function generateWithGemini(prompt: string): Promise<string> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set')

  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    systemInstruction: SYSTEM,
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

/** Mistral — tier gratuit limité mais fonctionnel */
async function generateWithMistral(prompt: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mistral ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { countryName, iso, opportunities, models, userContext } = await req.json()

    if (!iso || !opportunities?.length || !models?.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = buildPrompt(
      countryName ?? iso,
      iso,
      opportunities as OppInput[],
      models as string[],
      (userContext ?? {}) as UserContext,
    )

    // Try providers in order: Groq (free) → Gemini → Mistral
    const providers: { name: string; fn: () => Promise<string> }[] = [
      ...(process.env.GROQ_API_KEY   ? [{ name: 'Groq',    fn: () => generateWithGroq(prompt)    }] : []),
      ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY ? [{ name: 'Gemini', fn: () => generateWithGemini(prompt) }] : []),
      ...(process.env.MISTRAL_API_KEY ? [{ name: 'Mistral', fn: () => generateWithMistral(prompt) }] : []),
    ]

    if (!providers.length) {
      return Response.json({ error: 'Aucune clé API configurée (GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou MISTRAL_API_KEY)' }, { status: 503 })
    }

    let text = ''
    let lastError = ''
    for (const provider of providers) {
      try {
        console.log(`[business-plan] Trying ${provider.name}…`)
        text = await provider.fn()
        console.log(`[business-plan] Success with ${provider.name}`)
        break
      } catch (e) {
        console.warn(`[business-plan] ${provider.name} failed:`, String(e))
        lastError = String(e)
      }
    }

    if (!text) {
      return Response.json({ error: `Tous les providers ont échoué. Dernier: ${lastError}` }, { status: 503 })
    }

    const plan = parseJson(text)
    return Response.json({ plan })
  } catch (err) {
    console.error('[business-plan API]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
