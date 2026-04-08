import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

function buildStudyPrompt(part: number, country: any, opps: any[], imports: any[]) {
  const countryCtx = `Pays: ${country.name_fr} (${country.id}, ${country.sub_region}, ${country.region}).
Population: ${country.population ? (country.population / 1e6).toFixed(1) + 'M' : 'N/A'}.
PIB: ${country.gdp_usd ? '$' + (country.gdp_usd / 1e9).toFixed(1) + 'B' : 'N/A'}.
Imports totaux: ${country.total_imports_usd ? '$' + (country.total_imports_usd / 1e9).toFixed(1) + 'B' : 'N/A'}.
Exports totaux: ${country.total_exports_usd ? '$' + (country.total_exports_usd / 1e9).toFixed(1) + 'B' : 'N/A'}.
Balance: ${country.trade_balance_usd ? '$' + (country.trade_balance_usd / 1e9).toFixed(1) + 'B' : 'N/A'}.
Terres arables: ${country.arable_land_pct ?? 'N/A'}%.
Top import: ${country.top_import_text ?? country.top_import_category ?? 'N/A'}.
Top export: ${country.top_export_text ?? 'N/A'}.`

  const oppsCtx = opps.length > 0
    ? `Opportunités identifiées:\n${opps.map(o => `- ${o.products?.name ?? 'Produit'} (${o.products?.category ?? '?'}): score ${o.opportunity_score}/100, gap $${((o.gap_value_usd ?? 0) / 1e6).toFixed(1)}M/an — ${o.summary ?? ''}`).join('\n')}`
    : 'Aucune opportunité identifiée dans la base.'

  const importsCtx = imports.length > 0
    ? `Top produits importés:\n${imports.slice(0, 15).map(i => `- ${i.name} (${i.category}): $${((i.value_usd ?? 0) / 1e6).toFixed(1)}M`).join('\n')}`
    : ''

  if (part === 1) {
    return `Tu es un analyste économique expert. Rédige la PARTIE 1 d'une étude de marché complète sur ${country.name_fr}.

${countryCtx}
${importsCtx}

PARTIE 1 : ÉTAT DES RESSOURCES ET MARCHÉ LOCAL
Rédige une analyse détaillée et structurée (2000-3000 mots) en HTML couvrant :
1. **Présentation économique** : situation macro, PIB, croissance, monnaie, stabilité politique
2. **Ressources naturelles** : minerais, énergie, agriculture, pêche, foresterie — ce que le pays produit
3. **Production locale** : industries existantes, capacités de transformation, tissu industriel
4. **Importations détaillées** : toutes les denrées et produits importés, volumes, tendances, dépendances
5. **Exportations** : ce que le pays exporte, vers qui, volumes
6. **Infrastructure commerciale** : ports, routes, zones franches, accords commerciaux

Utilise des données réalistes et cohérentes. Sois factuel et précis. Formate en HTML avec des <h2>, <h3>, <p>, <ul>, <strong>. Pas de <html>, <head>, <body>.`
  }

  if (part === 2) {
    return `Tu es un consultant business international expert. Rédige la PARTIE 2 d'une étude de marché sur ${country.name_fr}.

${countryCtx}
${oppsCtx}
${importsCtx}

PARTIE 2 : ANALYSE BUSINESS — PRODUITS EN TENSION ET MODES DE DISTRIBUTION
Rédige une analyse business détaillée (2500-3500 mots) en HTML couvrant :
1. **Produits et denrées les plus en tension** : identifier les gaps critiques entre demande et offre locale, quantifier les manques
2. **Pour chaque produit en tension**, analyser les 3 modes de distribution :
   a) **Import & Sell** : sourcing international, coûts logistiques, droits de douane, marges, délais, fournisseurs types
   b) **Produce Locally** : capex requis, terrain, main d'œuvre, compétences nécessaires, ROI attendu, délais
   c) **Train Locals** : formation/transfert de technologie, modèle service/consulting, revenus récurrents
3. **Analyse comparative** des 3 modes pour chaque produit : tableau avantages/inconvénients/investissement/ROI
4. **Réglementation** : barrières à l'entrée, licences, certifications requises
5. **Recommandations stratégiques** : quels produits prioriser et avec quel mode

Formate en HTML avec des <h2>, <h3>, <p>, <ul>, <table>, <strong>. Sois très concret avec des chiffres.`
  }

  // Part 3
  return `Tu es un expert en intelligence économique et distribution. Rédige la PARTIE 3 d'une étude de marché sur ${country.name_fr}.

${countryCtx}
${oppsCtx}
${importsCtx}

PARTIE 3 : ACTEURS LOCAUX DU MARCHÉ
Rédige une analyse approfondie (3000-4000 mots) en HTML des acteurs qui achètent, transforment ou distribuent les matières et produits dans ${country.name_fr} :
1. **Grands importateurs / distributeurs nationaux** : noms réalistes d'entreprises (basés sur la réalité du pays), volumes estimés, CA, méthodes d'achat (appels d'offres, contrats directs, courtiers), zones de couverture
2. **Transformateurs industriels** : usines, capacités, produits finis, besoins en matières premières
3. **Grossistes et centrales d'achat** : réseaux de distribution, couverture géographique
4. **Retail et distribution finale** : supermarchés, marchés traditionnels, e-commerce, parts de marché
5. **Acteurs publics** : offices de commercialisation, entreprises d'État, programmes d'achat gouvernementaux
6. **Classement par importance** : classe tous les acteurs par volume d'affaires estimé (du plus grand au plus petit)

Pour chaque acteur majeur, donne : nom, type d'activité, CA estimé, méthodes d'achat, produits achetés, zone géographique.
Formate en HTML avec des <h2>, <h3>, <p>, <table>, <ul>, <strong>. Inclus des tableaux récapitulatifs.`
}

// GET: retrieve existing study parts
export async function GET(req: NextRequest, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params
  const admin = supabaseAdmin()

  const { data: studies } = await admin
    .from('country_studies')
    .select('part, content_html, tier_required, created_at, updated_at')
    .eq('country_iso', iso.toUpperCase())
    .order('part', { ascending: true })

  return NextResponse.json({ studies: studies ?? [] })
}

// POST: generate a study part
export async function POST(req: NextRequest, { params }: { params: Promise<{ iso: string }> }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { iso } = await params
  const { part } = await req.json() // 1, 2, or 3

  if (![1, 2, 3].includes(part)) {
    return NextResponse.json({ error: 'Part invalide (1-3)' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Check user tier access
  const { data: profile } = await admin.from('profiles').select('tier, is_admin').eq('id', user.id).single()
  const tierRank: Record<string, number> = { free: 0, basic: 1, standard: 2, premium: 3, enterprise: 4 }
  const userRank = tierRank[profile?.tier ?? 'free'] ?? 0

  // Part 1: free (Explorer), Part 2: basic (Data), Part 3: standard (Strategy)
  const requiredRanks = { 1: 0, 2: 1, 3: 2 } as Record<number, number>
  if (!profile?.is_admin && userRank < requiredRanks[part]) {
    return NextResponse.json({ error: 'Plan insuffisant pour cette partie' }, { status: 403 })
  }

  // Check if already exists (return cached)
  const { data: existing } = await admin
    .from('country_studies')
    .select('content_html, created_at')
    .eq('country_iso', iso.toUpperCase())
    .eq('part', part)
    .single()

  if (existing?.content_html) {
    return NextResponse.json({ content: existing.content_html, cached: true })
  }

  // Fetch country + opps data for context
  const [{ data: country }, { data: opps }, { data: imports }] = await Promise.all([
    admin.from('countries').select('*').eq('id', iso.toUpperCase()).single(),
    admin.from('opportunities')
      .select('*, products(name, category)')
      .eq('country_iso', iso.toUpperCase())
      .order('opportunity_score', { ascending: false })
      .limit(15),
    admin.from('trade_flows')
      .select('product_id, value_usd, products(name, category)')
      .eq('reporter_iso', iso.toUpperCase())
      .eq('flow', 'import')
      .order('value_usd', { ascending: false })
      .limit(20),
  ])

  if (!country) return NextResponse.json({ error: 'Pays non trouvé' }, { status: 404 })

  // Flatten imports
  const flatImports = (imports ?? []).map((i: any) => ({
    name: Array.isArray(i.products) ? i.products[0]?.name : i.products?.name ?? i.product_id,
    category: Array.isArray(i.products) ? i.products[0]?.category : i.products?.category ?? 'unknown',
    value_usd: i.value_usd,
  }))

  const flatOpps = (opps ?? []).map((o: any) => ({
    ...o,
    products: Array.isArray(o.products) ? o.products[0] : o.products,
  }))

  // Generate with Gemini
  const prompt = buildStudyPrompt(part, country, flatOpps, flatImports)

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Extract HTML content (strip markdown code blocks if any)
    let html = text
    const htmlMatch = text.match(/```html\s*([\s\S]*?)```/)
    if (htmlMatch) html = htmlMatch[1]
    html = html.replace(/^```\w*\s*/, '').replace(/```$/, '').trim()

    // Tier required mapping
    const tierMap = { 1: 'free', 2: 'basic', 3: 'standard' } as Record<number, string>

    // Store in DB
    await admin.from('country_studies').upsert({
      country_iso: iso.toUpperCase(),
      part,
      content_html: html,
      tier_required: tierMap[part],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'country_iso,part' })

    return NextResponse.json({ content: html, cached: false })
  } catch (err: any) {
    console.error('[studies] Gemini error:', err)
    return NextResponse.json({ error: 'Erreur de génération: ' + (err.message ?? 'unknown') }, { status: 500 })
  }
}
