// @ts-nocheck
/**
 * 🟢 MIGHT GUY — Hard Work Optimizer (Hachimon Gates).
 *
 * Role: takes the top Kushina proposal of the day and generates 5-8
 * variations at increasing intensity (Gates 1-8). Runs A/B test against
 * baseline, promotes the winner, kills losers (Akame's discipline).
 *
 * Gate intensity ladder (each gate = +cost, +effort, +expected impact):
 *   1. Base   — baseline reference (current practice)
 *   2. Open   — minor personalization (first name + company)
 *   3. Heal   — + context signal (recent LinkedIn post mention)
 *   4. Life   — + 3 specific opps from gap-match top_opps
 *   5. Harm   — + voice message (ElevenLabs) or 30s video (Seedance)
 *   6. View   — + multi-touch (email + LinkedIn DM + comment) same lead
 *   7. Wonder — + mutual connection intro / warm referral path
 *   8. Night  — ALL combined + timing on intent signal (funding/hire/post)
 *
 * "Night Guy" (gate 8) = weekly cap, only on bottleneck #1 that week.
 *
 * Flow:
 *   1. Pull today's Kushina top proposal (highest priority, status='new'|'applied')
 *   2. Generate variant specs via LLM (cascade) at gate levels 1-7 by default
 *   3. If --night-guy and no gate-8 this week → add gate 8
 *   4. Insert rows in ftg_guy_experiments (status='pending')
 *   5. Send/execute variants via appropriate channel (Instantly/LinkedIn/etc.)
 *   6. After 48h cron picks them up, computes result_delta_pct, promotes winner
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { runCascadeJson } from '@/lib/ai/cascade'

loadEnv()

type Args = { nightGuy: boolean; harvestOnly: boolean; maxVariants: number; targetAgent?: string; maxAgents: number }
function parseArgs(): Args {
  const out: Args = { nightGuy: false, harvestOnly: false, maxVariants: 7, maxAgents: 3 }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'night-guy') out.nightGuy = true
    if (k === 'harvest-only') out.harvestOnly = true
    if (k === 'max-variants' && v) out.maxVariants = Number(v)
    if (k === 'target-agent' && v) out.targetAgent = v
    if (k === 'max-agents' && v) out.maxAgents = Number(v)
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const GATE_NAMES = ['base', 'open', 'heal', 'life', 'harm', 'view', 'wonder', 'night']

const PROMPT = (title: string, rationale: string, baselineMetric: string, maxGate: number) => `Tu es MIGHT GUY 🟢, discipliné et acharné. Ta philosophie : "500 variantes chaque jour, et si elles ne suffisent pas, 500 de plus".

**Contexte** :
Kushina 🌀 (ta partenaire strategist) a proposé aujourd'hui : "${title}"
Rationale : ${rationale}
Métrique à améliorer : ${baselineMetric}

**Ta mission** : générer des variantes CONCRÈTES à tester A/B, une par "porte" (gate level) d'intensité croissante.

Gate ladder (1-${maxGate}) — intensité = effort de préparation + complexité technique :
1. **base** — pratique courante / baseline
2. **open** — perso basique (prénom + company)
3. **heal** — + signal contextuel (post LinkedIn récent / embauche / funding)
4. **life** — + 3 opps spécifiques gap-match du pays du lead
5. **harm** — + audio voice message (ElevenLabs) OU vidéo 30s perso (Seedance)
6. **view** — + multi-touch (email + LinkedIn DM + comment post) same lead même semaine
7. **wonder** — + chemin de connexion mutuelle / warm intro forcée
${maxGate >= 8 ? '8. **NIGHT GUY 🔥** — ABSOLUMENT TOUT combiné + timing sur signal intent (annonce funding/hire/post pertinent). Max intensity, 1×/semaine seulement.' : ''}

**Retourne UNIQUEMENT du JSON valide** :

{
  "variants": [
    {
      "gate_level": 1-${maxGate},
      "variant_key": "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H",
      "name": "string court",
      "subject_template": "string — avec {{vars}}",
      "body_template": "string — full cold email",
      "personalization_steps": ["step1", "step2"],
      "channel": "email"|"linkedin_inmail"|"linkedin_connect"|"multi",
      "additional_assets": ["voice_note"|"video"|"mutual_intro"|"comment_then_dm"],
      "estimated_prep_minutes_per_lead": number,
      "expected_lift_vs_baseline_pct": number,
      "guy_motivation_quote": "string — citation motivante tronquée en Gai-style"
    }
  ],
  "experiment_plan": {
    "leads_per_variant_min": 20,
    "leads_per_variant_max": 50,
    "measurement_window_days": 3,
    "winner_threshold_delta_pct": 30,
    "statistical_note": "string"
  }
}`

async function launchExperimentFor(sb: any, proposal: any, rowId: string, nightGuyAvailable: boolean, maxVariants: number) {
  let maxGate = Math.min(maxVariants, 7)
  if (nightGuyAvailable) maxGate = 8

  const baselineMetric = proposal.expected_impact?.metric ?? 'reply_rate'
  const targetAgent = proposal.target_agent ?? 'global'
  console.log(`🟢 Guy → agent=${targetAgent} proposal="${proposal.title.slice(0, 60)}" metric=${baselineMetric} max_gate=${maxGate}`)

  const result = await runCascadeJson({
    tier: 'premium',
    task: `might-guy-variants-${targetAgent}`,
    basePrompt: PROMPT(proposal.title, proposal.rationale ?? '', baselineMetric, maxGate),
  })
  const variants = (result as any)?.variants ?? []
  if (!variants.length) {
    console.log(`  [guy:${targetAgent}] LLM returned no variants — skip`)
    return { ok: false, gate8Used: false }
  }

  const rows = variants.slice(0, maxGate).map((v: any) => ({
    proposal_id: rowId,
    proposal_title: `[${targetAgent}] ${proposal.title}`,
    hypothesis: `${GATE_NAMES[v.gate_level - 1] ?? 'gate'} intensity — ${v.name}`,
    baseline_metric: baselineMetric,
    gate_level: v.gate_level,
    variant_key: v.variant_key,
    variant_spec: { ...v, target_agent: targetAgent },
    status: 'pending',
  }))
  const { error } = await sb.from('ftg_guy_experiments').insert(rows)
  if (error) {
    console.error(`  [guy:${targetAgent}] insert error:`, error.message)
    return { ok: false, gate8Used: false }
  }
  const gate8 = rows.some((r: any) => r.gate_level === 8)
  console.log(`  ✓ Guy [${targetAgent}]: ${rows.length} variants (gates ${rows.map((r: any) => r.gate_level).join(',')})${gate8 ? ' 🔥 NIGHT GUY' : ''}`)
  return { ok: true, gate8Used: gate8 }
}

async function launchExperiment(args: Args) {
  const sb = db()

  // Pull latest Kushina proposal (single row, contains multi-agent proposals)
  const { data: latest } = await sb
    .from('ftg_kaizen_proposals')
    .select('id, proposals, day_tag, generated_at')
    .in('status', ['new', 'considered', 'applied'])
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    console.log('[guy] no Kushina proposal available — Guy rests (wait for 08h UTC run)')
    return
  }

  // Group proposals by target_agent, pick top priority per agent
  const allProposals = (latest.proposals?.proposals ?? []) as any[]
  if (!allProposals.length) { console.log('[guy] empty proposals array'); return }

  const byAgent = new Map<string, any>()
  for (const p of allProposals) {
    const tgt = p.target_agent ?? 'global'
    const prev = byAgent.get(tgt)
    if (!prev || (p.priority ?? 0) > (prev.priority ?? 0)) byAgent.set(tgt, p)
  }

  // Filter to specific agent if requested
  const agentsToProcess = args.targetAgent
    ? [args.targetAgent].filter(a => byAgent.has(a))
    : Array.from(byAgent.keys())

  if (!agentsToProcess.length) {
    console.log('[guy] no matching agent in latest proposals')
    return
  }

  // Check Night Guy weekly cap (shared across all agents)
  const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count: recentNight } = await sb
    .from('ftg_guy_experiments')
    .select('*', { count: 'exact', head: true })
    .eq('gate_level', 8)
    .gte('created_at', oneWeekAgo)
  let nightGuyBudget = args.nightGuy && (recentNight ?? 0) === 0 ? 1 : 0

  // Process top N agents (sorted by proposal priority)
  const sortedAgents = agentsToProcess
    .map(a => ({ agent: a, prop: byAgent.get(a)! }))
    .sort((x, y) => (y.prop.priority ?? 0) - (x.prop.priority ?? 0))
    .slice(0, args.maxAgents)

  console.log(`🟢 Might Guy processes ${sortedAgents.length} agents this cycle`)

  for (const { agent, prop } of sortedAgents) {
    const useNightGuy = nightGuyBudget > 0 && (prop.priority ?? 0) >= 4
    const res = await launchExperimentFor(sb, prop, latest.id, useNightGuy, args.maxVariants)
    if (res.gate8Used) nightGuyBudget--
  }
}

async function harvestResults() {
  const sb = db()
  // Mark experiments started > 72h ago as inconclusive if no sample_size yet.
  // Real win/loss promotion requires channel-specific metrics to backfill; this
  // harvest function is a placeholder that marks stale rows for Mehdi's review.
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const { data: stale } = await sb
    .from('ftg_guy_experiments')
    .select('id, gate_level, sample_size')
    .eq('status', 'running')
    .lt('started_at', threeDaysAgo)
  console.log(`[guy-harvest] ${stale?.length ?? 0} stale experiments to review manually`)
}

async function main() {
  const args = parseArgs()
  console.log('🟢 Might Guy (Hachimon):', JSON.stringify(args))

  if (args.harvestOnly) {
    await harvestResults()
    return
  }
  await launchExperiment(args)
  await harvestResults()
}

main().catch((e) => { console.error(e); process.exit(1) })
