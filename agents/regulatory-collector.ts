// @ts-nocheck
/**
 * Feel The Gap — Regulatory Collector (LLM-native)
 *
 * Reconstruction 2026-04-09 : abandonne le scraping de sites gouvernementaux
 * fragiles (.gov.gn, .gov.ma, .douanes.ci...) au profit d'une génération
 * directe via LLM avec fallback multi-provider (Gemini → Groq → OpenAI).
 *
 * Pourquoi : la version précédente avait 0 lignes insérées car les sites
 * cibles renvoyaient des timeouts, 403 ou pages JS dynamiques illisibles.
 *
 * Couvre TOUTES les 9 catégories du schéma country_regulations :
 * customs_tariff, sanitary, technical, fiscal, labor, environment,
 * licensing, incoterms, investment.
 *
 * Usage:
 *   npx tsx agents/regulatory-collector.ts                       # tous les pays avec opportunities
 *   npx tsx agents/regulatory-collector.ts --iso CIV,SEN,MAR     # ciblé
 *   npx tsx agents/regulatory-collector.ts --all                 # 115 pays
 *   npx tsx agents/regulatory-collector.ts --iso CIV --dry-run   # test
 *   npx tsx agents/regulatory-collector.ts --refresh             # ignore dedup, regenerate
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually (tsx doesn't auto-load env files)
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

// Dynamic imports below — run AFTER loadEnv() so module-level env reads hit the correct values.
// Static imports are hoisted, which would otherwise capture placeholder env values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

// ─── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',').map(s => s.trim().toUpperCase());
const dryRun = args.includes('--dry-run');
const runAll = args.includes('--all');
const refresh = args.includes('--refresh'); // regenerate even if country has entries

// Default pilot set aligned with the enriched business plans pipeline
const DEFAULT_PILOT = ['CIV', 'SEN', 'MAR', 'VNM', 'COL', 'GIN'];

// Product hints per country — passed to the LLM so it prioritises the
// sectors we actually enrich in the business plans.
const PRODUCT_HINTS_BY_ISO: Record<string, string[]> = {
  // Original pilots (2026-04-09)
  CIV: ['cacao', 'cafe', 'anacarde', 'huile_palme'],
  SEN: ['cacao', 'textile', 'anacarde', 'mangue'],
  MAR: ['textile', 'huile_olive', 'mangue', 'cafe'],
  VNM: ['cafe', 'cacao', 'textile', 'anacarde'],
  COL: ['cafe', 'cacao', 'textile', 'huile_palme'],
  GIN: ['cacao', 'anacarde', 'mangue', 'textile'],
  // Extended producer set (2026-04-09 industrialisation phase 3)
  GHA: ['cacao', 'huile_palme', 'anacarde'],
  NGA: ['cacao', 'anacarde', 'huile_palme', 'textile'],
  BRA: ['cacao', 'cafe', 'mangue'],
  ECU: ['cacao', 'cafe', 'mangue'],
  ETH: ['cafe', 'textile'],
  IDN: ['cafe', 'huile_palme', 'cacao', 'textile'],
  HND: ['cafe', 'textile'],
  MEX: ['cafe', 'mangue', 'textile'],
  PER: ['cafe', 'cacao', 'mangue'],
  GTM: ['cafe', 'textile'],
  IND: ['textile', 'anacarde', 'mangue', 'cafe'],
  CHN: ['textile', 'mangue'],
  BGD: ['textile', 'mangue'],
  TUR: ['textile', 'mangue'],
  PAK: ['textile', 'mangue'],
  KHM: ['textile'],
  TZA: ['anacarde', 'cafe', 'cacao'],
  MOZ: ['anacarde', 'cacao'],
  BFA: ['anacarde', 'textile'],
  BEN: ['anacarde', 'huile_palme', 'textile'],
  MYS: ['huile_palme', 'textile', 'cacao'],
  THA: ['huile_palme', 'mangue', 'textile'],
  EGY: ['mangue', 'textile'],
  PHL: ['mangue', 'huile_palme'],
};

// ─── Country resolution ────────────────────────────────────────────────────
async function resolveCountries(admin: SupabaseAdmin): Promise<Array<{ iso: string; name: string; name_fr: string }>> {
  if (argIso?.length) {
    const { data } = await admin
      .from('countries')
      .select('id, name, name_fr')
      .in('id', argIso);
    return (data ?? []).map(c => ({ iso: c.id, name: c.name, name_fr: c.name_fr ?? c.name }));
  }

  if (runAll) {
    const { data } = await admin
      .from('countries')
      .select('id, name, name_fr')
      .order('id');
    return (data ?? []).map(c => ({ iso: c.id, name: c.name, name_fr: c.name_fr ?? c.name }));
  }

  // Default: pilot set
  const { data } = await admin
    .from('countries')
    .select('id, name, name_fr')
    .in('id', DEFAULT_PILOT);
  return (data ?? []).map(c => ({ iso: c.id, name: c.name, name_fr: c.name_fr ?? c.name }));
}

// ─── Dedup check ───────────────────────────────────────────────────────────
async function hasExistingRegulations(admin: SupabaseAdmin, iso: string): Promise<boolean> {
  const { count } = await admin
    .from('country_regulations')
    .select('*', { count: 'exact', head: true })
    .eq('country_iso', iso)
    .eq('is_active', true);
  return (count ?? 0) > 0;
}

// ─── WTO reference URL per category (stable, canonical fallback) ──────────
const REFERENCE_URLS: Record<string, string> = {
  customs_tariff: 'https://www.wto.org/english/tratop_e/tariffs_e/tariff_data_e.htm',
  sanitary: 'https://www.wto.org/english/tratop_e/sps_e/sps_e.htm',
  technical: 'https://www.wto.org/english/tratop_e/tbt_e/tbt_e.htm',
  fiscal: 'https://www.worldbank.org/en/topic/taxes',
  labor: 'https://www.ilo.org/global/standards/lang--en/index.htm',
  environment: 'https://unfccc.int/',
  licensing: 'https://www.wto.org/english/tratop_e/implic_e/implic_e.htm',
  incoterms: 'https://iccwbo.org/business-solutions/incoterms-rules/',
  investment: 'https://unctad.org/topic/investment/investment-policy-monitor',
};

const VALID_CATEGORIES = new Set([
  'customs_tariff',
  'sanitary',
  'technical',
  'fiscal',
  'labor',
  'environment',
  'licensing',
  'incoterms',
  'investment',
]);

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Dynamic imports AFTER loadEnv() so the supabase module captures the real env
  const { supabaseAdmin } = await import('@/lib/supabase');
  const { generateRegulationsForCountry } = await import('@/lib/insight-extractor');

  const admin = supabaseAdmin();
  const countries = await resolveCountries(admin);

  if (countries.length === 0) {
    console.log('[regulatory-collector] No countries to process');
    process.exit(0);
  }

  console.log(`[regulatory-collector] Mode: LLM-native (Gemini→Groq→OpenAI fallback)`);
  console.log(`[regulatory-collector] Targets: ${countries.map(c => c.iso).join(', ')}`);
  console.log(`[regulatory-collector] Refresh: ${refresh}, DryRun: ${dryRun}`);

  const { data: runRow } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'regulatory-collector',
          country_iso: countries.map(c => c.iso).join(','),
          status: 'running',
          stats: { countries: countries.length, mode: 'llm_native' },
        })
        .select()
        .single();

  let totalInserted = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const country of countries) {
    console.log(`\n━━━ ${country.iso} (${country.name_fr}) ━━━`);

    if (!refresh && !dryRun) {
      const exists = await hasExistingRegulations(admin, country.iso);
      if (exists) {
        console.log(`  ⊘ already has regulations — skipping (use --refresh to regenerate)`);
        totalSkipped++;
        continue;
      }
    }

    const productHints = PRODUCT_HINTS_BY_ISO[country.iso];
    if (productHints?.length) {
      console.log(`  📦 product hints: ${productHints.join(', ')}`);
    }

    const extracts = await generateRegulationsForCountry({
      countryIso: country.iso,
      countryName: country.name_fr,
      productHints,
      language: 'fr',
    });

    if (!extracts || extracts.length === 0) {
      console.warn(`  ✗ no regulations generated`);
      totalErrors++;
      continue;
    }

    console.log(`  ✓ ${extracts.length} regulations generated`);

    // Category distribution
    const byCategory: Record<string, number> = {};
    for (const r of extracts) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    console.log(`    distribution: ${Object.entries(byCategory).map(([k, v]) => `${k}:${v}`).join(', ')}`);

    if (dryRun) {
      extracts.slice(0, 3).forEach(r =>
        console.log(`      - [${r.category}] ${r.title.slice(0, 80)} (conf ${r.confidence})`),
      );
      continue;
    }

    // Normalise partial dates (YYYY, YYYY-MM) to full YYYY-MM-DD or null.
    function normaliseDate(d: string | null | undefined): string | null {
      if (!d) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`;
      if (/^\d{4}$/.test(d)) return `${d}-01-01`;
      return null;
    }

    // Insert batch — skip invalid category entries
    const rows = extracts
      .filter(r => VALID_CATEGORIES.has(r.category))
      .map(reg => ({
        country_iso: country.iso,
        category: reg.category,
        subcategory: reg.subcategory ?? null,
        product_hs: reg.product_hs ?? null,
        title: reg.title.slice(0, 200),
        content: (reg.content ?? reg.summary ?? '').slice(0, 2000),
        summary: reg.summary?.slice(0, 500) ?? null,
        source_url: REFERENCE_URLS[reg.category] ?? REFERENCE_URLS.customs_tariff,
        source_name: 'Feel The Gap AI Research (LLM-curated)',
        source_type: 'ai_extract',
        published_date: normaliseDate(reg.published_date),
        language: 'fr',
        tags: reg.tags ?? [],
        confidence: Math.max(0, Math.min(1, reg.confidence ?? 0.7)),
      }));

    const { error } = await admin.from('country_regulations').insert(rows);
    if (error) {
      console.warn(`    ✗ DB insert failed: ${error.message}`);
      totalErrors++;
    } else {
      console.log(`    ✓ ${rows.length} rows inserted`);
      totalInserted += rows.length;
    }
  }

  const stats = {
    countries_processed: countries.length,
    inserted: totalInserted,
    errors: totalErrors,
    skipped: totalSkipped,
    mode: 'llm_native',
  };
  console.log(`\n[regulatory-collector] Done: ${JSON.stringify(stats)}`);

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
  console.error('[regulatory-collector] Fatal:', err);
  process.exit(1);
});
