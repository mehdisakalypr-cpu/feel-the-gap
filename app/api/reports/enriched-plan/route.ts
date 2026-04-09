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

async function resolveProductName(slug: string): Promise<string> {
  const map: Record<string, string> = {
    cacao: 'cacao',
    cafe: 'café',
    textile: 'textile coton',
    anacarde: 'anacarde (noix de cajou)',
    huile_palme: 'huile de palme',
    mangue: 'mangue',
  };
  return map[slug] ?? slug;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  const product = url.searchParams.get('product');

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    console.log(`[api/enriched-plan] GET ${country}/${product}`);
    const plan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: await resolveProductName(product),
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
