// @ts-nocheck
/**
 * Feel The Gap — Product Enricher 10K
 *
 * Scale-up massif : 100 catégories × 100 produits = 10,000 produits
 * Utilise le même pipeline que product-enricher.ts mais avec 100 sous-catégories
 * couvrant TOUTE la chaîne de valeur du commerce international.
 *
 * Usage :
 *   npx tsx agents/product-enricher-10k.ts                  # full 10K
 *   npx tsx agents/product-enricher-10k.ts --batch=1        # batch 1 (cat 0-9)
 *   npx tsx agents/product-enricher-10k.ts --batch=2        # batch 2 (cat 10-19)
 *   npx tsx agents/product-enricher-10k.ts --resume         # skip existing slugs
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'

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

// ── 100 catégories couvrant tout le commerce international ────────────────────
interface Cat { category: string; sub: string; origins: string[]; count: number }

const MEGA_CATEGORIES: Cat[] = [
  // AGRICULTURE PREMIUM (2000 produits)
  { category: 'agriculture', sub: 'cacao grand cru', origins: ['CIV', 'GHA', 'ECU', 'COL', 'MDG', 'PER'], count: 100 },
  { category: 'agriculture', sub: 'café spécialité', origins: ['ETH', 'COL', 'BRA', 'KEN', 'GTM', 'RWA'], count: 100 },
  { category: 'agriculture', sub: 'épices rares', origins: ['IND', 'IDN', 'MAR', 'TZA', 'MDG', 'LKA'], count: 100 },
  { category: 'agriculture', sub: 'fruits tropicaux frais', origins: ['SEN', 'CIV', 'PHL', 'THA', 'MEX', 'COL'], count: 100 },
  { category: 'agriculture', sub: 'fruits séchés & déshydratés', origins: ['TUR', 'IRN', 'TUN', 'IND', 'THA'], count: 100 },
  { category: 'agriculture', sub: 'noix & oléagineux', origins: ['CIV', 'MOZ', 'TZA', 'IND', 'NGA', 'VNM'], count: 100 },
  { category: 'agriculture', sub: 'miel & produits apicoles', origins: ['ETH', 'TUR', 'MEX', 'NZL', 'ARG', 'UKR'], count: 80 },
  { category: 'agriculture', sub: 'thé & tisanes', origins: ['IND', 'KEN', 'CHN', 'JPN', 'LKA', 'RWA'], count: 80 },
  { category: 'agriculture', sub: 'huiles alimentaires premium', origins: ['MAR', 'TUN', 'GRC', 'ESP', 'ITA', 'TUR'], count: 80 },
  { category: 'agriculture', sub: 'céréales & superfoods', origins: ['PER', 'BOL', 'ETH', 'IND', 'MEX', 'CHN'], count: 80 },
  { category: 'agriculture', sub: 'légumes secs & légumineuses', origins: ['IND', 'TUR', 'ETH', 'CAN', 'AUS', 'MMR'], count: 80 },
  { category: 'agriculture', sub: 'vanille & extraits', origins: ['MDG', 'IDN', 'MEX', 'UGA', 'TZA'], count: 60 },
  { category: 'agriculture', sub: 'sucre & édulcorants naturels', origins: ['BRA', 'IND', 'THA', 'COL', 'MEX'], count: 60 },
  { category: 'agriculture', sub: 'champignons & truffes', origins: ['CHN', 'ITA', 'FRA', 'ESP', 'TUR'], count: 50 },
  { category: 'agriculture', sub: 'graines germées & micro-pousses', origins: ['NLD', 'DEU', 'USA', 'JPN', 'ISR'], count: 50 },

  // ARTISANAT & MODE (1500 produits)
  { category: 'fashion', sub: 'textile artisanal wax & bogolan', origins: ['MAR', 'GHA', 'SEN', 'CIV', 'MLI', 'BFA'], count: 100 },
  { category: 'fashion', sub: 'soie & cachemire', origins: ['IND', 'CHN', 'NPL', 'THA', 'UZB'], count: 80 },
  { category: 'fashion', sub: 'maroquinerie cuir', origins: ['MAR', 'ITA', 'ETH', 'ARG', 'IND'], count: 80 },
  { category: 'fashion', sub: 'bijoux artisanaux', origins: ['SEN', 'MEX', 'IND', 'THA', 'KEN', 'PER'], count: 100 },
  { category: 'fashion', sub: 'vannerie & fibres naturelles', origins: ['MDG', 'GHA', 'PHL', 'IDN', 'MOZ', 'RWA'], count: 80 },
  { category: 'fashion', sub: 'chaussures artisanales', origins: ['MAR', 'ITA', 'ESP', 'ETH', 'PER'], count: 60 },
  { category: 'fashion', sub: 'mode éthique & upcycling', origins: ['IND', 'BGD', 'KEN', 'BRA', 'GHA'], count: 80 },
  { category: 'fashion', sub: 'accessoires & sacs', origins: ['MAR', 'SEN', 'PHL', 'MEX', 'IND'], count: 60 },
  { category: 'fashion', sub: 'vêtements coopératives femmes', origins: ['BGD', 'IND', 'GTM', 'PER', 'KEN'], count: 60 },

  // COSMÉTIQUES & BIEN-ÊTRE (1200 produits)
  { category: 'cosmetics', sub: 'huiles précieuses (argan, baobab)', origins: ['MAR', 'SEN', 'BFA', 'MDG', 'IND'], count: 100 },
  { category: 'cosmetics', sub: 'savons artisanaux', origins: ['MAR', 'TUR', 'FRA', 'GRC', 'SYR'], count: 80 },
  { category: 'cosmetics', sub: 'soins visage naturels', origins: ['KOR', 'JPN', 'IND', 'MAR', 'BRA'], count: 100 },
  { category: 'cosmetics', sub: 'soins corps & massage', origins: ['THA', 'IND', 'IDN', 'MAR', 'SEN'], count: 80 },
  { category: 'cosmetics', sub: 'parfums & eaux florales', origins: ['MAR', 'TUR', 'IND', 'FRA', 'BGR'], count: 60 },
  { category: 'cosmetics', sub: 'soins capillaires naturels', origins: ['IND', 'JAM', 'SEN', 'BRA', 'KEN'], count: 80 },
  { category: 'cosmetics', sub: 'beurres végétaux (karité, coco)', origins: ['BFA', 'GHA', 'CIV', 'PHL', 'IDN'], count: 80 },
  { category: 'cosmetics', sub: 'aromathérapie & huiles essentielles', origins: ['MDG', 'IND', 'FRA', 'BRA', 'AUS'], count: 80 },
  { category: 'cosmetics', sub: 'makeup bio & minéral', origins: ['FRA', 'KOR', 'USA', 'JPN', 'IND'], count: 60 },

  // ALIMENTATION TRANSFORMÉE (1200 produits)
  { category: 'food', sub: 'sauces piquantes & condiments', origins: ['MEX', 'THA', 'SEN', 'JPN', 'IND', 'KOR'], count: 100 },
  { category: 'food', sub: 'chocolat bean-to-bar', origins: ['CIV', 'ECU', 'MDG', 'COL', 'PER'], count: 80 },
  { category: 'food', sub: 'confitures & pâtes à tartiner', origins: ['MAR', 'FRA', 'TUR', 'ITA', 'BRA'], count: 60 },
  { category: 'food', sub: 'snacks & barres énergétiques', origins: ['IND', 'BRA', 'THA', 'USA', 'JPN'], count: 80 },
  { category: 'food', sub: 'conserves gourmet', origins: ['MAR', 'PRT', 'ESP', 'ITA', 'TUN'], count: 60 },
  { category: 'food', sub: 'boissons & jus artisanaux', origins: ['BRA', 'COL', 'JPN', 'MEX', 'SEN'], count: 80 },
  { category: 'food', sub: 'pâtes & céréales transformées', origins: ['ITA', 'TUR', 'MAR', 'JPN', 'KOR'], count: 60 },
  { category: 'food', sub: 'aliments fermentés', origins: ['KOR', 'JPN', 'DEU', 'IDN', 'ETH'], count: 60 },
  { category: 'food', sub: 'compléments alimentaires naturels', origins: ['IND', 'CHN', 'PER', 'JPN', 'BRA'], count: 80 },
  { category: 'food', sub: 'protéines alternatives & insectes', origins: ['THA', 'KEN', 'NLD', 'FRA', 'USA'], count: 50 },

  // ÉNERGIE & TECH VERTE (800 produits)
  { category: 'energy', sub: 'panneaux solaires', origins: ['CHN', 'IND', 'DEU', 'VNM', 'KOR', 'JPN'], count: 100 },
  { category: 'energy', sub: 'batteries & stockage', origins: ['CHN', 'KOR', 'JPN', 'DEU', 'USA'], count: 80 },
  { category: 'energy', sub: 'éclairage LED & solaire', origins: ['CHN', 'IND', 'DEU', 'JPN', 'THA'], count: 80 },
  { category: 'energy', sub: 'pompes eau solaires', origins: ['IND', 'CHN', 'DEU', 'ISR', 'KEN'], count: 60 },
  { category: 'energy', sub: 'biogaz & biomasse', origins: ['IND', 'CHN', 'DEU', 'BRA', 'KEN'], count: 60 },
  { category: 'energy', sub: 'IoT agriculture & capteurs', origins: ['ISR', 'USA', 'NLD', 'JPN', 'IND'], count: 60 },
  { category: 'energy', sub: 'irrigation smart', origins: ['ISR', 'IND', 'USA', 'ESP', 'KEN'], count: 60 },
  { category: 'energy', sub: 'fours & séchoirs solaires', origins: ['IND', 'KEN', 'BFA', 'SEN', 'TZA'], count: 50 },

  // MATIÈRES PREMIÈRES (800 produits)
  { category: 'raw_materials', sub: 'bois certifié & foresterie', origins: ['CIV', 'COG', 'BRA', 'IDN', 'CMR'], count: 80 },
  { category: 'raw_materials', sub: 'coton bio & fibres naturelles', origins: ['BFA', 'IND', 'EGY', 'TUR', 'BEN'], count: 80 },
  { category: 'raw_materials', sub: 'caoutchouc & latex', origins: ['THA', 'IDN', 'MYS', 'VNM', 'CIV'], count: 60 },
  { category: 'raw_materials', sub: 'pierres & minéraux', origins: ['BRA', 'COD', 'ZAF', 'IND', 'MDG'], count: 60 },
  { category: 'raw_materials', sub: 'bambou & rotin', origins: ['CHN', 'IDN', 'VNM', 'IND', 'PHL'], count: 60 },
  { category: 'raw_materials', sub: 'laine & poils animaux', origins: ['AUS', 'NZL', 'PER', 'MNG', 'ARG'], count: 60 },
  { category: 'raw_materials', sub: 'résines & gommes naturelles', origins: ['SOM', 'ETH', 'SEN', 'SDN', 'IND'], count: 50 },

  // DÉCO & MAISON (800 produits)
  { category: 'home', sub: 'décoration intérieure artisanale', origins: ['MAR', 'IND', 'IDN', 'MEX', 'GHA'], count: 100 },
  { category: 'home', sub: 'céramique & poterie', origins: ['MAR', 'TUR', 'JPN', 'MEX', 'ITA'], count: 80 },
  { category: 'home', sub: 'tapis & kilims', origins: ['MAR', 'TUR', 'IRN', 'IND', 'AFG'], count: 80 },
  { category: 'home', sub: 'bougies & encens', origins: ['IND', 'MAR', 'JPN', 'FRA', 'IDN'], count: 60 },
  { category: 'home', sub: 'vaisselle & arts de la table', origins: ['JPN', 'MAR', 'PRT', 'ITA', 'TUR'], count: 60 },
  { category: 'home', sub: 'meubles artisanaux', origins: ['IDN', 'IND', 'MAR', 'MEX', 'VNM'], count: 60 },
  { category: 'home', sub: 'luminaires & lampes', origins: ['MAR', 'IND', 'TUR', 'JPN', 'IDN'], count: 50 },
  { category: 'home', sub: 'linge de maison & hamacs', origins: ['IND', 'BRA', 'MEX', 'COL', 'MAR'], count: 50 },

  // CULTUREL & ÉDUCATIF (500 produits)
  { category: 'cultural', sub: 'instruments de musique', origins: ['SEN', 'GHA', 'IND', 'BRA', 'CUB', 'IDN'], count: 80 },
  { category: 'cultural', sub: 'art contemporain africain', origins: ['SEN', 'NGA', 'CIV', 'GHA', 'KEN', 'ZAF'], count: 80 },
  { category: 'cultural', sub: 'jeux & jouets éducatifs', origins: ['DEU', 'JPN', 'IND', 'BRA', 'KEN'], count: 60 },
  { category: 'cultural', sub: 'livres & publications', origins: ['SEN', 'MAR', 'NGA', 'FRA', 'IND'], count: 50 },
  { category: 'cultural', sub: 'masques & sculptures', origins: ['CIV', 'BFA', 'COD', 'MEX', 'IDN', 'GHA'], count: 60 },
  { category: 'cultural', sub: 'calligraphie & papeterie', origins: ['JPN', 'CHN', 'IND', 'MAR', 'EGY'], count: 50 },

  // SERVICES & B2B (500 produits)
  { category: 'services', sub: 'conseil export & import', origins: ['FRA', 'MAR', 'SEN', 'IND', 'BRA', 'TUR'], count: 80 },
  { category: 'services', sub: 'logistique & transport', origins: ['CHN', 'DEU', 'NLD', 'SGP', 'ARE'], count: 80 },
  { category: 'services', sub: 'certification & labels', origins: ['DEU', 'FRA', 'CHE', 'USA', 'JPN'], count: 60 },
  { category: 'services', sub: 'packaging éco-responsable', origins: ['IND', 'IDN', 'CHN', 'DEU', 'BRA'], count: 80 },
  { category: 'services', sub: 'formation commerce international', origins: ['FRA', 'MAR', 'SEN', 'IND', 'BRA'], count: 60 },

  // COOPÉRATIVES & IMPACT (500 produits)
  { category: 'cooperative', sub: 'coopératives féminines', origins: ['MAR', 'SEN', 'BFA', 'KEN', 'GTM', 'PER'], count: 100 },
  { category: 'cooperative', sub: 'commerce équitable certifié', origins: ['CIV', 'ETH', 'PER', 'KEN', 'GHA', 'COL'], count: 100 },
  { category: 'cooperative', sub: 'produits réfugiés & diaspora', origins: ['SYR', 'AFG', 'SOM', 'MMR', 'UKR'], count: 60 },
  { category: 'cooperative', sub: 'agroforesterie & permaculture', origins: ['BRA', 'CIV', 'IDN', 'IND', 'MEX'], count: 80 },
  { category: 'cooperative', sub: 'recyclage & économie circulaire', origins: ['IND', 'KEN', 'GHA', 'BRA', 'IDN'], count: 80 },
]

const TOTAL_EXPECTED = MEGA_CATEGORIES.reduce((s, c) => s + c.count, 0)

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

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 8192, temperature: 0.75 })
      return text
    } catch (err: any) {
      const msg = err.message?.toLowerCase() ?? ''
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

// Generate a batch of 25 products at a time (LLM sweet spot)
async function generateBatch(cat: Cat, batchNum: number, batchSize: number): Promise<any[]> {
  const prompt = `Generate EXACTLY ${batchSize} unique products in category "${cat.sub}" (${cat.category}).
Origins: ${cat.origins.join(', ')}
Batch ${batchNum} — make products DIFFERENT from previous batches.

Each product must be realistic, specific (not generic), and trade-ready.
Mix: artisanal, cooperative, industrial, premium, budget varieties.

Return ONLY valid JSON array:
[{"name":"Specific product name","short_pitch":"Max 80 chars tagline","description":"100-200 words rich description","price_eur":12.50,"origin_iso":"CIV","benefits":["b1","b2","b3"],"ingredients":["i1"],"variants":["v1","v2"],"labels":["Fair Trade"],"impact_data":{"fair_trade":true,"carbon_kg_per_unit":0.5,"local_jobs":12},"commission_pct":12}]

IMPORTANT: Each name must be UNIQUE and specific. Include origin in the name when relevant.`

  const raw = await gen(prompt)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch {
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

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Feel The Gap — Product Enricher 10K (${MEGA_CATEGORIES.length} categories, ~${TOTAL_EXPECTED} products)`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const batchFilter = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '0')
  const resume = args.includes('--resume')

  // Get seller ID
  const { data: adminUser } = await supabase.from('profiles').select('id').eq('email', 'mehdi.sakalypr@gmail.com').maybeSingle()
  const sellerId = adminUser?.id ?? ''
  if (!sellerId) { console.error('No admin user'); return }

  // Get existing count
  const { count: existingCount } = await supabase.from('products_catalog').select('*', { count: 'exact', head: true })
  console.log(`  Existing products: ${existingCount ?? 0}`)
  console.log(`  Target: 10,000\n`)

  // Filter categories by batch
  let cats = MEGA_CATEGORIES
  if (batchFilter > 0) {
    const start = (batchFilter - 1) * 10
    cats = MEGA_CATEGORIES.slice(start, start + 10)
    console.log(`  Batch ${batchFilter}: categories ${start}-${start + cats.length - 1}\n`)
  }

  let totalInserted = 0
  let totalSkipped = 0

  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci]
    const BATCH_SIZE = 25 // LLM generates 25 at a time
    const numBatches = Math.ceil(cat.count / BATCH_SIZE)

    console.log(`\n── [${ci + 1}/${cats.length}] ${cat.category}/${cat.sub} (${cat.count} target, ${numBatches} batches) ──`)

    for (let b = 0; b < numBatches; b++) {
      const thisSize = Math.min(BATCH_SIZE, cat.count - b * BATCH_SIZE)

      try {
        const products = await generateBatch(cat, b + 1, thisSize)

        for (const p of products) {
          const slug = slugify(`${p.name}-${p.origin_iso ?? cat.origins[0]}`)

          if (resume) {
            const { data: existing } = await supabase
              .from('products_catalog').select('id').eq('slug', slug).maybeSingle()
            if (existing) { totalSkipped++; continue }
          }

          const { error } = await supabase.from('products_catalog').upsert({
            seller_id: sellerId,
            name: p.name,
            slug,
            short_pitch: p.short_pitch ?? '',
            description: p.description ?? '',
            price_eur: p.price_eur ?? 10,
            category: cat.category,
            hero_image_url: null,
            images: [],
            benefits: p.benefits ?? [],
            ingredients: p.ingredients ?? [],
            variants: p.variants ?? [],
            origin_country: p.origin_iso ?? cat.origins[0],
            impact_data: { ...(p.impact_data ?? {}), labels: p.labels ?? [], subcategory: cat.sub },
            commission_pct: p.commission_pct ?? 12,
            platform_pct: 30,
            influencer_pct: 70,
            catalog_opt_in: true,
            catalog_consent_at: new Date().toISOString(),
            status: 'active',
            our_go_code: Math.random().toString(36).slice(2, 10),
          }, { onConflict: 'slug' })

          if (error) {
            console.error(`    ✗ ${slug}: ${error.message}`)
          } else {
            totalInserted++
          }
        }

        console.log(`    Batch ${b + 1}/${numBatches}: +${products.length} products (total: ${totalInserted})`)
      } catch (err: any) {
        console.error(`    ✗ Batch ${b + 1} failed: ${err.message?.slice(0, 100)}`)
      }

      // Rate limit between batches
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // Final count
  const { count: finalCount } = await supabase.from('products_catalog').select('*', { count: 'exact', head: true })

  console.log(`\n═══════════════════════════════════════════════`)
  console.log(`  INSERTED: ${totalInserted} | SKIPPED: ${totalSkipped}`)
  console.log(`  TOTAL IN DB: ${finalCount}`)
  console.log(`  TARGET: 10,000`)
  console.log(`═══════════════════════════════════════════════`)
}

if (process.argv[1]?.endsWith('product-enricher-10k.ts')) {
  main().catch(console.error)
}
