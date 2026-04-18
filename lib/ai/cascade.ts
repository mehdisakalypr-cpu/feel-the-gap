/**
 * lib/ai/cascade — Vague 4 #8 · 2026-04-18
 *
 * Wrapper tier-aware autour d'agents/providers.ts :
 *  - tier 'data' | 'basic' | 'standard' | 'strategy' | 'premium' → 1 passe simple
 *  - tier 'ultimate' → cascade 3 passes (draft → refine → polish) pour qualité max
 *
 * Justifie la tarification Ultimate (299€/250 opps/mois) : coût LLM ×3 interne
 * mais qualité business-plan niveau agence.
 *
 * Providers routés dans l'ordre : Gemini → Groq → OpenRouter (→ OpenAI dernier recours).
 * Le module n'est PAS un remplacement de agents/providers.ts — il l'importe.
 */

import { gen, initProviders } from '../../agents/providers'

export type AiTier = 'data' | 'basic' | 'standard' | 'strategy' | 'premium' | 'ultimate'

export type CascadeRequest = {
  tier: AiTier
  basePrompt: string
  task: string // titre court pour logs
  maxTokens?: number
  language?: 'fr' | 'en'
}

export type CascadeResult = {
  text: string
  tier: AiTier
  passes: number
  /** Estimation coût relatif (1 = basic/simple, 3 = ultimate) */
  relativeCost: number
  durationMs: number
  /** Artefacts des passes intermédiaires (ultimate seulement) */
  trace?: Array<{ pass: string; snippet: string }>
}

const TIER_CONFIG: Record<AiTier, { passes: number; maxTokens: number; relativeCost: number }> = {
  data:     { passes: 1, maxTokens: 4096,  relativeCost: 1.0 },
  basic:    { passes: 1, maxTokens: 6144,  relativeCost: 1.0 },
  standard: { passes: 1, maxTokens: 8192,  relativeCost: 1.0 },
  strategy: { passes: 1, maxTokens: 10_240, relativeCost: 1.2 },
  premium:  { passes: 2, maxTokens: 12_288, relativeCost: 2.0 },
  ultimate: { passes: 3, maxTokens: 16_384, relativeCost: 3.0 },
}

/**
 * Passe 1 (draft) — génération brute rapide.
 * Passe 2 (refine) — amélioration structurelle (paragraphes, clarté, chiffres).
 * Passe 3 (polish) — ton final, objections, quantification ROI.
 */
function draftPrompt(req: CascadeRequest): string {
  return `${req.basePrompt}\n\n[Instructions de draft]\nRédige une première version complète et structurée.`
}

function refinePrompt(req: CascadeRequest, draft: string): string {
  return `Tu es un consultant stratégie senior. Voici un draft à raffiner :

${draft}

[Raffinage demandé]
- Structure claire (titres numérotés, bullets courts)
- Chiffres crédibles (marges, CA, ROI) avec unités explicites
- Élimine jargon, garde le concret
- ${req.language === 'en' ? 'Write in English' : 'Conserve le français'}
- Longueur finale : proche du draft, pas plus court de 20%

Renvoie uniquement le texte raffiné, sans préambule.`
}

function polishPrompt(req: CascadeRequest, refined: string): string {
  return `Tu es directeur de cabinet conseil. Voici un document raffiné :

${refined}

[Polish final demandé]
- Ajoute 1 contre-objection avec réponse (anticipation risques)
- Quantifie le ROI en scénarios (pessimiste / médian / optimiste)
- Ton confiant, précis, factuel (pas commercial creux)
- Respecte la structure du document d'entrée

Renvoie uniquement le document final, sans préambule.`
}

export async function runCascade(req: CascadeRequest): Promise<CascadeResult> {
  const t0 = Date.now()
  const cfg = TIER_CONFIG[req.tier] ?? TIER_CONFIG.basic
  const trace: Array<{ pass: string; snippet: string }> = []

  initProviders()

  // Pass 1 — draft
  const draft = await gen(draftPrompt(req), cfg.maxTokens)
  trace.push({ pass: 'draft', snippet: draft.slice(0, 240) })

  if (cfg.passes === 1) {
    return {
      text: draft,
      tier: req.tier,
      passes: 1,
      relativeCost: cfg.relativeCost,
      durationMs: Date.now() - t0,
      trace: undefined,
    }
  }

  // Pass 2 — refine
  const refined = await gen(refinePrompt(req, draft), cfg.maxTokens)
  trace.push({ pass: 'refine', snippet: refined.slice(0, 240) })

  if (cfg.passes === 2) {
    return {
      text: refined,
      tier: req.tier,
      passes: 2,
      relativeCost: cfg.relativeCost,
      durationMs: Date.now() - t0,
      trace,
    }
  }

  // Pass 3 — polish (ultimate seulement)
  const polished = await gen(polishPrompt(req, refined), cfg.maxTokens)
  trace.push({ pass: 'polish', snippet: polished.slice(0, 240) })

  return {
    text: polished,
    tier: req.tier,
    passes: 3,
    relativeCost: cfg.relativeCost,
    durationMs: Date.now() - t0,
    trace,
  }
}

/**
 * Variante parallèle — lance 3 drafts simultanés et pick le plus long/détaillé.
 * Utilisé pour tier 'ultimate' quand on veut diversité de perspectives.
 * Le coût relatif reste ×3.
 */
export async function runParallelCascade(req: CascadeRequest): Promise<CascadeResult> {
  const t0 = Date.now()
  const cfg = TIER_CONFIG[req.tier] ?? TIER_CONFIG.basic
  initProviders()

  const variants = [
    `${req.basePrompt}\n\n[Angle] Focus ROI chiffré.`,
    `${req.basePrompt}\n\n[Angle] Focus risques + mitigations.`,
    `${req.basePrompt}\n\n[Angle] Focus opportunités uniques.`,
  ].slice(0, cfg.passes)

  const drafts = await Promise.all(variants.map(p => gen(p, cfg.maxTokens)))
  const best = drafts.reduce((a, b) => (b.length > a.length ? b : a), drafts[0])

  return {
    text: best,
    tier: req.tier,
    passes: drafts.length,
    relativeCost: cfg.relativeCost,
    durationMs: Date.now() - t0,
    trace: drafts.map((d, i) => ({ pass: `parallel_${i}`, snippet: d.slice(0, 240) })),
  }
}

export function getTierConfig(tier: AiTier) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG.basic
}
