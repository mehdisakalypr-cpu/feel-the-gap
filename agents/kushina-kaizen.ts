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

interface AgentMetrics {
  agent: string                    // 'shisui' | 'rock_lee' | 'eishi_l1' | ...
  emoji: string
  role: string
  metrics: Record<string, number | string | null>
  health: 'healthy' | 'degraded' | 'failing' | 'idle'
  weakness: string | null          // 1-line observation, null if fine
}

interface Metrics {
  day_tag: string
  leads: {
    total: number; priority: number; new_7d: number;
    by_segment: Record<string, number>;
    avg_gap_match_score: number;
  }
  campaigns: {
    active: number; sent_7d: number; replied_7d: number; demo_booked_7d: number;
    reply_rate_pct: number;
  }
  funnel: {
    source_to_paid_pct: number;
    weakest_step: string | null;
  }
  agents: AgentMetrics[]           // per-agent snapshot for targeted kaizen
}

async function collectMetrics(sb: any): Promise<Metrics> {
  const day_tag = new Date().toISOString().slice(0, 10)

  // ─── Leads ─────────────────────────────────────────────────
  const [totalLeads, priorityLeads, newLeads7d, leadsBySegment, avgScore, leadsBySource] = await Promise.all([
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('is_priority', true),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo()),
    sb.from('ftg_leads').select('segment').not('segment', 'is', null),
    sb.from('ftg_leads').select('gap_match_score').gt('gap_match_score', 0),
    sb.from('ftg_leads').select('source').gte('created_at', sevenDaysAgo()),
  ])
  const segCounts: Record<string, number> = {}
  for (const r of (leadsBySegment.data ?? []) as { segment: string }[]) segCounts[r.segment] = (segCounts[r.segment] ?? 0) + 1
  const srcCounts: Record<string, number> = {}
  for (const r of (leadsBySource.data ?? []) as { source: string }[]) srcCounts[r.source] = (srcCounts[r.source] ?? 0) + 1
  const scores = (avgScore.data ?? []) as { gap_match_score: number }[]
  const avg = scores.length ? Math.round(scores.reduce((s, r) => s + r.gap_match_score, 0) / scores.length) : 0

  // ─── Content caches ────────────────────────────────────────
  const [vReady, vFail, bReady, bFail, lReady, pairsNew7d, basePairs7d, oppContent7d] = await Promise.all([
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('ftg_product_country_content').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_content').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    sb.from('ftg_opportunity_content').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('ftg_product_country_videos').select('*', { count: 'exact', head: true }).gte('generated_at', sevenDaysAgo()).eq('status', 'ready'),
    sb.from('ftg_product_country_content').select('*', { count: 'exact', head: true }).gte('generated_at', sevenDaysAgo()).eq('status', 'ready'),
    sb.from('ftg_opportunity_content').select('*', { count: 'exact', head: true }).gte('generated_at', sevenDaysAgo()).eq('status', 'ready'),
  ])

  // ─── Jobs queue (Shisui) ───────────────────────────────────
  const [shisuiPending, shisuiRunning, shisuiFailed7d, shisuiDone7d] = await Promise.all([
    sb.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    sb.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', sevenDaysAgo()),
    sb.from('ftg_content_jobs').select('*', { count: 'exact', head: true }).eq('status', 'done').gte('created_at', sevenDaysAgo()),
  ])
  const shisuiTotal7d = (shisuiDone7d.count ?? 0) + (shisuiFailed7d.count ?? 0)
  const shisuiErrRate = shisuiTotal7d > 0 ? Math.round(((shisuiFailed7d.count ?? 0) / shisuiTotal7d) * 100) : 0

  // ─── Campaigns ─────────────────────────────────────────────
  const [activeCamp, sent7d, replied7d, demos7d] = await Promise.all([
    sb.from('ftg_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    sb.from('ftg_campaign_sends').select('*', { count: 'exact', head: true }).gte('sent_at', sevenDaysAgo()),
    sb.from('ftg_campaign_sends').select('*', { count: 'exact', head: true }).eq('status', 'replied').gte('sent_at', sevenDaysAgo()),
    sb.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('status', 'demo_booked').gte('status_changed_at', sevenDaysAgo()),
  ])
  const sent = sent7d.count ?? 0
  const repl = replied7d.count ?? 0
  const reply_rate = sent > 0 ? Math.round((repl / sent) * 100) : 0

  // ─── Might Guy ────────────────────────────────────────────
  const [guyPending, guyWon, guyLost] = await Promise.all([
    sb.from('ftg_guy_experiments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('ftg_guy_experiments').select('*', { count: 'exact', head: true }).eq('status', 'won').gte('created_at', sevenDaysAgo()),
    sb.from('ftg_guy_experiments').select('*', { count: 'exact', head: true }).eq('status', 'lost').gte('created_at', sevenDaysAgo()),
  ])

  // ─── Funnel weakest ───────────────────────────────────────
  let weakest: string | null = null
  if (sent > 50 && reply_rate < 5) weakest = 'response_rate'
  else if ((priorityLeads.count ?? 0) < 100) weakest = 'lead_quality'
  else if ((newLeads7d.count ?? 0) < 500) weakest = 'lead_volume'

  // ─── Per-agent health snapshot ────────────────────────────
  const agents: AgentMetrics[] = [
    {
      agent: 'shisui', emoji: '🪞', role: 'Content orchestrator',
      metrics: {
        pending_jobs: shisuiPending.count ?? 0,
        running_jobs: shisuiRunning.count ?? 0,
        done_7d: shisuiDone7d.count ?? 0,
        failed_7d: shisuiFailed7d.count ?? 0,
        error_rate_pct: shisuiErrRate,
      },
      health: shisuiErrRate > 30 ? 'degraded' : shisuiErrRate > 60 ? 'failing' : (shisuiDone7d.count ?? 0) === 0 ? 'idle' : 'healthy',
      weakness: shisuiErrRate > 30 ? `${shisuiErrRate}% fail rate sur 7j` : null,
    },
    {
      agent: 'rock_lee', emoji: '🎥', role: 'YouTube video dedup (product×country)',
      metrics: {
        videos_ready: vReady.count ?? 0,
        videos_failed: vFail.count ?? 0,
        pairs_added_7d: pairsNew7d.count ?? 0,
      },
      health: (vFail.count ?? 0) > 100 ? 'degraded' : (pairsNew7d.count ?? 0) === 0 ? 'idle' : 'healthy',
      weakness: (vFail.count ?? 0) > 100 ? `${vFail.count} failed pairs (souvent quota YouTube)` : null,
    },
    {
      agent: 'eishi_l1', emoji: '🍴', role: 'Layer 1 base content (shared per product×country×lang)',
      metrics: {
        base_ready: bReady.count ?? 0,
        base_failed: bFail.count ?? 0,
        triples_added_7d: basePairs7d.count ?? 0,
      },
      health: (bFail.count ?? 0) > 30 ? 'degraded' : (basePairs7d.count ?? 0) === 0 ? 'idle' : 'healthy',
      weakness: (bReady.count ?? 0) < 100 ? `Cache Layer 1 à ${bReady.count ?? 0} rows — priorité acceleration coverage` : null,
    },
    {
      agent: 'eishi_l2', emoji: '💎', role: 'Layer 2 per-opp personalization (paid-triggered)',
      metrics: {
        legacy_ready: lReady.count ?? 0,
        opps_added_7d: oppContent7d.count ?? 0,
      },
      health: (lReady.count ?? 0) === 0 ? 'idle' : 'healthy',
      weakness: null,
    },
    {
      agent: 'leads_apollo', emoji: '🚀', role: 'Apollo.io ingestion',
      metrics: {
        from_apollo_7d: srcCounts['apollo'] ?? 0,
        is_configured: process.env.APOLLO_API_KEY ? 1 : 0,
      },
      health: !process.env.APOLLO_API_KEY ? 'idle' : (srcCounts['apollo'] ?? 0) === 0 ? 'failing' : 'healthy',
      weakness: !process.env.APOLLO_API_KEY ? 'API key pas configurée — activer Apollo Basic $49/mo' : null,
    },
    {
      agent: 'leads_hunter', emoji: '🐺', role: 'Hunter.io email verification',
      metrics: {
        is_configured: process.env.HUNTER_API_KEY ? 1 : 0,
      },
      health: !process.env.HUNTER_API_KEY ? 'idle' : 'healthy',
      weakness: !process.env.HUNTER_API_KEY ? 'API key pas configurée — activer Hunter Starter $34/mo' : null,
    },
    {
      agent: 'leads_phantombuster', emoji: '👻', role: 'PhantomBuster LinkedIn scraping',
      metrics: {
        is_configured: process.env.PHANTOMBUSTER_API_KEY ? 1 : 0,
      },
      health: !process.env.PHANTOMBUSTER_API_KEY ? 'idle' : 'healthy',
      weakness: !process.env.PHANTOMBUSTER_API_KEY ? 'API key pas configurée — activer PhantomBuster Starter $69/mo' : null,
    },
    {
      agent: 'campaigns', emoji: '📧', role: 'Outbound email campaigns (Instantly/Apollo send)',
      metrics: {
        active: activeCamp.count ?? 0,
        sent_7d: sent,
        reply_rate_pct: reply_rate,
        demos_7d: demos7d.count ?? 0,
      },
      health: sent > 50 && reply_rate < 3 ? 'failing' : sent > 50 && reply_rate < 7 ? 'degraded' : (activeCamp.count ?? 0) === 0 ? 'idle' : 'healthy',
      weakness: sent > 50 && reply_rate < 7 ? `Reply rate ${reply_rate}% < industry avg 7% (deliverability? perso?)` : (activeCamp.count ?? 0) === 0 ? 'Aucune campagne active' : null,
    },
    {
      agent: 'might_guy', emoji: '🟢', role: 'Hachimon variations on top kaizen proposal',
      metrics: {
        pending: guyPending.count ?? 0,
        won_7d: guyWon.count ?? 0,
        lost_7d: guyLost.count ?? 0,
      },
      health: ((guyWon.count ?? 0) + (guyLost.count ?? 0)) === 0 ? 'idle' : 'healthy',
      weakness: ((guyWon.count ?? 0) + (guyLost.count ?? 0)) === 0 ? 'Guy pas encore utilisé — première expérimentation en attente' : null,
    },
  ]

  return {
    day_tag,
    leads: {
      total: totalLeads.count ?? 0,
      priority: priorityLeads.count ?? 0,
      new_7d: newLeads7d.count ?? 0,
      by_segment: segCounts,
      avg_gap_match_score: avg,
    },
    campaigns: {
      active: activeCamp.count ?? 0,
      sent_7d: sent,
      replied_7d: repl,
      demo_booked_7d: demos7d.count ?? 0,
      reply_rate_pct: reply_rate,
    },
    funnel: {
      source_to_paid_pct: 0.46,
      weakest_step: weakest,
    },
    agents,
  }
}

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString()
}

const PROMPT = (metrics: Metrics) => `Tu es **KUSHINA 🌀**, partenaire stratégique de Minato pour Feel The Gap.
Objectif : €28k MRR dans 3 mois. Ta spécialité : détecter les faiblesses de CHAQUE agent de l'arsenal et proposer des boosts ciblés.

**Métriques 7 derniers jours** :
\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`

**Arsenal Minato (tu dois couvrir TOUS ceux actifs ou en idle)** :
${metrics.agents.map(a => `- ${a.emoji} **${a.agent}** (${a.health}) — ${a.role}${a.weakness ? ` · ⚠ ${a.weakness}` : ''}`).join('\n')}

**Ta mission** :
Propose entre 5 et 10 actions concrètes — **UNE pour chaque agent qui a une faiblesse détectée** + **2-3 globales** sur le funnel.
Chaque proposal cible UN agent spécifique (champ "target_agent") pour que Might Guy 🟢 puisse ensuite tester des variantes dessus.

Règles :
1. Actionnable dans < 24h par Mehdi ou un agent existant
2. Fort impact (2×+ sur 1 métrique de l'agent cible)
3. Créatif — penser "10× multipliers" pas incrémental
4. Prioriser agents en "degraded" ou "failing" avant "healthy"
5. Prioriser bottleneck funnel : **${metrics.funnel.weakest_step ?? 'inconnu'}**

Retourne UNIQUEMENT du JSON valide (pas de markdown) :

{
  "top_signal_of_the_week": "string - le chiffre qui t'a le plus surpris",
  "agent_health_summary": {"healthy": number, "degraded": number, "failing": number, "idle": number},
  "proposals": [
    {
      "target_agent": "shisui|rock_lee|eishi_l1|eishi_l2|leads_apollo|leads_hunter|leads_phantombuster|campaigns|might_guy|kakashi|kurama|hancock|itachi|shikamaru|global",
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
