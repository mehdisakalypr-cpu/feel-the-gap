// @ts-nocheck
/**
 * Feel The Gap — Product Enricher Agent
 *
 * Génère massivement des produits dans products_catalog pour enrichir
 * la plateforme avec de la donnée réelle et convaincante.
 *
 * Catégories ciblées (30 catégories × 20 produits = 600+ produits) :
 *   - Agriculture terroir & bio (cacao, café, épices, fruits tropicaux, miel, thé)
 *   - Artisanat & savoir-faire (textile, céramique, maroquinerie, bijoux, bois)
 *   - Cosmétiques naturels (huiles, savons, soins, parfums)
 *   - Alimentation transformée (sauces, confiseries, boissons, conserves)
 *   - Énergie & tech (panneaux solaires, batteries, composants)
 *   - Matières premières (minerais, bois, coton, cuir)
 *   - Coopératives & labels (Fair Trade, Bio, Demeter, Rainforest Alliance)
 *   - Culturel & artisanal (instruments, décoration, art)
 *
 * Chaque produit a :
 *   - Nom + pitch accrocheur (en FR, traduit on-demand)
 *   - Description riche (200+ mots)
 *   - Pays d'origine réaliste
 *   - Données d'impact (fair_trade, carbon, eau)
 *   - Benefits, ingrédients, variants
 *   - Commission structure
 *
 * Usage :
 *   npx tsx agents/product-enricher.ts                    # full 600+ products
 *   npx tsx agents/product-enricher.ts --category=food    # specific category
 *   npx tsx agents/product-enricher.ts --count=50         # limit
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { localizeUserPrompt } from '@/lib/ai/localized-gen'
import type { Locale } from '@/lib/i18n/locale'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim(), v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

// ── Product templates by category ──────────────────────────────────────────────
// Each template generates 15-25 unique products via LLM

const PRODUCT_CATEGORIES = [
  // Agriculture & Terroir
  { category: 'agriculture', subcategory: 'cacao', origins: ['CIV', 'GHA', 'ECU', 'COL', 'IDN'], count: 20 },
  { category: 'agriculture', subcategory: 'café', origins: ['ETH', 'COL', 'BRA', 'VNM', 'KEN'], count: 20 },
  { category: 'agriculture', subcategory: 'épices', origins: ['IND', 'IDN', 'MAR', 'TZA', 'MDG'], count: 20 },
  { category: 'agriculture', subcategory: 'fruits tropicaux', origins: ['SEN', 'CIV', 'PHL', 'THA', 'MEX'], count: 15 },
  { category: 'agriculture', subcategory: 'noix & graines', origins: ['CIV', 'MOZ', 'TZA', 'IND', 'NGA'], count: 15 },
  { category: 'agriculture', subcategory: 'miel & apiculture', origins: ['ETH', 'TUR', 'MEX', 'NZL', 'ARG'], count: 10 },
  { category: 'agriculture', subcategory: 'thé & infusions', origins: ['IND', 'KEN', 'CHN', 'JPN', 'LKA'], count: 10 },
  { category: 'agriculture', subcategory: 'huiles alimentaires', origins: ['MAR', 'TUN', 'GRC', 'ESP', 'TUR'], count: 10 },
  // Artisanat & Savoir-faire
  { category: 'fashion', subcategory: 'textile artisanal', origins: ['MAR', 'IND', 'GHA', 'PER', 'GTM'], count: 20 },
  { category: 'fashion', subcategory: 'maroquinerie', origins: ['MAR', 'ITA', 'ETH', 'SEN', 'ARG'], count: 15 },
  { category: 'fashion', subcategory: 'bijoux artisanaux', origins: ['SEN', 'MEX', 'IND', 'THA', 'KEN'], count: 15 },
  { category: 'fashion', subcategory: 'vannerie & raphia', origins: ['MDG', 'GHA', 'PHL', 'IDN', 'MOZ'], count: 10 },
  // Cosmétiques
  { category: 'cosmetics', subcategory: 'huiles précieuses', origins: ['MAR', 'TUN', 'SEN', 'MDG', 'IND'], count: 20 },
  { category: 'cosmetics', subcategory: 'savons artisanaux', origins: ['MAR', 'TUR', 'SYR', 'FRA', 'GRC'], count: 15 },
  { category: 'cosmetics', subcategory: 'soins naturels', origins: ['IND', 'JPN', 'KOR', 'BRA', 'KEN'], count: 15 },
  // Alimentation transformée
  { category: 'food', subcategory: 'sauces & condiments', origins: ['SEN', 'THA', 'MEX', 'JPN', 'IND'], count: 15 },
  { category: 'food', subcategory: 'chocolat & confiserie', origins: ['CIV', 'BEL', 'ECU', 'COL', 'MDG'], count: 15 },
  { category: 'food', subcategory: 'boissons', origins: ['BRA', 'COL', 'JPN', 'MEX', 'TUR'], count: 10 },
  { category: 'food', subcategory: 'conserves & séchés', origins: ['MAR', 'SEN', 'PER', 'THA', 'ITA'], count: 10 },
  // Énergie & Tech
  { category: 'energy', subcategory: 'solaire', origins: ['CHN', 'IND', 'DEU', 'VNM', 'KOR'], count: 15 },
  { category: 'energy', subcategory: 'batteries & stockage', origins: ['CHN', 'KOR', 'JPN', 'DEU', 'USA'], count: 10 },
  // Matières premières
  { category: 'raw_materials', subcategory: 'bois & foresterie', origins: ['CIV', 'COG', 'BRA', 'IDN', 'MYS'], count: 10 },
  { category: 'raw_materials', subcategory: 'coton & fibres', origins: ['BFA', 'IND', 'EGY', 'UZB', 'BEN'], count: 10 },
  // Culturel & Déco
  { category: 'cultural', subcategory: 'décoration & art', origins: ['MAR', 'IND', 'MEX', 'SEN', 'IDN'], count: 15 },
  { category: 'cultural', subcategory: 'instruments musique', origins: ['SEN', 'GHA', 'IND', 'BRA', 'CUB'], count: 10 },
  // Coopératives & Labels
  { category: 'cooperative', subcategory: 'produits coopératives', origins: ['CIV', 'ETH', 'PER', 'KEN', 'GHA'], count: 20 },
  { category: 'services', subcategory: 'formation & conseil', origins: ['FRA', 'MAR', 'SEN', 'IND', 'BRA'], count: 10 },
]

const LABEL_TYPES = [
  'Fair Trade', 'Bio / Organic', 'Demeter', 'Rainforest Alliance', 'UTZ',
  'IGP', 'AOP', 'Label Rouge', 'B Corp', 'Carbon Neutral',
  'Women Empowerment', 'Zero Waste', 'Vegan', 'Halal', 'Kosher',
]

// ── Provider rotation ──────────────────────────────────────────────────────────
interface Provider { name: string; model: LanguageModelV1; exhausted: boolean }

function buildProviders(): Provider[] {
  const providers: Provider[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  }
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile'), exhausted: false })
  }
  if (providers.length === 0) throw new Error('No AI API keys')
  return providers
}

let providers: Provider[] = []
let idx = 0

async function gen(prompt: string, label: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 4096, temperature: 0.75 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('429') || err.message?.toLowerCase().includes('quota')) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error(`All providers failed: ${label}`)
}

const ISO_TO_COUNTRY: Record<string, string> = {
  CIV: "Côte d'Ivoire", GHA: 'Ghana', ECU: 'Ecuador', COL: 'Colombia', IDN: 'Indonesia',
  ETH: 'Ethiopia', BRA: 'Brazil', VNM: 'Vietnam', KEN: 'Kenya', IND: 'India',
  MAR: 'Morocco', TZA: 'Tanzania', MDG: 'Madagascar', SEN: 'Senegal', PHL: 'Philippines',
  THA: 'Thailand', MEX: 'Mexico', MOZ: 'Mozambique', NGA: 'Nigeria', TUR: 'Turkey',
  NZL: 'New Zealand', ARG: 'Argentina', CHN: 'China', JPN: 'Japan', LKA: 'Sri Lanka',
  TUN: 'Tunisia', GRC: 'Greece', ESP: 'Spain', PER: 'Peru', GTM: 'Guatemala',
  ITA: 'Italy', SYR: 'Syria', FRA: 'France', KOR: 'South Korea', BEL: 'Belgium',
  DEU: 'Germany', USA: 'United States', MYS: 'Malaysia', COG: 'Congo', BFA: 'Burkina Faso',
  EGY: 'Egypt', UZB: 'Uzbekistan', BEN: 'Benin', CUB: 'Cuba', GIN: 'Guinea',
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function generateProductBatch(
  category: string,
  subcategory: string,
  origins: string[],
  count: number,
  locale: Locale = 'fr',
): Promise<any[]> {
  const originNames = origins.map(iso => `${ISO_TO_COUNTRY[iso] ?? iso} (${iso})`).join(', ')
  const labels = LABEL_TYPES.sort(() => Math.random() - 0.5).slice(0, 5).join(', ')

  const rawPrompt = `Tu es expert en produits de commerce international, spécialisé en produits artisanaux, de terroir, coopératives et labels qualité.

Génère EXACTEMENT ${count} produits uniques dans la catégorie "${subcategory}" (catégorie: ${category}).
Pays d'origine possibles : ${originNames}
Labels potentiels : ${labels}

Les produits doivent être RÉALISTES et VARIÉS :
- Mélange de produits artisanaux, coopératives, fabricants indépendants, labels qualité
- Prix réalistes en EUR
- Descriptions riches et engageantes (100-200 mots)
- Bénéfices concrets et mesurables
- Données d'impact (fair_trade, carbone, eau, emploi local)

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de code fences) :
[
  {
    "name": "Nom du produit (en français)",
    "short_pitch": "Phrase d'accroche (max 80 chars)",
    "description": "Description riche (100-200 mots)",
    "price_eur": 12.50,
    "origin_iso": "CIV",
    "benefits": ["bénéfice 1", "bénéfice 2", "bénéfice 3", "bénéfice 4"],
    "ingredients": ["ingrédient 1"],
    "variants": ["variante 1", "variante 2"],
    "labels": ["Fair Trade", "Bio"],
    "impact_data": { "fair_trade": true, "carbon_kg_per_unit": 0.5, "local_jobs": 12 },
    "commission_pct": 12
  }
]

IMPORTANT : Chaque produit doit avoir un nom UNIQUE et spécifique. Pas de noms génériques.
Inclure au moins 3 produits de coopératives, 3 artisanaux, 3 avec labels qualité.`

  const prompt = localizeUserPrompt(rawPrompt, locale)
  const raw = await gen(prompt, `products-${category}-${subcategory}`)

  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No array found')
    return JSON.parse(match[0])
  } catch {
    console.error(`  ✗ Failed to parse JSON for ${category}/${subcategory}`)
    return []
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  providers = buildProviders()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Product Enricher (600+ Products)')
  console.log('═══════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const catFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] ?? null
  const maxCount = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] ?? '0') || 0

  // Get or create a system seller account for platform products
  let sellerId: string
  const { data: systemUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'system@feelthegap.app')
    .maybeSingle()

  if (systemUser) {
    sellerId = systemUser.id
  } else {
    // Use admin email as seller
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
      .limit(1)
      .maybeSingle()
    sellerId = adminUser?.id ?? ''
    if (!sellerId) {
      console.error('No admin user found. Cannot create products without a seller_id.')
      return
    }
  }

  let categories = PRODUCT_CATEGORIES
  if (catFilter) categories = categories.filter(c => c.category === catFilter || c.subcategory.includes(catFilter))

  const totalExpected = categories.reduce((sum, c) => sum + c.count, 0)
  console.log(`Categories: ${categories.length} | Expected products: ${totalExpected}`)
  if (maxCount > 0) console.log(`Limiting to ${maxCount} total`)

  let totalInserted = 0

  for (const cat of categories) {
    if (maxCount > 0 && totalInserted >= maxCount) break

    const batchCount = maxCount > 0 ? Math.min(cat.count, maxCount - totalInserted) : cat.count
    console.log(`\n── ${cat.category}/${cat.subcategory} (${batchCount} products) ──`)

    const products = await generateProductBatch(cat.category, cat.subcategory, cat.origins, batchCount)

    for (const p of products) {
      if (maxCount > 0 && totalInserted >= maxCount) break

      const slug = slugify(`${p.name}-${p.origin_iso ?? cat.origins[0]}`)

      // Check if slug already exists
      const { data: existing } = await supabase
        .from('products_catalog')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (existing) { console.log(`  ⊘ ${slug} (exists)`); continue }

      const row = {
        seller_id: sellerId,
        name: p.name,
        slug,
        short_pitch: p.short_pitch,
        description: p.description,
        price_eur: p.price_eur ?? 10,
        category: cat.category,
        hero_image_url: null,
        images: [],
        benefits: p.benefits ?? [],
        ingredients: p.ingredients ?? [],
        variants: p.variants ?? [],
        origin_country: ISO_TO_COUNTRY[p.origin_iso] ?? p.origin_iso ?? cat.origins[0],
        impact_data: {
          ...(p.impact_data ?? {}),
          labels: p.labels ?? [],
          subcategory: cat.subcategory,
        },
        commission_pct: p.commission_pct ?? 12,
        platform_pct: 30,
        influencer_pct: 70,
        catalog_opt_in: true,
        catalog_consent_at: new Date().toISOString(),
        status: 'active',
        our_go_code: Math.random().toString(36).slice(2, 10),
      }

      const { error } = await supabase.from('products_catalog').insert(row)
      if (error) {
        console.error(`  ✗ ${slug}: ${error.message}`)
      } else {
        totalInserted++
        console.log(`  ✓ [${totalInserted}] ${p.name}`)
      }
    }

    // Rate limiting between categories
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n═══ Inserted ${totalInserted} products ═══`)
}

if (process.argv[1]?.endsWith('product-enricher.ts')) {
  main().catch(console.error)
}
