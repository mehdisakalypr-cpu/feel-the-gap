// @ts-nocheck
/**
 * Feel The Gap — Market Study Generator Agent
 *
 * Generates exhaustive market studies for countries with identified opportunities.
 * Each study is a comprehensive synthesis covering resources, business analysis,
 * and local market actors — split into 3 parts aligned with subscription plans.
 *
 * Priority: countries with the most opportunities first.
 *
 * Run modes:
 *   npx tsx agents/study-generator.ts                    # all countries with opportunities
 *   npx tsx agents/study-generator.ts --iso NGA,BGD,ETH  # specific countries
 *   npx tsx agents/study-generator.ts --top 10           # top 10 countries by opportunity count
 *   npx tsx agents/study-generator.ts --part 1           # only generate part 1 for all
 *   npx tsx agents/study-generator.ts --force            # regenerate even if exists
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isoFilter = args.find(a => a.startsWith('--iso='))?.split('=')[1]?.split(',') ?? null
const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '0') || 0
const partFilter = parseInt(args.find(a => a.startsWith('--part='))?.split('=')[1] ?? '0') || 0
const force = args.includes('--force')

// ── Data aggregation ─────────────────────────────────────────────────────────

async function getCountryContext(iso: string) {
  const [{ data: country }, { data: opps }, { data: trades }, { data: products }] = await Promise.all([
    supabase.from('countries').select('*').eq('id', iso).single(),
    supabase.from('opportunities')
      .select('*, products(name, category)')
      .eq('country_iso', iso)
      .order('opportunity_score', { ascending: false })
      .limit(20),
    supabase.from('trade_flows')
      .select('product_id, value_usd, quantity, flow, year, products(name, category)')
      .eq('reporter_iso', iso)
      .order('value_usd', { ascending: false })
      .limit(50),
    supabase.from('products').select('id, name, category').limit(500),
  ])

  const imports = (trades ?? [])
    .filter((t: any) => t.flow === 'import')
    .map((t: any) => ({
      name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name ?? t.product_id,
      category: Array.isArray(t.products) ? t.products[0]?.category : t.products?.category ?? 'unknown',
      value_usd: t.value_usd,
      quantity: t.quantity,
    }))

  const exports = (trades ?? [])
    .filter((t: any) => t.flow === 'export')
    .map((t: any) => ({
      name: Array.isArray(t.products) ? t.products[0]?.name : t.products?.name ?? t.product_id,
      category: Array.isArray(t.products) ? t.products[0]?.category : t.products?.category ?? 'unknown',
      value_usd: t.value_usd,
    }))

  const flatOpps = (opps ?? []).map((o: any) => ({
    ...o,
    products: Array.isArray(o.products) ? o.products[0] : o.products,
  }))

  return { country, opportunities: flatOpps, imports, exports }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildCountryBlock(ctx: any): string {
  const c = ctx.country
  const lines = [
    `PAYS: ${c.name_fr} (${c.id}, ${c.sub_region}, ${c.region})`,
    `Population: ${c.population ? (c.population / 1e6).toFixed(1) + 'M' : 'N/A'}`,
    `PIB: ${c.gdp_usd ? '$' + (c.gdp_usd / 1e9).toFixed(1) + 'B' : 'N/A'}`,
    `PIB/hab: ${c.gdp_per_capita ? '$' + Math.round(c.gdp_per_capita) : 'N/A'}`,
    `Imports totaux: ${c.total_imports_usd ? '$' + (c.total_imports_usd / 1e9).toFixed(1) + 'B' : 'N/A'}`,
    `Exports totaux: ${c.total_exports_usd ? '$' + (c.total_exports_usd / 1e9).toFixed(1) + 'B' : 'N/A'}`,
    `Balance: ${c.trade_balance_usd ? '$' + (c.trade_balance_usd / 1e9).toFixed(1) + 'B' : 'N/A'}`,
    `Terres arables: ${c.arable_land_pct ?? 'N/A'}%`,
    c.top_import_text ? `Imports clés: ${c.top_import_text}` : '',
    c.top_export_text ? `Exports clés: ${c.top_export_text}` : '',
  ].filter(Boolean)

  if (ctx.imports.length) {
    lines.push('\nTOP IMPORTS (données plateforme):')
    ctx.imports.slice(0, 20).forEach((i: any) => {
      lines.push(`  - ${i.name} (${i.category}): $${((i.value_usd ?? 0) / 1e6).toFixed(1)}M`)
    })
  }

  if (ctx.exports.length) {
    lines.push('\nTOP EXPORTS:')
    ctx.exports.slice(0, 10).forEach((e: any) => {
      lines.push(`  - ${e.name} (${e.category}): $${((e.value_usd ?? 0) / 1e6).toFixed(1)}M`)
    })
  }

  if (ctx.opportunities.length) {
    lines.push('\nOPPORTUNITÉS IDENTIFIÉES:')
    ctx.opportunities.forEach((o: any) => {
      lines.push(`  - ${o.products?.name ?? 'Produit'} (${o.products?.category ?? '?'}): score ${o.opportunity_score}/100, gap $${((o.gap_value_usd ?? 0) / 1e6).toFixed(1)}M/an`)
      if (o.summary) lines.push(`    ${o.summary}`)
    })
  }

  return lines.join('\n')
}

const PART_PROMPTS: Record<number, (ctx: any) => string> = {
  1: (ctx) => `Tu es un analyste économique de premier plan, expert en commerce international et marchés émergents.
Rédige la PARTIE 1 d'une étude de marché exhaustive et professionnelle sur ${ctx.country.name_fr}.

${buildCountryBlock(ctx)}

═══ PARTIE 1 : ÉTAT DES RESSOURCES ET MARCHÉ LOCAL ═══

Rédige une analyse détaillée (3000-5000 mots) en HTML couvrant EN PROFONDEUR :

1. **PRÉSENTATION MACROÉCONOMIQUE**
   - Situation économique actuelle, trajectoire de croissance
   - PIB, PIB/habitant, inflation, dette publique, monnaie et stabilité de change
   - Stabilité politique et environnement des affaires (Doing Business ranking)
   - Accords commerciaux régionaux et bilatéraux (CEDEAO, SADC, ASEAN, etc.)

2. **RESSOURCES NATURELLES ET PRODUCTION**
   - Inventaire exhaustif des ressources naturelles : minerais, hydrocarbures, agriculture, pêche, foresterie
   - Capacités de production actuelles par secteur
   - Tissu industriel : nombre d'entreprises, emplois, transformation locale
   - Agriculture : cultures principales, rendements, autosuffisance alimentaire

3. **CARTOGRAPHIE COMPLÈTE DES IMPORTATIONS**
   - Analyse détaillée de CHAQUE catégorie de produit importé
   - Volumes, valeurs, tendances sur 5 ans, pays fournisseurs principaux
   - Dépendances critiques : quels produits ne peuvent pas être substitués
   - Saisonnalité des importations

4. **PROFIL DES EXPORTATIONS**
   - Produits exportés, destinations, diversification
   - Avantages comparatifs du pays
   - Potentiel d'exportation non exploité

5. **INFRASTRUCTURE COMMERCIALE**
   - Ports, aéroports, réseau routier et ferroviaire
   - Zones franches et zones économiques spéciales
   - Système bancaire et accès au crédit
   - Cadre réglementaire import/export, douanes, certifications

Sois exhaustif, factuel et précis. Utilise des données réalistes cohérentes avec les données fournies. Formate en HTML propre avec <h2>, <h3>, <p>, <ul>, <table>, <strong>. Pas de <html>/<body>.`,

  2: (ctx) => `Tu es un consultant business international de haut niveau spécialisé en stratégie d'entrée sur les marchés émergents.
Rédige la PARTIE 2 d'une étude de marché exhaustive sur ${ctx.country.name_fr}.

${buildCountryBlock(ctx)}

═══ PARTIE 2 : ANALYSE BUSINESS — PRODUITS EN TENSION ET MODES DE DISTRIBUTION ═══

Rédige une analyse business approfondie (3500-5000 mots) en HTML couvrant :

1. **CARTOGRAPHIE DES TENSIONS DE MARCHÉ**
   - Identifier TOUS les produits et denrées en tension critique (demande >> offre locale)
   - Quantifier le gap pour chaque produit : demande estimée vs. offre locale vs. importations
   - Classer par urgence et potentiel business
   - Identifier les fenêtres d'opportunité temporelles

2. **POUR CHAQUE PRODUIT EN TENSION — 3 MODÈLES D'ENTRÉE :**

   a) **IMPORT & SELL (Import & Distribution)**
   - Sourcing : pays fournisseurs recommandés, prix FOB/CIF
   - Logistique : routes maritimes, coûts de transport, délais, Incoterms
   - Droits de douane et taxes : grille tarifaire spécifique
   - Marge brute attendue, prix de revient vs. prix marché
   - Investissement initial, fonds de roulement, ROI attendu

   b) **PRODUCE LOCALLY (Production Locale)**
   - Capex requis : terrain, bâtiment, équipement, certification
   - Opex : main d'œuvre locale (coûts, compétences), énergie, matières premières
   - Capacité de production réaliste, montée en charge
   - ROI à 1 an, 3 ans, 5 ans
   - Avantages fiscaux et incitations gouvernementales

   c) **TRAIN LOCALS (Formation & Transfert)**
   - Modèle de service/consulting : formation technique, transfert de technologie
   - Revenus récurrents : licences, royalties, contrats de maintenance
   - Investissement et ROI du modèle de formation
   - Scalabilité et réplicabilité

3. **TABLEAU COMPARATIF** pour chaque produit : investissement / ROI / risque / délai / difficulté par mode

4. **RÉGLEMENTATION ET BARRIÈRES**
   - Licences d'importation requises par catégorie
   - Normes sanitaires et phytosanitaires
   - Certifications obligatoires (ISO, halal, etc.)
   - Restrictions spécifiques au pays

5. **MATRICE DE RECOMMANDATION**
   - Quels produits prioriser (score combiné : gap × marge × faisabilité)
   - Quel mode recommandé pour chaque produit
   - Séquençage optimal : commencer par quoi

Inclus des tableaux HTML récapitulatifs. Sois très concret avec des chiffres réalistes.`,

  3: (ctx) => `Tu es un expert en intelligence économique et réseaux de distribution dans les marchés émergents.
Rédige la PARTIE 3 d'une étude de marché exhaustive sur ${ctx.country.name_fr}.

${buildCountryBlock(ctx)}

═══ PARTIE 3 : ACTEURS LOCAUX DU MARCHÉ ═══

Rédige une analyse exhaustive (4000-6000 mots) en HTML des acteurs économiques de ${ctx.country.name_fr} :

1. **GRANDS IMPORTATEURS ET NÉGOCIANTS NATIONAUX**
   - Pour chaque acteur : nom, type, CA estimé, historique, zones de couverture
   - Méthodes d'achat : appels d'offres publics, courtiers, contrats directs, plateformes
   - Volumes estimés par catégorie de produit
   - Contact type : directeur achats, commercial, agent

2. **TRANSFORMATEURS ET INDUSTRIELS**
   - Usines et capacités de transformation par secteur
   - Besoins en matières premières et intrants
   - Part de marché et positionnement
   - Niveau technologique et besoins de modernisation

3. **GROSSISTES ET CENTRALES D'ACHAT**
   - Réseau de distribution en gros
   - Couverture géographique (urbain/rural)
   - Conditions commerciales types (crédit, MOQ, délais paiement)
   - Marchés de gros physiques : localisation, volumes

4. **DISTRIBUTION FINALE**
   - Supermarchés et chaînes (parts de marché)
   - Marchés traditionnels et informels (% du commerce total)
   - E-commerce et mobile commerce (croissance, acteurs)
   - Cash & carry, petits détaillants

5. **ACTEURS PUBLICS ET INSTITUTIONNELS**
   - Offices de commercialisation d'État
   - Programmes d'achat gouvernementaux (aide alimentaire, armée, hôpitaux)
   - Agences de développement impliquées
   - Chambres de commerce et associations professionnelles

6. **CLASSEMENT PAR IMPORTANCE**
   - Tableau HTML : rang, nom, type, CA estimé, produits, zone, méthode d'achat
   - Top 20 des acteurs les plus importants du pays
   - Cartographie de la chaîne de valeur

Pour chaque acteur majeur identifié, donne un profil complet : nom (réaliste), type d'activité, CA estimé, méthodes d'approvisionnement, produits principaux, zone géographique.
Formate avec des tableaux HTML et des sections clairement structurées.`,
}

// ── Generator ────────────────────────────────────────────────────────────────

async function generateStudyPart(iso: string, part: number, ctx: any): Promise<string> {
  const prompt = PART_PROMPTS[part](ctx)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
  })

  const result = await model.generateContent(prompt)
  let html = result.response.text()

  // Strip markdown code fences if present
  const match = html.match(/```html\s*([\s\S]*?)```/)
  if (match) html = match[1]
  html = html.replace(/^```\w*\s*/, '').replace(/```$/, '').trim()

  return html
}

async function saveStudy(iso: string, part: number, html: string) {
  const tierMap: Record<number, string> = { 1: 'free', 2: 'basic', 3: 'standard' }
  await supabase.from('country_studies').upsert({
    country_iso: iso,
    part,
    content_html: html,
    tier_required: tierMap[part],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'country_iso,part' })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Feel The Gap — Market Study Generator Agent')
  console.log('═══════════════════════════════════════════════════')
  console.log()

  // Get countries with opportunities, ordered by opportunity count
  let query = supabase
    .from('opportunities')
    .select('country_iso')

  const { data: oppRows } = await query

  // Count opportunities per country
  const countMap: Record<string, number> = {}
  for (const row of (oppRows ?? [])) {
    countMap[row.country_iso] = (countMap[row.country_iso] ?? 0) + 1
  }

  let countries = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .map(([iso, count]) => ({ iso, count }))

  // Apply filters
  if (isoFilter) {
    const set = new Set(isoFilter.map(i => i.toUpperCase()))
    countries = countries.filter(c => set.has(c.iso))
  }
  if (topN > 0) countries = countries.slice(0, topN)

  if (countries.length === 0) {
    console.log('No countries with opportunities found.')
    return
  }

  console.log(`Countries to process: ${countries.length}`)
  countries.forEach(c => console.log(`  ${c.iso} — ${c.count} opportunities`))
  console.log()

  const parts = partFilter ? [partFilter] : [1, 2, 3]
  let generated = 0
  let skipped = 0
  let errors = 0

  for (const { iso, count } of countries) {
    console.log(`\n── ${iso} (${count} opportunities) ──`)

    // Check existing studies
    const { data: existing } = await supabase
      .from('country_studies')
      .select('part')
      .eq('country_iso', iso)

    const existingParts = new Set((existing ?? []).map((e: any) => e.part))

    // Get context data
    const ctx = await getCountryContext(iso)
    if (!ctx.country) {
      console.log(`  SKIP: country not found in database`)
      skipped++
      continue
    }

    for (const part of parts) {
      if (existingParts.has(part) && !force) {
        console.log(`  Part ${part}: already exists, skipping`)
        skipped++
        continue
      }

      console.log(`  Part ${part}: generating...`)
      try {
        const html = await generateStudyPart(iso, part, ctx)
        await saveStudy(iso, part, html)
        generated++
        console.log(`  Part ${part}: OK (${html.length} chars)`)

        // Rate limiting: wait 2s between Gemini calls
        await new Promise(r => setTimeout(r, 2000))
      } catch (err: any) {
        console.error(`  Part ${part}: ERROR — ${err.message}`)
        errors++

        // If rate limited, wait longer
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          console.log('  Rate limited, waiting 60s...')
          await new Promise(r => setTimeout(r, 60000))
        } else {
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Done! Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(console.error)
