// @ts-nocheck
/**
 * Feel The Gap — Batch Enriched Plan Generator
 *
 * Generates enriched business plans (3 scenarios) for all (country, product)
 * pairs of the pilot set, persists them in `business_plans` with type
 * 'enriched_3_scenarios'.
 *
 * Usage:
 *   npx tsx agents/batch-enriched-plans.ts
 *   npx tsx agents/batch-enriched-plans.ts --iso CIV,SEN
 *   npx tsx agents/batch-enriched-plans.ts --product cacao
 *   npx tsx agents/batch-enriched-plans.ts --force        # overwrite existing
 */

import { buildEnrichedPlan } from './enriched-plan-builder';
import { supabaseAdmin } from '@/lib/supabase';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',');
const argProduct = getArg('--product');
const force = args.includes('--force');

const PILOT_COUNTRIES = ['CIV', 'SEN', 'MAR', 'VNM', 'COL', 'GIN'];
const PILOT_PRODUCTS = [
  { slug: 'cacao', name: 'Cacao' },
  { slug: 'cafe', name: 'Café' },
  { slug: 'textile', name: 'Textile coton' },
  { slug: 'anacarde', name: 'Anacarde (noix de cajou)' },
  { slug: 'huile_palme', name: 'Huile de palme' },
  { slug: 'mangue', name: 'Mangue' },
];

async function main() {
  const admin = supabaseAdmin();
  const isoList = argIso ?? PILOT_COUNTRIES;
  const products = argProduct
    ? PILOT_PRODUCTS.filter((p) => p.slug === argProduct)
    : PILOT_PRODUCTS;

  const pairs: Array<{ iso: string; product: typeof PILOT_PRODUCTS[number] }> = [];
  for (const iso of isoList) for (const p of products) pairs.push({ iso, product: p });

  console.log(`[batch-enriched-plans] ${pairs.length} pairs to process`);

  const runRow = await admin
    .from('research_runs')
    .insert({
      agent: 'batch-enriched-plans',
      country_iso: isoList.join(','),
      product: argProduct ?? 'all',
      status: 'running',
      stats: { pairs: pairs.length },
    })
    .select()
    .single();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const startedAt = Date.now();

  for (const { iso, product } of pairs) {
    const title = `${product.name} — ${iso}`;
    console.log(`\n━━━ ${iso} / ${product.slug} ━━━`);

    if (!force) {
      const { data: existing } = await admin
        .from('business_plans')
        .select('id')
        .eq('type', 'enriched_3_scenarios')
        .eq('title', title)
        .maybeSingle();
      if (existing) {
        console.log(`  ⊘ already exists (${existing.id}) — skip`);
        skipped++;
        continue;
      }
    }

    try {
      const plan = await buildEnrichedPlan({
        countryIso: iso,
        productSlug: product.slug,
        productName: product.name,
      });

      const { error } = await admin.from('business_plans').insert({
        type: 'enriched_3_scenarios',
        title,
        tier_required: 'strategy',
        full_plan_html: JSON.stringify(plan, null, 2),
      });

      if (error) {
        console.warn(`  ✗ DB insert: ${error.message}`);
        errors++;
      } else {
        inserted++;
        console.log(
          `  ✓ inserted — capex≈${plan.scenarios?.mechanized?.capex_eur ?? '?'}€, recommended=${plan.scenarios_comparison?.recommended_scenario ?? '?'}`,
        );
      }
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
      errors++;
    }
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  const stats = { inserted, skipped, errors, total_pairs: pairs.length, elapsed_sec: elapsed };
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[batch-enriched-plans] Done: ${JSON.stringify(stats)}`);

  if (runRow.data?.id) {
    await admin
      .from('research_runs')
      .update({
        status: errors > 0 ? 'partial' : 'success',
        stats,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runRow.data.id);
  }
}

main().catch((err) => {
  console.error('[batch-enriched-plans] Fatal:', err);
  process.exit(1);
});
