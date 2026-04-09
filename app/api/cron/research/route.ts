import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 300;

interface AgentRunResult {
  agent: string;
  exit_code: number;
  duration_ms: number;
}

function runAgentScript(scriptRelPath: string, args: string[] = []): Promise<AgentRunResult> {
  const agent = scriptRelPath.replace('agents/', '').replace('.ts', '');
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const full = path.resolve(process.cwd(), scriptRelPath);
    const child = spawn('npx', ['tsx', full, ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      resolve({ agent, exit_code: code ?? 1, duration_ms: Date.now() - startedAt });
    });
    child.on('error', () => {
      resolve({ agent, exit_code: 1, duration_ms: Date.now() - startedAt });
    });
  });
}

/**
 * GET /api/cron/research
 *
 * Scheduled daily by Vercel Cron. Runs the research orchestrator which:
 *   1. youtube-intel        (refreshed every 60 days)
 *   2. regulatory-collector (refreshed every 30 days — priority on freshness)
 *   3. production-costs     (refreshed every 90 days)
 *   4. logistics-collector  (refreshed every 30 days — volatile)
 *
 * The orchestrator handles its own throttling based on research_runs history.
 * Pass ?agent=youtube-intel to force a specific agent.
 * Pass ?iso=CIV,SEN to restrict to specific countries.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const onlyAgent = url.searchParams.get('agent');
  const iso = url.searchParams.get('iso');

  const orchArgs: string[] = [];
  if (onlyAgent) orchArgs.push('--only', onlyAgent);
  if (iso) orchArgs.push('--iso', iso);

  console.log(`[cron/research] start agent=${onlyAgent ?? 'all'} iso=${iso ?? 'all'}`);

  try {
    const result = await runAgentScript('agents/research-orchestrator.ts', orchArgs);
    console.log(`[cron/research] done agent=${result.agent} exit=${result.exit_code} duration_ms=${result.duration_ms}`);
    return NextResponse.json({
      ok: result.exit_code === 0,
      result,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[cron/research] fatal: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, ts: new Date().toISOString() }, { status: 500 });
  }
}
