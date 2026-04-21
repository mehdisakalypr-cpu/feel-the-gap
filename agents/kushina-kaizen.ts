// @ts-nocheck
/**
 * 🌀 KUSHINA — Daily Kaizen agent (Minato's co-équipier).
 *
 * Named after Kushina Uzumaki (Naruto): Minato's partner, master of sealing
 * and chakra-sensing. Her role here: detect the signals (metric analysis),
 * seal the learnings (proposals crystallized into reusable patterns), and
 * push hard every morning with 3-5 concrete improvements for Minato to act on.
 *
 * Runs daily at 08:00 UTC. Reads last 7 days of:
 *   - content cache filling rate (Rock Lee v2 + Eishi base)
 *   - lead pool growth + scoring distribution
 *   - campaign sends + replies + demos + paid
 *   - external signals (macro news — once Playwright MCP is wired for it)
 *
 * Writes to ftg_kaizen_proposals. Surfaced in /admin/kaizen UI.
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { runCascadeJson } from '@/lib/ai/cascade'

loadEnv()

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

interface Metrics {
  day_tag: string
  leads: {
    total: number; priority: number; new_7d: number;
    by_segment: Record<string, number>;
    avg_gap_match_score: number;
  }
  content: {
    videos_ready: number; videos_failed: number;
    base_ready: number; base_failed: number;
    legacy_ready: number;
    pairs_added_7d: number;
  }
  campaigns: {
    active: number; sent_7d: number; replied_7d: number; demo_booked_7d: number;
    reply_rate_pct: number;
  }
  funnel: {
    source_to_paid_pct: number;
    weakest_step: string | null;  // e.g. 'response_rate'
  }
}

async function collectMetrics(sb: any): Promise<Metrics> {
  const day_tag = new Date().toISOString().slice(0, 10)

  // Leads
  const [totalLeads, priorityLeads, newLeads7d, leadsBySegment, avgScore] = await Promise.all([
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('is_priority', true),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo()),
    sb.from('ftg_leads').select('segment').not('segment', 'is', null),
    sb.from('ftg_leads').select('gap_match_score').gt('gap_match_score', 0),
  ])
  const segCounts: Record<string, number> = {}
  for (const r of (leadsBySegment.data ?? []) as { segment: string }[]) {
    segCounts[r.segment] = (segCounts[r.segment] ?? 0) + 1
  }
  const scores = (avgScore.data ?? []) as { gap_match_score: number }[]
  const avg = scores.length ? Math.round(scores.reduce((s, r) => s + r.gap_match_score, 0) / scores.length) : 0

  // Content caches
  const [vReady, vFail, bReady, bFail, lReady, pairsNew7d] = await Promise.all([
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('ftg_product_country_content').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_content').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('ftg_opportunity_content').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).gte('generated_at', sevenDaysAgo()).eq('status', 'ready'),
  ])

  // Campaigns
  const [activeCamp, sent7d, replied7d, demos7d] = await Promise.all([
    sb.from('ftg_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    sb.from('ftg_campaign_sends').select('*', { count: 'exact', head: true }).gte('sent_at', sevenDaysAgo()),
    sb.from('ftg_campaign_sends').select('*', { count: 'exact', head: true }).eq('status', 'replied').gte('sent_at', sevenDaysAgo()),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('status', 'demo_booked').gte('status_changed_at', sevenDaysAgo()),
  ])

  const sent = sent7d.count ?? 0
  const repl = replied7d.count ?? 0
  const reply_rate = sent > 0 ? Math.round((repl / sent) * 100) : 0

  // Weakest funnel step (simple heuristic)
  let weakest: string | null = null
  if (sent > 50 && reply_rate < 5) weakest = 'response_rate'
  else if ((priorityLeads.count ?? 0) < 100) weakest = 'lead_quality'
  else if ((newLeads7d.count ?? 0) < 500) weakest = 'lead_volume'

  return {
    day_tag,
    leads: {
      total: totalLeads.count ?? 0,
      priority: priorityLeads.count ?? 0,
      new_7d: newLeads7d.count ?? 0,
      by_segment: segCounts,
      avg_gap_match_score: avg,
    },
    content: {
      videos_ready: vReady.count ?? 0,
      videos_failed: vFail.count ?? 0,
      base_ready: bReady.count ?? 0,
      base_failed: bFail.count ?? 0,
      legacy_ready: lReady.count ?? 0,
      pairs_added_7d: pairsNew7d.count ?? 0,
    },
    campaigns: {
      active: activeCamp.count ?? 0,
      sent_7d: sent,
      replied_7d: repl,
      demo_booked_7d: demos7d.count ?? 0,
      reply_rate_pct: reply_rate,
    },
    funnel: {
      source_to_paid_pct: 0.46,  // from scenario, to update with real cohort
      weakest_step: weakest,
    },
  }
}

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString()
}

const PROMPT = (metrics: Metrics) => `Tu es **KUSHINA 🌀**, partenaire stratégique de Minato pour Feel The Gap.
Objectif : augmenter acquisition leads qualifiés + conversion demo→paid vers le palier €28k MRR en 3 mois.

**Métriques 7 derniers jours** :
\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`

**Arsenal existant** :
- Rock Lee v2 (videos dedup), Eishi (Layer 1 base + Layer 2 adapt), Shisui orchestrator
- Apollo/Hunter/PhantomBuster adapters (ready-to-key)
- Gap-match scoring (titre 30 + bio 20 + size 15 + country 25 + email 10)
- 13 LLM providers cascade · crédit $200 GCP Places pending

**Tu dois proposer AUJOURD'HUI entre 3 et 5 actions concrètes**, chacune :
1. Actionnable par Mehdi (solo) ou via agents existants dans < 24h
2. À fort impact (si possible 2×+ sur 1 métrique clé)
3. Pas déjà fait (être créatif — raisonner aux "10× multipliers")

Prioriser : bottleneck identifié = **${metrics.funnel.weakest_step ?? 'inconnu'}**.

Retourne UNIQUEMENT du JSON valide (pas de markdown) :

{
  "top_signal_of_the_week": "string - le chiffre qui t'a le plus surpris",
  "proposals": [
    {
      "title": "string court",
      "category": "acquisition|conversion|content|technical|pricing|partnerships|external_signals",
      "rationale": "string 2-3 phrases pourquoi maintenant",
      "action_steps": ["step1", "step2", "step3"],
      "expected_impact": {"metric": "string", "multiplier": "2x|3x|5x|10x", "horizon_days": number},
      "requires": ["Mehdi|agents|api_key|budget|partner"],
      "priority": 1-5,
      "estimated_cost_eur": number
    }
  ],
  "external_signals_to_monitor": ["string - news/events à surveiller cette semaine"],
  "kushina_note": "string - ton mot de fin, franche et énergique"
}`

async function main() {
  const sb = db()
  console.log('🌀 Kushina Kaizen — daily proposal run')

  const metrics = await collectMetrics(sb)
  console.log('Metrics collected:', JSON.stringify(metrics.leads), 'weakest=' + metrics.funnel.weakest_step)

  const proposals = await runCascadeJson({
    tier: 'standard',
    task: 'kushina-kaizen',
    basePrompt: PROMPT(metrics),
  })

  const { data, error } = await sb.from('ftg_kaizen_proposals').insert({
    day_tag: metrics.day_tag,
    source_signals: metrics,
    proposals,
    status: 'new',
    created_by: 'kushina',
  }).select().single()

  if (error) {
    console.error('insert error:', error.message)
    process.exit(1)
  }
  console.log(`✓ proposal saved id=${data?.id} · ${((proposals as any)?.proposals?.length ?? 0)} actions`)
}

main().catch((e) => { console.error(e); process.exit(1) })
