import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { buildEnrichedPlan } from '@/agents/enriched-plan-builder';
import { supabaseAdmin } from '@/lib/supabase';
import { gen, initProviders } from '@/agents/providers';

export const maxDuration = 300;

/**
 * GET /api/reports/enriched-plan?country=CIV&product=cacao
 * POST /api/reports/enriched-plan  { country, product, precision: {...} }
 *
 * Generates an enriched business plan with 3 scenarios (artisanal / mechanized / ai_automated)
 * pulled from the research tables (country_regulations, youtube_insights, production_cost_benchmarks,
 * logistics_corridors).
 *
 * Tier polish (Vague 4 #8) : si l'utilisateur courant a tier='premium' ou 'ultimate',
 * on applique une passe de raffinement/polish sur executive_summary + executive_summary_long
 * en plus du plan de base. Cache partagé inchangé — polish appliqué à la volée (coût LLM
 * justifié par le pricing tier).
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

function cacheTitle(country: string, productSlug: string, lang: 'fr' | 'en'): string {
  const base = `${resolveProductName(productSlug, lang)} — ${country}`;
  return lang === 'en' ? `${base} [en]` : base;
}

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

/**
 * Détecte le tier de l'utilisateur courant (via cookies Supabase SSR).
 * Retourne 'anonymous' si non connecté. Fail-safe : si erreur, retourne 'anonymous'.
 */
async function detectUserTier(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* readonly */ },
        },
      },
    );
    const { data } = await sb.auth.getUser();
    if (!data.user) return 'anonymous';
    const admin = supabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', data.user.id)
      .maybeSingle();
    return (profile?.tier as string) || 'data';
  } catch {
    return 'anonymous';
  }
}

/**
 * Polish cascade — pour tier premium/ultimate, raffine 1-2 sections textuelles.
 * - premium   : 1 passe refine sur executive_summary
 * - ultimate  : 2 passes (refine + polish) sur executive_summary ET chaque scenario.description
 *
 * Garantit la structure du plan (aucune suppression de clé) — seuls les champs texte sont remplacés.
 */
async function polishPlanForTier(plan: any, tier: string, lang: 'fr' | 'en'): Promise<{ polished: any; passes: number }> {
  if (tier !== 'premium' && tier !== 'ultimate') return { polished: plan, passes: 0 };
  if (!plan || typeof plan !== 'object') return { polished: plan, passes: 0 };

  const passesTarget = tier === 'ultimate' ? 2 : 1;
  const langInstruction = lang === 'en' ? 'Respond in English.' : 'Réponds en français.';
  initProviders();

  async function refine(text: string, instruction: string): Promise<string> {
    if (!text || typeof text !== 'string' || text.length < 40) return text;
    const prompt = `${instruction}\n\n${langInstruction}\n\nRéponds UNIQUEMENT avec le texte raffiné, sans guillemets ni préambule.\n\nTexte original :\n${text}`;
    try {
      const out = await gen(prompt, 2048);
      return out.trim().replace(/^["']|["']$/g, '') || text;
    } catch (err) {
      console.error('[enriched-plan/polish] gen error, keeping original:', err);
      return text;
    }
  }

  const instrRefine = 'Tu es directeur de cabinet conseil. Raffine ce texte : structure claire, chiffres crédibles avec unités, zéro jargon, ton confiant et factuel. Conserve la longueur approximative.';
  const instrPolish = 'Tu es associé en stratégie business. Polish final : ajoute 1 contre-objection discrète + quantification ROI (pessimiste / médian / optimiste). Maintiens la fluidité narrative et respecte la longueur globale.';

  const copy: any = { ...plan };

  // Pass 1 — refine executive summaries (toujours pour premium+)
  if (typeof copy.executive_summary === 'string') {
    copy.executive_summary = await refine(copy.executive_summary, instrRefine);
  }
  if (typeof copy.executive_summary_long === 'string') {
    copy.executive_summary_long = await refine(copy.executive_summary_long, instrRefine);
  }

  if (passesTarget >= 2) {
    // Pass 2 — polish + touche scenarios
    if (typeof copy.executive_summary === 'string') {
      copy.executive_summary = await refine(copy.executive_summary, instrPolish);
    }
    if (Array.isArray(copy.scenarios)) {
      copy.scenarios = await Promise.all(
        copy.scenarios.map(async (s: any) => {
          if (!s || typeof s !== 'object') return s;
          const out = { ...s };
          if (typeof out.description === 'string') {
            out.description = await refine(out.description, instrPolish);
          }
          return out;
        }),
      );
    }
  }

  copy._polish_meta = { tier, passes: passesTarget, polished_at: new Date().toISOString() };
  return { polished: copy, passes: passesTarget };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  const product = url.searchParams.get('product');
  const lang = parseLang(url.searchParams.get('lang'));
  const refresh = url.searchParams.get('refresh') === '1';
  const explicitTier = url.searchParams.get('tier'); // override manuel (dev/test)

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    const tier = explicitTier || await detectUserTier();
    let basePlan: any;
    let cachedMeta: { _cached: boolean; _cached_at?: string } = { _cached: false };

    // 1. Serve from cache unless ?refresh=1
    if (!refresh) {
      const cached = await findCachedPlan(country, product, lang);
      if (cached) {
        console.log(`[api/enriched-plan] GET ${country}/${product} lang=${lang} tier=${tier} (cached ${cached.cached_at})`);
        basePlan = cached.plan;
        cachedMeta = { _cached: true, _cached_at: cached.cached_at };
      }
    }

    if (!basePlan) {
      console.log(`[api/enriched-plan] GET ${country}/${product} lang=${lang} tier=${tier} (live generate)`);
      basePlan = await buildEnrichedPlan({
        countryIso: country,
        productSlug: product,
        productName: resolveProductName(product, lang),
        lang,
      });
      const admin = supabaseAdmin();
      await admin.from('business_plans').insert({
        type: 'enriched_3_scenarios',
        title: cacheTitle(country, product, lang),
        tier_required: 'strategy',
        full_plan_html: JSON.stringify(basePlan, null, 2),
      });
    }

    // Polish à la volée pour premium/ultimate (pas caché)
    const { polished, passes } = await polishPlanForTier(basePlan, tier, lang);

    return NextResponse.json(
      { ...polished, ...cachedMeta, _lang: lang, _tier: tier, _polish_passes: passes },
      cachedMeta._cached ? { headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800' } } : undefined,
    );
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
  const { country, product, precision, lang: bodyLang, tier: explicitTier } = body as {
    country?: string;
    product?: string;
    precision?: Record<string, unknown>;
    lang?: string;
    tier?: string;
  };
  const lang = parseLang(bodyLang ?? null);

  if (!country || !product) {
    return NextResponse.json({ error: 'Missing country or product' }, { status: 400 });
  }

  try {
    const tier = explicitTier || await detectUserTier();
    console.log(`[api/enriched-plan] POST ${country}/${product} lang=${lang} tier=${tier} precision=${JSON.stringify(precision)}`);
    const basePlan = await buildEnrichedPlan({
      countryIso: country,
      productSlug: product,
      productName: resolveProductName(product, lang),
      precision: precision as Parameters<typeof buildEnrichedPlan>[0]['precision'],
      lang,
    });

    const { polished, passes } = await polishPlanForTier(basePlan, tier, lang);

    if (body.save) {
      const admin = supabaseAdmin();
      await admin.from('business_plans').insert({
        type: 'enriched_3_scenarios',
        title: cacheTitle(country, product, lang),
        tier_required: 'strategy',
        full_plan_html: JSON.stringify(basePlan, null, 2), // on cache la version non-polished (partagée)
      });
    }

    return NextResponse.json({ ...polished, _lang: lang, _tier: tier, _polish_passes: passes });
  } catch (err) {
    console.error('[api/enriched-plan] error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
