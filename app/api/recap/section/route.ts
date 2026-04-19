import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// ────────────────────────────────────────────────────────────────────────────
// /api/recap/section?iso=FR&section=business_plan
//
// Renvoie le top-10 des informations clés pour la section demandée.
// Cache via table `journey_section_summaries` — évite la régénération.
// ────────────────────────────────────────────────────────────────────────────

const VALID_SECTIONS = new Set([
  'country',
  'report',
  'studies',
  'business_plan',
  'clients',
  'videos',
  'store',
])

type Bullet = string

async function loadFromCache(userId: string, iso: string, section: string): Promise<Bullet[] | null> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data } = await sb
    .from('journey_section_summaries')
    .select('bullets')
    .eq('user_id', userId)
    .eq('country_iso', iso)
    .eq('section_id', section)
    .maybeSingle()
  if (!data?.bullets) return null
  return Array.isArray(data.bullets) ? (data.bullets as Bullet[]) : null
}

async function saveToCache(userId: string, iso: string, section: string, bullets: Bullet[]) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  await sb
    .from('journey_section_summaries')
    .upsert(
      { user_id: userId, country_iso: iso, section_id: section, bullets, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,country_iso,section_id' },
    )
}

// ── Generators per section type ────────────────────────────────────────────
async function generateBullets(iso: string, section: string): Promise<Bullet[]> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  switch (section) {
    case 'country': {
      const { data: c } = await sb
        .from('countries')
        .select('name_fr, name, capital, population, gdp_eur, currency, languages, region, sub_region, hdi, ease_of_business_rank')
        .eq('id', iso)
        .maybeSingle()
      if (!c) return []
      return [
        `${c.name_fr || c.name}${c.region ? ` — ${c.region}${c.sub_region ? ' / ' + c.sub_region : ''}` : ''}`,
        c.capital && `Capitale : ${c.capital}`,
        c.population && `Population : ${Number(c.population).toLocaleString('fr-FR')} habitants`,
        c.gdp_eur && `PIB : ${Number(c.gdp_eur).toLocaleString('fr-FR')} €`,
        c.currency && `Devise : ${c.currency}`,
        c.languages && `Langues : ${Array.isArray(c.languages) ? (c.languages as string[]).join(', ') : c.languages}`,
        c.hdi && `IDH : ${c.hdi}`,
        c.ease_of_business_rank && `Rang Ease of Doing Business : ${c.ease_of_business_rank}`,
      ].filter((x): x is string => Boolean(x)).slice(0, 10)
    }

    case 'report': {
      const { data: opps } = await sb
        .from('opportunities')
        .select('product_name, gap_value_eur, gap_volume_t, demand_growth_pct, competitive_intensity')
        .eq('country_iso', iso)
        .order('gap_value_eur', { ascending: false })
        .limit(10)
      return (opps ?? []).map(o =>
        `${o.product_name} — gap ${Number(o.gap_value_eur ?? 0).toLocaleString('fr-FR')} € · ${o.gap_volume_t ?? '?'}t · croissance ${o.demand_growth_pct ?? '?'}%`,
      )
    }

    case 'business_plan': {
      const { data: cached } = await sb
        .from('cached_business_plans')
        .select('plan')
        .eq('country_iso', iso)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const plan = cached?.plan as Record<string, unknown> | undefined
      if (!plan) return ['Business plan non encore généré pour ce pays — ouvre la section pour le créer.']
      const bullets: string[] = []
      const exec = plan.executive_summary as string | undefined
      if (exec) bullets.push(`Résumé : ${exec.slice(0, 180)}${exec.length > 180 ? '…' : ''}`)
      const ms = plan.market_study as Record<string, unknown> | undefined
      if (ms) {
        if (ms.market_size_eur) bullets.push(`Taille marché : ${Number(ms.market_size_eur).toLocaleString('fr-FR')} €`)
        if (ms.growth_rate_pct) bullets.push(`Croissance annuelle : ${ms.growth_rate_pct}%`)
      }
      const sc = plan.scenarios as Record<string, { capex_eur?: number; roi_3y_pct?: number; payback_months?: number }> | undefined
      if (sc) {
        for (const key of ['artisanal', 'mechanized', 'ai_automated']) {
          const s = sc[key]
          if (s) bullets.push(`Scénario ${key} : CapEx ${Number(s.capex_eur ?? 0).toLocaleString('fr-FR')} € · ROI 3 ans ${s.roi_3y_pct ?? '?'}% · payback ${s.payback_months ?? '?'} mois`)
        }
      }
      const recoCmp = plan.scenarios_comparison as { recommended_scenario?: string; recommendation_rationale?: string } | undefined
      if (recoCmp?.recommended_scenario) bullets.push(`Scénario recommandé : ${recoCmp.recommended_scenario}${recoCmp.recommendation_rationale ? ' — ' + recoCmp.recommendation_rationale.slice(0, 100) : ''}`)
      const ap = plan.action_plan as Array<{ name: string; duration_months: number }> | undefined
      if (ap?.length) bullets.push(`Plan d'action : ${ap.length} phases · durée totale ${ap.reduce((a, p) => a + (p.duration_months ?? 0), 0)} mois`)
      return bullets.slice(0, 10)
    }

    case 'clients': {
      const { data: buyers } = await sb
        .from('local_buyers')
        .select('name, buyer_type, city, verified, confidence_score')
        .eq('country_iso', iso)
        .order('verified', { ascending: false })
        .order('confidence_score', { ascending: false })
        .limit(10)
      return (buyers ?? []).map(b =>
        `${b.name}${b.verified ? ' ✓' : ''} — ${b.buyer_type}${b.city ? ' · ' + b.city : ''} (confiance ${Math.round((b.confidence_score ?? 0) * 100)}%)`,
      )
    }

    case 'videos': {
      const { data: vids } = await sb
        .from('youtube_videos')
        .select('title, channel_name, view_count, published_at')
        .eq('country_iso', iso)
        .order('view_count', { ascending: false })
        .limit(10)
      return (vids ?? []).map(v =>
        `${v.title} — ${v.channel_name} · ${Number(v.view_count ?? 0).toLocaleString('fr-FR')} vues`,
      )
    }

    case 'studies': {
      const { data: studies } = await sb
        .from('country_studies')
        .select('title, summary')
        .eq('country_iso', iso)
        .limit(10)
      return (studies ?? []).map(s => `${s.title}${s.summary ? ' : ' + (s.summary as string).slice(0, 120) : ''}`)
    }

    case 'store': {
      return [
        'Site e-commerce mini-marchand prêt en 5 min',
        'Catalogue produits, panier, paiement Stripe',
        'Multilingue (FR/EN/ES) + multi-devises géo-pricing',
        'SEO optimisé + sitemap + structured data',
        'Hébergé sur Vercel — domaine personnalisable',
        'Gestion commandes, factures, expéditions',
        'Intégration WhatsApp / email pour follow-up',
        'Section "à propos" personnalisable',
        'Analytics intégrées (visites, conversions)',
        'Support client multilingue',
      ]
    }

    default:
      return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const iso = (searchParams.get('iso') ?? '').toUpperCase()
  const section = searchParams.get('section') ?? ''

  if (!iso || !VALID_SECTIONS.has(section)) {
    return NextResponse.json({ error: 'Invalid iso or section' }, { status: 400 })
  }

  // Auth (cache cross-user OFF — chaque user a sa propre cache)
  let userId: string | null = null
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('sb-access-token')?.value
    if (token) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      )
      const { data } = await sb.auth.getUser(token)
      userId = data.user?.id ?? null
    }
  } catch {
    // anonymous — pas de cache
  }

  // 1) Tenter cache user
  if (userId) {
    const cached = await loadFromCache(userId, iso, section)
    if (cached) {
      return NextResponse.json({ bullets: cached, cached: true })
    }
  }

  // 2) Générer
  const bullets = await generateBullets(iso, section)

  // 3) Cache si user connecté
  if (userId && bullets.length > 0) {
    try {
      await saveToCache(userId, iso, section, bullets)
    } catch {
      // ignore cache errors
    }
  }

  return NextResponse.json({ bullets, cached: false })
}
