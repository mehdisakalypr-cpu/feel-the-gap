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

// Dynamic imports inside main — run AFTER loadEnv() so lib/supabase captures
// the real env values instead of placeholder fallbacks.
type BuildEnrichedPlanFn = (opts: { countryIso: string; productSlug: string; productName: string; lang?: 'fr' | 'en' }) => Promise<any>;
let buildEnrichedPlan: BuildEnrichedPlanFn;
let supabaseAdmin: any;

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',');
const argProduct = getArg('--product');
const argLang = (getArg('--lang') ?? 'fr') as 'fr' | 'en';
const throttleMs = Number(getArg('--throttle-ms') ?? 0);
const force = args.includes('--force');

// Phase A scope — 30 producer pilots × 20 products × (fr, en) for the 15/05 launch.
const PILOT_COUNTRIES = [
  'CIV', 'SEN', 'MAR', 'VNM', 'COL', 'GIN',
  'GHA', 'NGA', 'ETH', 'TZA', 'MOZ', 'BFA', 'BEN', 'EGY',
  'IDN', 'IND', 'CHN', 'BGD', 'PAK', 'KHM', 'PHL', 'THA', 'MYS', 'TUR',
  'BRA', 'ECU', 'PER', 'MEX', 'HND', 'GTM',
];
const PILOT_PRODUCTS = [
  { slug: 'cacao', name: 'Cacao' },
  { slug: 'cafe', name: 'Café' },
  { slug: 'textile', name: 'Textile coton' },
  { slug: 'anacarde', name: 'Anacarde (noix de cajou)' },
  { slug: 'huile_palme', name: 'Huile de palme' },
  { slug: 'mangue', name: 'Mangue' },
  { slug: 'riz', name: 'Riz' },
  { slug: 'mais', name: 'Maïs' },
  { slug: 'ble', name: 'Blé' },
  { slug: 'sucre', name: 'Sucre (canne)' },
  { slug: 'manioc', name: 'Manioc' },
  { slug: 'the', name: 'Thé' },
  { slug: 'vanille', name: 'Vanille' },
  { slug: 'gingembre', name: 'Gingembre' },
  { slug: 'poivre', name: 'Poivre' },
  { slug: 'karite', name: 'Beurre de karité' },
  { slug: 'caoutchouc', name: 'Caoutchouc naturel' },
  { slug: 'ananas', name: 'Ananas' },
  { slug: 'banane', name: 'Banane' },
  { slug: 'avocat', name: 'Avocat' },
];

async function main() {
  // Dynamic imports AFTER loadEnv() so the supabase module captures the real env
  ({ buildEnrichedPlan } = await import('./enriched-plan-builder'));
  ({ supabaseAdmin } = await import('@/lib/supabase'));

  const admin = supabaseAdmin();
  const isoList = argIso ?? PILOT_COUNTRIES;
  const products = argProduct
    ? PILOT_PRODUCTS.filter((p) => p.slug === argProduct)
    : PILOT_PRODUCTS;

  const pairs: Array<{ iso: string; product: typeof PILOT_PRODUCTS[number] }> = [];
  for (const iso of isoList) for (const p of products) pairs.push({ iso, product: p });

  console.log(`[batch-enriched-plans] ${pairs.length} pairs to process · lang=${argLang} · throttle=${throttleMs}ms`);

  const runRow = await admin
    .from('research_runs')
    .insert({
      agent: 'batch-enriched-plans',
      country_iso: isoList.join(','),
      product: argProduct ?? 'all',
      status: 'running',
      stats: { pairs: pairs.length, lang: argLang, throttle_ms: throttleMs },
    })
    .select()
    .single();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const startedAt = Date.now();

  for (const { iso, product } of pairs) {
    // Title carries the language so fr and en rows coexist in business_plans.
    const title = `${product.name} — ${iso} · ${argLang}`;
    console.log(`\n━━━ ${iso} / ${product.slug} / ${argLang} ━━━`);

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
      // Lookup the matching opportunity FIRST. Without an opportunity_id, the BP
      // becomes orphan (the bug that produced 21k orphan BPs in 04/2026).
      // Match by (country_iso, product_id ILIKE '%slug%' OR product_id ILIKE '%name%').
      const { data: opps, error: oppErr } = await admin
        .from('opportunities')
        .select('id, product_id, opportunity_score')
        .eq('country_iso', iso)
        .or(`product_id.ilike.%${product.slug}%,product_id.ilike.%${product.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}%`)
        .order('opportunity_score', { ascending: false })
        .limit(1);
      if (oppErr || !opps || opps.length === 0) {
        console.warn(`  ⊘ no opportunity found for ${iso}/${product.slug} — skip (would create orphan)`);
        skipped++;
        continue;
      }
      const opportunityId = opps[0].id;

      const plan = await buildEnrichedPlan({
        countryIso: iso,
        productSlug: product.slug,
        productName: product.name,
        lang: argLang,
      });

      const { error } = await admin.from('business_plans').insert({
        opportunity_id: opportunityId,
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
          `  ✓ inserted (opp=${opportunityId.slice(0,8)}..) — capex≈${plan.scenarios?.mechanized?.capex_eur ?? '?'}€, recommended=${plan.scenarios_comparison?.recommended_scenario ?? '?'}`,
        );
      }
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`);
      errors++;
    }

    if (throttleMs > 0) {
      await new Promise((r) => setTimeout(r, throttleMs));
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
