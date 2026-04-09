// @ts-nocheck
/**
 * Feel The Gap — Regulatory Collector
 *
 * Scrape les sites gouvernementaux, WTO, ITC Trade Map et Market Access Map
 * pour collecter les reglementations, tarifs douaniers, normes et taxes
 * applicables par pays. Priorise la fraicheur (dates de publication).
 *
 * Usage:
 *   npx tsx agents/regulatory-collector.ts
 *   npx tsx agents/regulatory-collector.ts --iso CIV,SEN
 *   npx tsx agents/regulatory-collector.ts --dry-run
 */

import { supabaseAdmin } from '@/lib/supabase';
import { extractRegulationFromPage } from '@/lib/insight-extractor';

// ─── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}
const argIso = getArg('--iso')?.split(',');
const dryRun = args.includes('--dry-run');

// ─── Sources par pays ─────────────────────────────────────────────────────
// Each entry: gov site + WTO tariff profile + ITC Market Access Map
interface RegSource {
  url: string;
  source_name: string;
  source_type: 'gov' | 'wto' | 'ngo' | 'news';
  category_hint: string;
  language?: string;
}

const COUNTRY_SOURCES: Record<string, RegSource[]> = {
  CIV: [
    {
      url: 'https://www.douanes.ci/',
      source_name: 'Douanes Cote d Ivoire',
      source_type: 'gov',
      category_hint: 'customs',
    },
    {
      url: 'https://www.tresor.economie.gouv.fr/Pays/CI/reglementation',
      source_name: 'Tresor FR — Cote d Ivoire',
      source_type: 'gov',
      category_hint: 'fiscal',
    },
    {
      url: 'https://www.wto.org/english/res_e/statis_e/daily_update_e/tariff_profiles/CI_e.pdf',
      source_name: 'WTO Tariff Profile CIV',
      source_type: 'wto',
      category_hint: 'customs_tariff',
    },
  ],
  SEN: [
    {
      url: 'https://www.douanes.sn/',
      source_name: 'Douanes Senegal',
      source_type: 'gov',
      category_hint: 'customs',
    },
    {
      url: 'https://www.tresor.economie.gouv.fr/Pays/SN/reglementation',
      source_name: 'Tresor FR — Senegal',
      source_type: 'gov',
      category_hint: 'fiscal',
    },
  ],
  MAR: [
    {
      url: 'https://www.douane.gov.ma/',
      source_name: 'Administration des Douanes Maroc',
      source_type: 'gov',
      category_hint: 'customs',
    },
    {
      url: 'https://www.tresor.economie.gouv.fr/Pays/MA/reglementation',
      source_name: 'Tresor FR — Maroc',
      source_type: 'gov',
      category_hint: 'fiscal',
    },
  ],
  VNM: [
    {
      url: 'https://www.customs.gov.vn/',
      source_name: 'Vietnam General Dept of Customs',
      source_type: 'gov',
      category_hint: 'customs',
      language: 'en',
    },
    {
      url: 'https://www.tresor.economie.gouv.fr/Pays/VN/reglementation',
      source_name: 'Tresor FR — Vietnam',
      source_type: 'gov',
      category_hint: 'fiscal',
    },
  ],
  COL: [
    {
      url: 'https://www.dian.gov.co/',
      source_name: 'DIAN Colombia',
      source_type: 'gov',
      category_hint: 'customs',
      language: 'es',
    },
    {
      url: 'https://www.tresor.economie.gouv.fr/Pays/CO/reglementation',
      source_name: 'Tresor FR — Colombie',
      source_type: 'gov',
      category_hint: 'fiscal',
    },
  ],
  GIN: [
    {
      url: 'https://www.douanes.gov.gn/',
      source_name: 'Douanes Guinee',
      source_type: 'gov',
      category_hint: 'customs',
    },
  ],
};

// ─── Fetch with timeout ────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs = 30_000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeelTheGapBot/1.0)',
        'Accept-Language': 'fr,en;q=0.9',
      },
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(`    ✗ ${url}: HTTP ${res.status}`);
      return null;
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('pdf')) {
      console.warn(`    ⊘ ${url}: PDF content (skipped for now)`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`    ✗ ${url}: ${(err as Error).message}`);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const admin = supabaseAdmin();
  const isoList = argIso ?? Object.keys(COUNTRY_SOURCES);

  console.log(`[regulatory-collector] Targets: ${isoList.join(', ')}`);

  const { data: runRow } = dryRun
    ? { data: null }
    : await admin
        .from('research_runs')
        .insert({
          agent: 'regulatory-collector',
          country_iso: isoList.join(','),
          status: 'running',
          stats: { countries: isoList.length },
        })
        .select()
        .single();

  let totalInserted = 0;
  let totalErrors = 0;

  for (const iso of isoList) {
    const sources = COUNTRY_SOURCES[iso];
    if (!sources?.length) {
      console.log(`  ⊘ ${iso}: no sources defined`);
      continue;
    }

    console.log(`\n━━━ ${iso} ━━━`);
    for (const source of sources) {
      console.log(`  📄 ${source.source_name}`);
      const html = await fetchWithTimeout(source.url);
      if (!html) {
        totalErrors++;
        continue;
      }

      const extracts = await extractRegulationFromPage({
        url: source.url,
        html,
        countryIso: iso,
        language: source.language ?? 'fr',
      });

      if (!extracts || extracts.length === 0) {
        console.log(`    ⊘ no regulations extracted`);
        continue;
      }

      console.log(`    ✓ ${extracts.length} regulations extracted`);

      if (dryRun) {
        extracts.slice(0, 3).forEach((r) =>
          console.log(`      - [${r.category}] ${r.title.slice(0, 80)}`),
        );
        continue;
      }

      // Upsert to DB
      for (const reg of extracts) {
        const row = {
          country_iso: iso,
          category: reg.category,
          subcategory: reg.subcategory ?? null,
          product_hs: reg.product_hs ?? null,
          title: reg.title,
          content: reg.content,
          summary: reg.summary,
          source_url: source.url,
          source_name: source.source_name,
          source_type: source.source_type,
          published_date: reg.published_date ?? null,
          language: source.language ?? 'fr',
          tags: reg.tags ?? [],
          confidence: reg.confidence,
        };
        const { error } = await admin.from('country_regulations').insert(row);
        if (error) {
          console.warn(`    ✗ DB insert: ${error.message}`);
          totalErrors++;
        } else {
          totalInserted++;
        }
      }
    }
  }

  const stats = { inserted: totalInserted, errors: totalErrors };
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
