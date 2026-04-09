// @ts-nocheck
/**
 * Feel The Gap — Logistics & Incoterms Collector
 *
 * Collecte les couts de fret et incoterms applicables par corridor.
 * Sources:
 *   - YouTube insights (logistics topic) agreges
 *   - Estimations LLM informees par donnees marche (WTO, freightos indices publics)
 *
 * Usage:
 *   npx tsx agents/logistics-collector.ts
 *   npx tsx agents/logistics-collector.ts --origin CIV --dest FRA
 *   npx tsx agents/logistics-collector.ts --dry-run
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argOrigin = getArg('--origin')?.split(',');
const argDest = getArg('--dest')?.split(',');
const dryRun = args.includes('--dry-run');

// ─── Config ────────────────────────────────────────────────────────────────
// Main export corridors for pilot countries
const DEFAULT_CORRIDORS: Array<{ origin: string; destinations: string[]; modes: string[] }> = [
  { origin: 'CIV', destinations: ['FRA', 'NLD', 'DEU', 'USA', 'CHN'], modes: ['sea', 'air'] },
  { origin: 'SEN', destinations: ['FRA', 'ESP', 'NLD', 'USA'], modes: ['sea', 'air'] },
  { origin: 'MAR', destinations: ['FRA', 'ESP', 'DEU', 'NLD'], modes: ['sea', 'road'] },
  { origin: 'VNM', destinations: ['USA', 'DEU', 'FRA', 'NLD'], modes: ['sea', 'air'] },
  { origin: 'COL', destinations: ['USA', 'DEU', 'NLD', 'FRA'], modes: ['sea', 'air'] },
  { origin: 'GIN', destinations: ['FRA', 'BEL', 'CHN'], modes: ['sea'] },
];

// ─── LLM estimation ────────────────────────────────────────────────────────
interface CorridorEstimate {
  container_type: string;
  incoterm: string;
  cost_usd: number;
  cost_eur: number;
  transit_days_min: number;
  transit_days_avg: number;
  transit_days_max: number;
  customs_duty_pct?: number;
  vat_pct?: number;
  notes?: string;
}

async function estimateCorridor(args: {
  origin: string;
  destination: string;
  mode: string;
  youtubeContext: string;
}): Promise<CorridorEstimate[] | null> {
  const prompt = `Tu es un expert en logistique internationale et incoterms 2020.

Estime les couts de fret et delais pour le corridor suivant:
- Origine: ${args.origin} (code ISO3)
- Destination: ${args.destination}
- Mode: ${args.mode}

Base-toi sur les tarifs publics 2026 (Freightos FBX, indices Drewry, WTO) et sur ce contexte extrait de videos YouTube recentes:
"""
${args.youtubeContext.slice(0, 8000) || '(pas de contexte YouTube disponible — utilise tes connaissances tarifs 2026)'}
"""

Pour ce corridor, genere plusieurs entrees couvrant les incoterms et types de container les plus courants (EXW, FOB, CIF, DDP pour mer; standard pour air/route).

Reponds UNIQUEMENT avec un JSON valide (tableau), aucun markdown.

Schema:
[
  {
    "container_type": "20ft" | "40ft" | "40ft HC" | "reefer 40ft" | "air LD3" | "road truck" | ...,
    "incoterm": "EXW" | "FOB" | "CIF" | "DDP" | "DAP" | ...,
    "cost_usd": 2500,
    "cost_eur": 2300,
    "transit_days_min": 14,
    "transit_days_avg": 18,
    "transit_days_max": 25,
    "customs_duty_pct": 0,
    "vat_pct": 20,
    "notes": "hors assurance et documentation"
  }
]

Donne au maximum 5 entrees. Utilise des estimations 2026 realistes. Pour ${args.mode}=sea priorise FOB+CIF; pour air priorise standard cargo; pour road priorise EXW+DAP.
`;

  // Try Gemini → Groq → OpenAI
  const providers = [
    async () => {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
        maxOutputTokens: 4000,
        providerOptions: { google: { responseMimeType: 'application/json' } },
      });
      return text;
    },
    async () => {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('no GROQ_API_KEY');
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
          temperature: 0.3,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    },
    async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('no OPENAI_API_KEY');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content ?? '';
    },
  ];

  let lastErr: unknown = null;
  for (const p of providers) {
    try {
      const raw = await p();
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      // Try to extract an array if wrapped in an object
      let parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed) {
        const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
        if (firstArray) parsed = firstArray;
      }
      if (!Array.isArray(parsed)) continue;
      return parsed as CorridorEstimate[];
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn(`[logistics] estimate failed: ${(lastErr as Error)?.message ?? 'all providers exhausted'}`);
  return null;
}

async function getYouTubeContext(
  admin: ReturnType<typeof supabaseAdmin>,
  origin: string,
): Promise<string> {
  const { data } = await admin
    .from('youtube_insights')
    .select('title, extracted_insights')
    .eq('country_iso', origin)
    .in('topic', ['logistics', 'import_export'])
    .order('view_count', { ascending: false })
    .limit(10);

  if (!data?.length) return '';
  return data
    .map((r) => {
      const ins = r.extracted_insights as Record<string, unknown> | null;
      const regs = (ins?.regulations as unknown[]) ?? [];
      const tips = (ins?.tips as string[]) ?? [];
      return `${r.title}\n${JSON.stringify({ regs, tips }).slice(0, 500)}`;
    })
    .join('\n---\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const admin = supabaseAdmin();

  const corridors = DEFAULT_CORRIDORS.filter((c) => {
    if (argOrigin && !argOrigin.includes(c.origin)) return false;
    return true;
  }).map((c) => ({
    ...c,
    destinations: argDest ?? c.destinations,
  }));

  console.log(`[logistics-collector] ${corridors.length} origins`);

  const { data: runRow } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'logistics-collector',
          country_iso: corridors.map((c) => c.origin).join(','),
          status: 'running',
        })
        .select()
        .single();

  let totalInserted = 0;
  let totalErrors = 0;

  for (const corridor of corridors) {
    const context = await getYouTubeContext(admin, corridor.origin);
    console.log(`\n━━━ ${corridor.origin} → ${corridor.destinations.join(',')} (context: ${context.length} chars) ━━━`);

    for (const dest of corridor.destinations) {
      for (const mode of corridor.modes) {
        console.log(`  ${corridor.origin}→${dest} via ${mode}`);
        const estimates = await estimateCorridor({
          origin: corridor.origin,
          destination: dest,
          mode,
          youtubeContext: context,
        });

        if (!estimates || estimates.length === 0) {
          console.log(`    ⊘ no estimates`);
          continue;
        }

        if (dryRun) {
          estimates.slice(0, 3).forEach((e) =>
            console.log(
              `    - ${e.container_type} ${e.incoterm}: $${e.cost_usd} / ${e.transit_days_avg}d`,
            ),
          );
          continue;
        }

        for (const est of estimates) {
          const row = {
            origin_iso: corridor.origin,
            destination_iso: dest,
            mode,
            container_type: est.container_type,
            incoterm: est.incoterm,
            cost_usd: est.cost_usd,
            cost_eur: est.cost_eur,
            transit_days_min: est.transit_days_min,
            transit_days_avg: est.transit_days_avg,
            transit_days_max: est.transit_days_max,
            customs_duty_pct: est.customs_duty_pct ?? null,
            vat_pct: est.vat_pct ?? null,
            notes: est.notes ?? null,
            source: 'llm_estimate_2026',
            valid_from: new Date().toISOString().slice(0, 10),
            valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          };
          const { error } = await admin
            .from('logistics_corridors')
            .upsert(row, {
              onConflict: 'origin_iso,destination_iso,mode,container_type,incoterm',
            });
          if (error) {
            console.warn(`    ✗ ${error.message}`);
            totalErrors++;
          } else {
            totalInserted++;
          }
        }
      }
    }
  }

  const stats = { inserted: totalInserted, errors: totalErrors };
  console.log(`\n[logistics-collector] Done: ${JSON.stringify(stats)}`);

  if (!dryRun && runRow?.id) {
    await admin
      .from('research_runs')
      .update({
        status: totalErrors > 0 ? 'partial' : 'success',
        stats,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runRow.id);
  }
}

main().catch((err) => {
  console.error('[logistics-collector] Fatal:', err);
  process.exit(1);
});
