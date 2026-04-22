import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerLocale, type Locale } from '@/lib/i18n/locale'
import { localizeSystemPrompt } from '@/lib/ai/localized-gen'

export const runtime = 'nodejs'
export const maxDuration = 120

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

// All 3 commercial modes — ALWAYS generated together and cached.
const ALL_MODES = ['import_sell', 'produce_locally', 'train_locals'] as const

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_BASE = `You are a senior consultant in international trade and business development, specialising in Sub-Saharan Africa and emerging markets.

You generate high-level, professional, actionable business plans for entrepreneurs and investors aiming to capture import/export or production opportunities in these markets.

Absolute rules:
- Be ultra-precise with real numbers based on your country/sector knowledge
- Give realistic investment ranges (not too wide)
- Identify real B2B customer types with company names credible for the region
- The action plan must be sequential and operational (no wishful thinking)
- Financial projections must be internally consistent
- Respond with ONLY valid JSON, no text before or after`

// ── Build prompt (always ALL 3 modes) ─────────────────────────────────────────

function buildPrompt(
  countryName: string,
  iso: string,
  opps: OppInput[],
  ctx: UserContext,
): string {
  const oppsText = opps.map(o =>
    `• ${o.product} (${o.category}) — Gap estimé: $${o.gap_value_usd ? (o.gap_value_usd / 1e6).toFixed(1) + 'M' : 'N/A'}/an, Score: ${o.score}/100, Type: ${o.type}${o.summary ? `. ${o.summary}` : ''}`,
  ).join('\n')

  const ctxLines = [
    ctx.qty_tons ? `• Volume visé : ${ctx.qty_tons} tonnes/mois` : '',
    ctx.price_eur_kg ? `• Prix de vente cible : ${ctx.price_eur_kg} €/kg` : '',
    ctx.budget_eur ? `• Budget disponible : ${ctx.budget_eur} €` : '',
    ctx.timeline ? `• Horizon de temps : ${ctx.timeline}` : '',
    ctx.sector ? `• Secteur actuel de l'investisseur : ${ctx.sector}` : '',
    ctx.notes ? `• Notes supplémentaires : ${ctx.notes}` : '',
  ].filter(Boolean).join('\n') || '• Aucun contexte spécifique fourni — utilise des hypothèses raisonnables'

  return `Génère un business plan complet pour les opportunités suivantes en ${countryName} (${iso}).

OPPORTUNITÉS SÉLECTIONNÉES :
${oppsText}

CONTEXTE DE L'INVESTISSEUR :
${ctxLines}

Tu dois générer **les TROIS modes de commercialisation** ci-dessous dans le même plan. L'utilisateur filtrera ensuite côté UI ce qu'il veut voir.

MODÈLES COMMERCIAUX À COUVRIR (les trois, exhaustivement) :
• import_sell — Import & Revente : acheter à l'étranger, importer et distribuer localement
• produce_locally — Production locale : installer une capacité de fabrication/transformation sur place
• train_locals — Former les locaux : modèle services/consulting, transfert de compétences

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
      "model": "import_sell",
      "title": "Titre de la stratégie Import & Revente",
      "description": "Description détaillée 3-4 phrases",
      "pros": ["avantage 1", "avantage 2", "avantage 3"],
      "cons": ["inconvénient 1", "inconvénient 2"],
      "investment_min_eur": 50000,
      "investment_max_eur": 200000,
      "timeline_months": 18,
      "margin_pct_min": 20,
      "margin_pct_max": 35,
      "breakeven_months": 14,
      "action_plan": [
        {
          "phase": 1,
          "title": "Titre de la phase",
          "duration": "Mois 1-3",
          "actions": ["action 1", "action 2", "action 3"],
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
        "notes": "note sur les hypothèses"
      },
      "b2b_targets": [
        {
          "segment": "Nom du segment",
          "description": "Description 1-2 phrases",
          "potential": "Volume ou valeur estimée",
          "examples": ["Entreprise 1 (pays)", "Entreprise 2 (pays)"],
          "approach": "Comment approcher en 1 phrase",
          "decision_cycle": "court|moyen|long",
          "volume_per_client": "ex: 5-20 tonnes/mois"
        }
      ]
    },
    { "model": "produce_locally", "title": "...", "description": "...", "pros": [...], "cons": [...], "investment_min_eur": ..., "investment_max_eur": ..., "timeline_months": ..., "margin_pct_min": ..., "margin_pct_max": ..., "breakeven_months": ..., "action_plan": [...], "financials": {...}, "b2b_targets": [...] },
    { "model": "train_locals",    "title": "...", "description": "...", "pros": [...], "cons": [...], "investment_min_eur": ..., "investment_max_eur": ..., "timeline_months": ..., "margin_pct_min": ..., "margin_pct_max": ..., "breakeven_months": ..., "action_plan": [...], "financials": {...}, "b2b_targets": [...] }
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
    { "name": "Nom", "description": "Ce qu'on y trouve", "url": "url si connue sinon null", "type": "institution|marketplace|database|tool" }
  ],
  "products_focus": ["produit 1", "produit 2"]
}

IMPORTANT : strategies[] doit contenir exactement 3 entrées, une par mode (import_sell, produce_locally, train_locals), chacune avec son propre action_plan, financials et b2b_targets.`
}

// ── Providers ─────────────────────────────────────────────────────────────────

function parseJson(text: string) {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('Invalid JSON in response')
}

async function generateWithGroq(prompt: string, system: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

async function generateWithGemini(prompt: string, system: string): Promise<string> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.7, maxOutputTokens: 16000, responseMimeType: 'application/json' },
    systemInstruction: system,
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function generateWithMistral(prompt: string, system: string): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error('MISTRAL_API_KEY not set')
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// Sort opp IDs to get a stable cache key regardless of selection order.
function normalizeOppIds(oppIds: string[]): string[] {
  return [...oppIds].sort()
}

// ── GET: cache lookup ──────────────────────────────────────────────────────────
// GET /api/reports/business-plan?iso=CIV&opps=id1,id2
// Returns { plan, cached: true } if hit, { cached: false } otherwise.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const iso = (searchParams.get('iso') ?? '').toUpperCase()
    const oppIds = (searchParams.get('opps') ?? '').split(',').filter(Boolean)
    if (!iso || oppIds.length === 0) {
      return Response.json({ error: 'Missing iso or opps' }, { status: 400 })
    }
    const sortedIds = normalizeOppIds(oppIds)

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('cached_business_plans')
      .select('plan, scope_reduction_pct, updated_at')
      .eq('user_id', user.id)
      .eq('country_iso', iso)
      .eq('opp_ids', sortedIds)
      .maybeSingle()

    if (error) {
      console.error('[business-plan GET] cache lookup error', error)
      return Response.json({ cached: false })
    }
    if (!data) return Response.json({ cached: false })
    return Response.json({ cached: true, plan: data.plan, scope_reduction_pct: data.scope_reduction_pct, updated_at: data.updated_at })
  } catch (err) {
    console.error('[business-plan GET]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST: generate (always 3 modes) + cache ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { countryName, iso, opportunities, userContext } = body as {
      countryName?: string
      iso: string
      opportunities: OppInput[]
      userContext?: UserContext
    }

    if (!iso || !opportunities?.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sortedIds = normalizeOppIds(opportunities.map((o) => o.id))

    // Double-check cache before calling LLM (race between tabs)
    const { data: existing } = await supabase
      .from('cached_business_plans')
      .select('plan, scope_reduction_pct')
      .eq('user_id', user.id)
      .eq('country_iso', iso.toUpperCase())
      .eq('opp_ids', sortedIds)
      .maybeSingle()

    if (existing?.plan) {
      return Response.json({ plan: existing.plan, scope_reduction_pct: existing.scope_reduction_pct, cached: true })
    }

    // Always build prompt for ALL 3 modes
    const prompt = buildPrompt(
      countryName ?? iso,
      iso,
      opportunities,
      (userContext ?? {}) as UserContext,
    )

    const locale: Locale = getServerLocale({ request: req })
    const system = localizeSystemPrompt(SYSTEM_BASE, locale)

    const providers: { name: string; fn: () => Promise<string> }[] = [
      ...(process.env.GROQ_API_KEY ? [{ name: 'Groq', fn: () => generateWithGroq(prompt, system) }] : []),
      ...(process.env.GOOGLE_GENERATIVE_AI_API_KEY ? [{ name: 'Gemini', fn: () => generateWithGemini(prompt, system) }] : []),
      ...(process.env.MISTRAL_API_KEY ? [{ name: 'Mistral', fn: () => generateWithMistral(prompt, system) }] : []),
    ]
    if (!providers.length) {
      return Response.json({ error: 'Aucune clé API configurée' }, { status: 503 })
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

    // Persist to cache (upsert on conflict)
    const { error: upsertError } = await supabase
      .from('cached_business_plans')
      .upsert({
        user_id: user.id,
        country_iso: iso.toUpperCase(),
        opp_ids: sortedIds,
        plan,
        scope_reduction_pct: 0,
        lang: locale,
      }, { onConflict: 'user_id,country_iso,opp_ids' })

    if (upsertError) {
      console.error('[business-plan] cache upsert failed', upsertError)
    }

    return Response.json({ plan, cached: false })
  } catch (err) {
    console.error('[business-plan API]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// ── PATCH: scope reduction (option 1 "réduire budget") ──────────────────────
// PATCH /api/reports/business-plan?iso=CIV&opps=id1,id2  body: { scope_reduction_pct: 30 }
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const iso = (searchParams.get('iso') ?? '').toUpperCase()
    const oppIds = (searchParams.get('opps') ?? '').split(',').filter(Boolean)
    if (!iso || oppIds.length === 0) {
      return Response.json({ error: 'Missing iso or opps' }, { status: 400 })
    }
    const sortedIds = normalizeOppIds(oppIds)

    const body = await req.json()
    const pct = Number(body.scope_reduction_pct ?? 0)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return Response.json({ error: 'Invalid scope_reduction_pct' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('cached_business_plans')
      .update({ scope_reduction_pct: Math.round(pct) })
      .eq('user_id', user.id)
      .eq('country_iso', iso)
      .eq('opp_ids', sortedIds)
      .select('plan, scope_reduction_pct')
      .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ plan: data.plan, scope_reduction_pct: data.scope_reduction_pct })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
