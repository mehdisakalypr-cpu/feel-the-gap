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

// Map slug → display name + the exact title format used by batch-enriched-plans.ts
const PRODUCT_NAMES: Record<string, string> = {
  cacao: 'Cacao',
  cafe: 'Café',
  textile: 'Textile coton',
  anacarde: 'Anacarde (noix de cajou)',
  huile_palme: 'Huile de palme',
  mangue: 'Mangue',
};

function resolveProductName(slug: string): string {
  return PRODUCT_NAMES[slug] ?? slug;
}

/**
 * Look up a pre-generated plan in business_plans table.
 * Returns parsed JSON or null if not found.
 */
async function findCachedPlan(country: string, productSlug: string) {
  const admin = supabaseAdmin();
  const title = `${resolveProductName(productSlug)} — ${country}`;
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  const product = url.searchParams.get('product');
  const refresh = url.searchParams.get('refresh') === '1';

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    // 1. Serve from cache unless ?refresh=1
    if (!refresh) {
      const cached = await findCachedPlan(country, product);
      if (cached) {
        console.log(`[api/enriched-plan] GET ${country}/${product} (cached ${cached.cached_at})`);
        return NextResponse.json(
          { ...cached.plan, _cached: true, _cached_at: cached.cached_at },
          { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } },
        );
      }
    }

    // 2. Live generate (slow, ~30-60s)
    console.log(`[api/enriched-plan] GET ${country}/${product} (live generate)`);
    const plan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: resolveProductName(product),
    });

    // 3. Persist for next time (latest insert wins via order desc in findCachedPlan)
    const admin = supabaseAdmin();
    const title = `${resolveProductName(product)} — ${country}`;
    await admin.from('business_plans').insert({
      type: 'enriched_3_scenarios',
      title,
      tier_required: 'strategy',
      full_plan_html: JSON.stringify(plan, null, 2),
    });

    return NextResponse.json(plan);
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
  const { country, product, precision } = body as {
    country?: string;
    product?: string;
    precision?: Record<string, unknown>;
  };

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    console.log(`[api/enriched-plan] POST ${country}/${product} precision=${JSON.stringify(precision)}`);
    const plan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: await resolveProductName(product),
      precision: precision as Parameters<typeof buildEnrichedPlan>[0]['precision'],
    });

    // Persist to business_plans if user wants to save
    if (body.save) {
      const admin = supabaseAdmin();
      await admin.from('business_plans').insert({
        type: 'enriched_3_scenarios',
        title: `${plan.product} — ${country}`,
        tier_required: 'pro',
        full_plan_html: JSON.stringify(plan, null, 2),
      });
    }

    return NextResponse.json(plan);
  } catch (err) {
    console.error('[api/enriched-plan] error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
