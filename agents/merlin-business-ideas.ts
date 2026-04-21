// @ts-nocheck
/**
 * 🧙 MERLIN — Business Idea Generator (Sage Infinity, Seven Deadly Sins).
 *
 * Role: continuously imagine businesses our agent army can ship FAST for cash.
 * Each idea is stored in business_ideas with pitch, projections, activation
 * stack, priority, and autonomy score (how much of this can we do with zero
 * human labor). Kushina 🌀 reviews (auto), user shortlists → action plan.
 *
 * Generates 10-20 ideas per run. Rotates "creative lenses" to avoid
 * repetitive patterns: saas, marketplace, data, content, service, tool, course.
 *
 * Run: npx tsx agents/merlin-business-ideas.ts --lens=saas --count=10
 * Cron: /root/monitor/ftg-merlin.sh — daily 11h UTC (after Kushina + Guy)
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { runCascadeJson } from '@/lib/ai/cascade'

loadEnv()

type Args = { lens?: string; count: number; includeKushinaReview: boolean }
function parseArgs(): Args {
  const out: Args = { count: 10, includeKushinaReview: true }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'lens' && v) out.lens = v
    if (k === 'count' && v) out.count = Number(v)
    if (k === 'no-review') out.includeKushinaReview = false
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const LENSES = [
  { key: 'saas', hint: 'SaaS subscription tool — niche pain point, high margin' },
  { key: 'marketplace', hint: '2-sided marketplace — commission on GMV' },
  { key: 'data', hint: 'Data product — license datasets to enterprise or API access' },
  { key: 'content', hint: 'Content/media — newsletter, podcast, YouTube niche monetized' },
  { key: 'service', hint: 'Service productized — agency-in-a-box run by agents' },
  { key: 'tool', hint: 'Free tool with freemium upgrade — virality driver' },
  { key: 'course', hint: 'Online course / cohort — premium pricing' },
  { key: 'directory', hint: 'Curated directory with paid listings' },
  { key: 'chrome_ext', hint: 'Browser extension freemium — viral distribution' },
  { key: 'api_as_service', hint: 'API-first product for developers' },
]

const PROMPT = (lens: { key: string; hint: string }, count: number) => `Tu es 🧙 **MERLIN** (Seven Deadly Sins), sage infini, curieux obsessionnel.

**Context** : nous avons une armée d'agents IA prêts pour lancer des business en quasi-autonomie :
- ⚡ Minato (orchestrateur) · 🌀 Kushina (kaizen quotidien) · 🟢 Might Guy (variantes A/B)
- 🪞 Shisui (content orchestrator) · 🎥 Rock Lee v2 (YouTube dedup) · 🍴 Eishi (Layer 1+2 hybride cache/adapt)
- 🐺 Kakashi (copy ninja anti-dup) · 🦊 Kurama (image gen zero-coût) · 🔥 Mustang (design coherence)
- 👁️‍🗨️ Itachi (web/YouTube analysis via Playwright+yt-transcript) · 💚 Deku (classifier auto-improve)
- ⚓ Nami (commerce scout→build→pitch) · 🧠 Shikamaru (R&B stratège) · 👑 Lelouch (funnel forecast)
- 🟦 Rimuru (SUK méta-agents auto-améliorants) · 🗡️ Akame (publish gate strict)
- Stack actuelle : Next.js + Supabase + Vercel + Resend + Stripe + Seedance + ElevenLabs + Playwright MCP + Apollo/Hunter/PhantomBuster adapters + 13 LLM providers cascade

**Lens pour cette run** : **${lens.key}** — ${lens.hint}

**Ta position** : tu travailles au même niveau que Minato ⚡ et Kushina 🌀 (top-triangle). Tu peux DÉCIDER de cloner certains agents de l'arsenal dans une "squad" dédiée au business proposé, avec config per-business (prompts, cadence, budget). Chaque idée = son propre namespace autonome.

**Ta mission** : propose ${count} business idées **ACTIVABLES rapidement** (time-to-first-revenue < 60 jours), **à fort potentiel cash**, et **autonomes** (~0 labor humain une fois lancées grâce à notre armée).

Pour chaque idée, propose **une squad minimale mais suffisante** : quels agents cloner, avec quelles overrides (prompt adapté au business, cadence, budget). Éviter le sur-staffing.

Pour chaque idée, sois CONCRET, pas générique. Pense aux monopoly-mini : niches précises + différenciation claire.

Retourne UNIQUEMENT du JSON valide (pas de markdown) :

{
  "lens": "${lens.key}",
  "ideas": [
    {
      "title": "string court et percutant",
      "tagline": "string 10 mots max",
      "pitch_60s": "string ~400 mots — narrable en 1 min, problème → solution → pourquoi nous → traction attendue",
      "category": "${lens.key}",
      "target_audience": "string précis ex: 'traders import-export spécialisés cacao Afrique' (pas 'entrepreneurs')",
      "value_prop": "string 1 phrase claire",
      "monetization_model": "sub|oneshot|commission|ads|data_license|mix",
      "agents_leveraged": ["minato","kushina","rock_lee","eishi","kakashi","nami","..."],
      "activation_stack": {
        "platform": "vercel|netlify|self-hosted|cloudflare",
        "domain_need": "buy_new|subdomain|existing",
        "stack": ["nextjs","supabase","stripe","..."],
        "integrations": ["apollo","seedance","elevenlabs","..."]
      },
      "time_to_live_days": 7-60,
      "budget_eur": 0-5000,
      "projections": {
        "m1_revenue_eur": number,
        "m3_revenue_eur": number,
        "m12_revenue_eur": number,
        "m1_clients": number,
        "m12_clients": number,
        "gross_margin_pct": 50-95,
        "cac_eur": number,
        "ltv_eur": number,
        "hypotheses": "string - hypothèses clés"
      },
      "priority": 1-5,
      "urgency": "urgent|normal|later",
      "autonomy_score": 0-100,
      "differentiation": "string - notre edge unique",
      "risks": ["risk1", "risk2"],
      "tags": ["b2b","b2c","ai","data","africa","trade","..."],
      "proposed_squad": [
        {
          "agent_key": "minato|kushina|rock_lee|eishi|kakashi|kurama|shisui|...",
          "role_in_this_business": "string - ce qu'il fait SPÉCIFIQUEMENT pour ce business",
          "clone_config": {
            "prompt_override": "string or null",
            "cadence": "realtime|hourly|daily|weekly",
            "budget_cap_monthly_eur": number,
            "notes": "string"
          }
        }
      ],
      "squad_project_key": "string - slug unique, ex: 'trade-digest-weekly'"
    }
  ],
  "merlin_commentary": "string - observations générales, patterns, synergies entre idées, réflexion sur clonage squads"
}`

const KUSHINA_REVIEW_PROMPT = (idea: any) => `Tu es 🌀 **KUSHINA**, partenaire stratégique critique.
Merlin 🧙 vient de proposer cette idée business :

\`\`\`json
${JSON.stringify(idea, null, 2)}
\`\`\`

**Juge-la** avec tes chakra chains : franche, structurée, sans complaisance.
Critères : feasibility × marché × différenciation × autonomy × ROI.

Retourne JSON uniquement :
{
  "score": 0-100,
  "strengths": ["string - 2-4 points forts"],
  "concerns": ["string - 2-4 blockers/risques"],
  "verdict": "go|nogo|pivot",
  "pivot_suggestion": "string si pivot, sinon null",
  "priority_adjusted": 1-5
}`

async function generateIdeas(lens: { key: string; hint: string }, count: number) {
  const result = await runCascadeJson({
    tier: 'premium',
    task: `merlin-business-ideas-${lens.key}`,
    basePrompt: PROMPT(lens, count),
  })
  return (result as any)?.ideas ?? []
}

async function kushinaReview(idea: any) {
  try {
    const r = await runCascadeJson({
      tier: 'standard',
      task: 'kushina-review',
      basePrompt: KUSHINA_REVIEW_PROMPT(idea),
    })
    return r
  } catch (e) {
    console.warn('  kushina review failed:', (e as Error).message.slice(0, 80))
    return null
  }
}

async function main() {
  const args = parseArgs()
  const sb = db()

  const lens = args.lens
    ? (LENSES.find(l => l.key === args.lens) ?? LENSES[0])
    : LENSES[Math.floor(Math.random() * LENSES.length)]

  console.log(`🧙 Merlin — lens=${lens.key} count=${args.count}`)
  const ideas = await generateIdeas(lens, args.count)
  console.log(`✓ ${ideas.length} ideas generated`)

  if (!ideas.length) {
    console.log('no ideas — abort')
    return
  }

  let inserted = 0
  for (const idea of ideas) {
    let review = null
    if (args.includeKushinaReview) review = await kushinaReview(idea)

    const { error } = await sb.from('business_ideas').insert({
      title: idea.title,
      tagline: idea.tagline,
      pitch_60s: idea.pitch_60s,
      category: idea.category ?? lens.key,
      target_audience: idea.target_audience,
      value_prop: idea.value_prop,
      monetization_model: idea.monetization_model,
      agents_leveraged: idea.agents_leveraged ?? [],
      activation_stack: idea.activation_stack ?? {},
      proposed_squad: idea.proposed_squad ?? [],
      squad_project_key: idea.squad_project_key ?? null,
      squad_agents_count: (idea.proposed_squad ?? []).length,
      time_to_live_days: idea.time_to_live_days,
      budget_eur: idea.budget_eur,
      projections: idea.projections ?? {},
      priority: (review as any)?.priority_adjusted ?? idea.priority ?? 3,
      urgency: idea.urgency ?? 'normal',
      autonomy_score: idea.autonomy_score ?? 50,
      differentiation: idea.differentiation,
      risks: idea.risks ?? [],
      tags: idea.tags ?? [],
      kushina_review: review,
      status: review?.verdict === 'nogo' ? 'killed' : 'proposed',
    })
    if (!error) inserted++
    else console.warn('insert error:', error.message)
  }

  const { count: total } = await sb.from('business_ideas').select('*', { count: 'exact', head: true })
  console.log(`→ inserted=${inserted} · total ideas in DB = ${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
