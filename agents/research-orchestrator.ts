// @ts-nocheck
/**
 * Feel The Gap — Research Orchestrator
 *
 * Planifie et enchaine tous les agents de recherche dans le bon ordre:
 *   1. youtube-intel       (source de verite terrain)
 *   2. regulatory-collector (priorise fraicheur)
 *   3. production-costs    (depend de youtube-intel)
 *   4. logistics-collector (depend de youtube-intel)
 *
 * Applique une strategie de rafraichissement:
 *   - Reglementaire: tous les 30 jours (alerte si > 6 mois)
 *   - YouTube: tous les 60 jours
 *   - Couts: tous les 90 jours
 *   - Logistique: tous les 30 jours (volatil)
 *
 * Usage:
 *   npx tsx agents/research-orchestrator.ts                 # tous les agents
 *   npx tsx agents/research-orchestrator.ts --only youtube  # un seul agent
 *   npx tsx agents/research-orchestrator.ts --iso CIV       # un pays
 *   npx tsx agents/research-orchestrator.ts --dry-run
 */

import { spawn } from 'child_process';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const onlyAgent = getArg('--only');
const argIso = getArg('--iso');
const dryRun = args.includes('--dry-run');

const AGENTS_ROOT = path.resolve(process.cwd(), 'agents');

// ─── Refresh thresholds (in days) ──────────────────────────────────────────
const REFRESH_THRESHOLDS = {
  'youtube-intel': 60,
  'regulatory-collector': 30,
  'production-costs': 90,
  'logistics-collector': 30,
};

// ─── Check last run per agent ──────────────────────────────────────────────
async function getLastSuccessfulRun(
  admin: ReturnType<typeof supabaseAdmin>,
  agent: string,
): Promise<Date | null> {
  const { data } = await admin
    .from('research_runs')
    .select('finished_at')
    .eq('agent', agent)
    .in('status', ['success', 'partial'])
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.finished_at ? new Date(data.finished_at) : null;
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

// ─── Spawn agent subprocess ────────────────────────────────────────────────
function runAgent(agentFile: string, extraArgs: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const full = path.join(AGENTS_ROOT, agentFile);
    console.log(`\n▶ ${agentFile} ${extraArgs.join(' ')}`);
    const child = spawn('npx', ['tsx', full, ...extraArgs], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`spawn error: ${err.message}`);
      resolve(1);
    });
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const admin = supabaseAdmin();
  const sharedArgs: string[] = [];
  if (argIso) sharedArgs.push('--iso', argIso);
  if (dryRun) sharedArgs.push('--dry-run');

  console.log(`[orchestrator] Starting — args: ${sharedArgs.join(' ') || '(none)'}`);

  // Order matters: youtube first, then others can depend on it
  const agents: Array<{ key: keyof typeof REFRESH_THRESHOLDS; file: string }> = [
    { key: 'youtube-intel', file: 'youtube-intel.ts' },
    { key: 'regulatory-collector', file: 'regulatory-collector.ts' },
    { key: 'production-costs', file: 'production-costs.ts' },
    { key: 'logistics-collector', file: 'logistics-collector.ts' },
  ];

  const filtered = onlyAgent
    ? agents.filter((a) => a.key === onlyAgent || a.file.startsWith(onlyAgent))
    : agents;

  if (filtered.length === 0) {
    console.error(`[orchestrator] Unknown agent: ${onlyAgent}`);
    process.exit(1);
  }

  const { data: orchestratorRun } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'orchestrator',
          country_iso: argIso ?? null,
          status: 'running',
        })
        .select()
        .single();

  const results: Record<string, { skipped?: boolean; exit_code?: number; last_run_days?: number }> = {};

  for (const agent of filtered) {
    const lastRun = await getLastSuccessfulRun(admin, agent.key);
    const daysAgo = lastRun ? daysSince(lastRun) : Infinity;
    const threshold = REFRESH_THRESHOLDS[agent.key];

    if (!onlyAgent && daysAgo < threshold) {
      console.log(`\n⊘ ${agent.key}: last run ${daysAgo.toFixed(1)}d ago < ${threshold}d threshold — skipping`);
      results[agent.key] = { skipped: true, last_run_days: daysAgo };
      continue;
    }

    const exitCode = await runAgent(agent.file, sharedArgs);
    results[agent.key] = { exit_code: exitCode, last_run_days: daysAgo };

    if (exitCode !== 0 && agent.key === 'youtube-intel') {
      console.warn('[orchestrator] youtube-intel failed — downstream agents may have no data');
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[orchestrator] Summary:');
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k}: ${JSON.stringify(v)}`);
  }

  if (!dryRun && orchestratorRun?.id) {
    const anyFailed = Object.values(results).some((r) => r.exit_code && r.exit_code !== 0);
    await admin
      .from('research_runs')
      .update({
        status: anyFailed ? 'partial' : 'success',
        stats: results,
        finished_at: new Date().toISOString(),
      })
      .eq('id', orchestratorRun.id);
  }
}

main().catch((err) => {
  console.error('[orchestrator] Fatal:', err);
  process.exit(1);
});
