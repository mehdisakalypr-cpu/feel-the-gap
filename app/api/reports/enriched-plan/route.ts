import { NextRequest, NextResponse } from 'next/server';
import { buildEnrichedPlan } from '@/agents/enriched-plan-builder';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300;

/**
 * GET /api/reports/enriched-plan?country=CIV&product=cacao
 * POST /api/reports/enriched-plan  { country, product, precision: {...} }
 *
 * Generates an enriched business plan with 3 scenarios (artisanal / mechanized / ai_automated)
 * pulled from the research tables (country_regulations, youtube_insights, production_cost_benchmarks,
 * logistics_corridors).
 */

// Map slug → display name per language + the exact title format used by batch-enriched-plans.ts
const PRODUCT_NAMES: Record<'fr' | 'en', Record<string, string>> = {
  fr: {
    cacao: 'Cacao',
    cafe: 'Café',
    textile: 'Textile coton',
    anacarde: 'Anacarde (noix de cajou)',
    huile_palme: 'Huile de palme',
    mangue: 'Mangue',
  },
  en: {
    cacao: 'Cocoa',
    cafe: 'Coffee',
    textile: 'Cotton textile',
    anacarde: 'Cashew',
    huile_palme: 'Palm oil',
    mangue: 'Mango',
  },
};

function resolveProductName(slug: string, lang: 'fr' | 'en' = 'fr'): string {
  return PRODUCT_NAMES[lang][slug] ?? slug;
}

/**
 * Title key used for the business_plans cache row.
 * FR (default / legacy) keeps the original title format.
 * EN gets a [en] suffix so both languages coexist.
 */
function cacheTitle(country: string, productSlug: string, lang: 'fr' | 'en'): string {
  const base = `${resolveProductName(productSlug, lang)} — ${country}`;
  return lang === 'en' ? `${base} [en]` : base;
}

/**
 * Look up a pre-generated plan in business_plans table.
 * Returns parsed JSON or null if not found.
 */
async function findCachedPlan(country: string, productSlug: string, lang: 'fr' | 'en') {
  const admin = supabaseAdmin();
  const title = cacheTitle(country, productSlug, lang);
  const { data } = await admin
    .from('business_plans')
    .select('full_plan_html, created_at')
    .eq('type', 'enriched_3_scenarios')
    .eq('title', title)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.full_plan_html) return null;
  try {
    return { plan: JSON.parse(data.full_plan_html), cached_at: data.created_at };
  } catch {
    return null;
  }
}

function parseLang(value: string | null): 'fr' | 'en' {
  return value === 'en' ? 'en' : 'fr';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  const product = url.searchParams.get('product');
  const lang = parseLang(url.searchParams.get('lang'));
  const refresh = url.searchParams.get('refresh') === '1';

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    // 1. Serve from cache unless ?refresh=1
    if (!refresh) {
      const cached = await findCachedPlan(country, product, lang);
      if (cached) {
        console.log(`[api/enriched-plan] GET ${country}/${product} lang=${lang} (cached ${cached.cached_at})`);
        return NextResponse.json(
          { ...cached.plan, _cached: true, _cached_at: cached.cached_at, _lang: lang },
          { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } },
        );
      }
    }

    // 2. Live generate (slow, ~30-60s)
    console.log(`[api/enriched-plan] GET ${country}/${product} lang=${lang} (live generate)`);
    const plan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: resolveProductName(product, lang),
      lang,
    });

    // 3. Persist for next time
    const admin = supabaseAdmin();
    await admin.from('business_plans').insert({
      type: 'enriched_3_scenarios',
      title: cacheTitle(country, product, lang),
      tier_required: 'strategy',
      full_plan_html: JSON.stringify(plan, null, 2),
    });

    return NextResponse.json({ ...plan, _lang: lang });
  } catch (err) {
    console.error('[api/enriched-plan] error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { country, product, precision, lang: bodyLang } = body as {
    country?: string;
    product?: string;
    precision?: Record<string, unknown>;
    lang?: string;
  };
  const lang = parseLang(bodyLang ?? null);

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    console.log(`[api/enriched-plan] POST ${country}/${product} lang=${lang} precision=${JSON.stringify(precision)}`);
    const plan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: resolveProductName(product, lang),
      precision: precision as Parameters<typeof buildEnrichedPlan>[0]['precision'],
      lang,
    });

    // Persist to business_plans if user wants to save
    if (body.save) {
      const admin = supabaseAdmin();
      await admin.from('business_plans').insert({
        type: 'enriched_3_scenarios',
        title: cacheTitle(country, product, lang),
        tier_required: 'strategy',
        full_plan_html: JSON.stringify(plan, null, 2),
      });
    }

    return NextResponse.json({ ...plan, _lang: lang });
  } catch (err) {
    console.error('[api/enriched-plan] error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
