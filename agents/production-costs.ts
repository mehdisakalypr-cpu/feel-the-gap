// @ts-nocheck
/**
 * Feel The Gap — Production Cost Collector
 *
 * Pour chaque (pays, produit), collecte les couts de production attendus
 * selon 3 scenarios (artisanal, mechanized, ai_automated) et 3 tiers qualite
 * (entry, mid, premium). Combine:
 *   - sources publiques (Numbeo, ILO, FAO, Eurostat)
 *   - insights YouTube deja extraits dans la table youtube_insights
 *   - generation LLM informee par les donnees agregees
 *
 * Usage:
 *   npx tsx agents/production-costs.ts
 *   npx tsx agents/production-costs.ts --iso CIV --product cacao
 *   npx tsx agents/production-costs.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually (tsx doesn't auto-load env files).
// MUST run before any module that captures process.env at load time.
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// Dynamic imports below (inside main) — run AFTER loadEnv() so module-level
// env reads in lib/supabase.ts hit the correct values instead of placeholders.
type SupabaseAdmin = any;

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',');
const argProduct = getArg('--product');
const dryRun = args.includes('--dry-run');

// ─── Config ────────────────────────────────────────────────────────────────
const PILOT_COUNTRIES = ['CIV', 'SEN', 'MAR', 'VNM', 'COL', 'GIN'];
const PILOT_PRODUCTS = [
  { slug: 'cacao', sector: 'agriculture', fr: 'cacao' },
  { slug: 'cafe', sector: 'agriculture', fr: 'cafe' },
  { slug: 'textile', sector: 'manufacturing', fr: 'textile coton' },
  { slug: 'anacarde', sector: 'agriculture', fr: 'anacarde noix cajou' },
  { slug: 'huile_palme', sector: 'agriculture', fr: 'huile de palme' },
  { slug: 'mangue', sector: 'agriculture', fr: 'mangue' },
];

// ─── Aggregation: join YouTube insights → text corpus for LLM ────────────
async function buildCorpusFromInsights(
  admin: SupabaseAdmin,
  countryIso: string,
  productSlug: string,
): Promise<string> {
  const { data: insights } = await admin
    .from('youtube_insights')
    .select('title, description, extracted_insights, view_count')
    .eq('country_iso', countryIso)
    .eq('product_category', productSlug)
    .order('view_count', { ascending: false })
    .limit(15);

  if (!insights || insights.length === 0) return '';

  const lines: string[] = [];
  for (const row of insights) {
    lines.push(`Video: ${row.title}`);
    if (row.description) lines.push(`Desc: ${row.description.slice(0, 400)}`);
    const ins = row.extracted_insights as Record<string, unknown> | null;
    if (ins) {
      const prices = ins.prices as Array<Record<string, unknown>> | undefined;
      const costs = ins.costs as Array<Record<string, unknown>> | undefined;
      const facts = ins.key_facts as string[] | undefined;
      if (prices?.length) lines.push(`Prix: ${JSON.stringify(prices)}`);
      if (costs?.length) lines.push(`Couts: ${JSON.stringify(costs)}`);
      if (facts?.length) lines.push(`Faits: ${facts.join(' | ')}`);
    }
    lines.push('---');
  }
  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Dynamic imports after loadEnv() so lib/supabase captures the real env values
  const { supabaseAdmin } = await import('@/lib/supabase');
  const { extractCostBenchmarks } = await import('@/lib/insight-extractor');

  const admin = supabaseAdmin();
  const isoList = argIso ?? PILOT_COUNTRIES;
  const products = argProduct
    ? PILOT_PRODUCTS.filter((p) => p.slug === argProduct)
    : PILOT_PRODUCTS;

  console.log(`[production-costs] ${isoList.length} countries x ${products.length} products`);

  const { data: runRow } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'production-costs',
          country_iso: isoList.join(','),
          product: argProduct ?? 'all',
          status: 'running',
        })
        .select()
        .single();

  const ALLOWED_COST_TYPES = new Set([
    'land_m2',
    'land_hectare',
    'labor_hour',
    'labor_month',
    'labor_density',
    'machine_capex',
    'machine_opex',
    'energy_kwh',
    'water_m3',
    'raw_material',
    'certification',
    'rent_m2',
    'permit',
  ]);
  const ALLOWED_SCENARIOS = new Set(['artisanal', 'mechanized', 'ai_automated']);
  const ALLOWED_QUALITY = new Set(['entry', 'mid', 'premium']);

  let totalInserted = 0;
  let totalErrors = 0;
  let totalSkippedNoCorpus = 0;
  let totalFiltered = 0;

  for (const iso of isoList) {
    for (const product of products) {
      console.log(`\n━━━ ${iso} / ${product.slug} ━━━`);

      // Build corpus from YouTube insights (optional — LLM can still estimate from knowledge)
      const corpus = await buildCorpusFromInsights(admin, iso, product.slug);
      if (!corpus) {
        console.log(`  ⊘ no YouTube corpus — generating from LLM knowledge only`);
        totalSkippedNoCorpus++;
      } else {
        console.log(`  📊 corpus: ${corpus.length} chars`);
      }

      const benchmarks = await extractCostBenchmarks({
        sourceText: corpus,
        countryIso: iso,
        product: product.fr,
        sector: product.sector,
      });

      if (!benchmarks || benchmarks.length === 0) {
        console.log(`  ⊘ no benchmarks extracted`);
        continue;
      }
      console.log(`  ✓ ${benchmarks.length} benchmarks`);

      if (dryRun) {
        benchmarks.slice(0, 5).forEach((b) =>
          console.log(
            `    - ${b.scenario} ${b.cost_type}: ${b.value_avg} ${b.unit} (conf=${b.confidence})`,
          ),
        );
        continue;
      }

      for (const b of benchmarks) {
        if (!ALLOWED_COST_TYPES.has(b.cost_type) || !ALLOWED_SCENARIOS.has(b.scenario)) {
          totalFiltered++;
          continue;
        }
        const row = {
          country_iso: iso,
          sector: product.sector,
          product: product.slug,
          cost_type: b.cost_type,
          scenario: b.scenario,
          quality_tier: b.quality_tier && ALLOWED_QUALITY.has(b.quality_tier) ? b.quality_tier : null,
          value_min: b.value_min ?? null,
          value_avg: b.value_avg,
          value_max: b.value_max ?? null,
          currency: b.currency ?? 'EUR',
          unit: b.unit,
          assumptions: b.assumptions ?? {},
          source: 'youtube_aggregation',
          source_year: new Date().getFullYear(),
          confidence: b.confidence ?? 0.6,
        };
        const { error } = await admin.from('production_cost_benchmarks').insert(row);
        if (error) {
          console.warn(`    ✗ DB: ${error.message}`);
          totalErrors++;
        } else {
          totalInserted++;
        }
      }
    }
  }

  const stats = {
    inserted: totalInserted,
    errors: totalErrors,
    skipped_no_corpus: totalSkippedNoCorpus,
    filtered_invalid_enum: totalFiltered,
  };
  console.log(`\n[production-costs] Done: ${JSON.stringify(stats)}`);

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
  console.error('[production-costs] Fatal:', err);
  process.exit(1);
});
