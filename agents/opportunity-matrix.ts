// @ts-nocheck
/**
 * Feel The Gap — Opportunity Matrix Generator
 *
 * Génère des opportunités commerciales en masse : produits × pays
 * Chaque opportunité est scorée 0-100 par l'IA.
 *
 * Usage :
 *   npx tsx agents/opportunity-matrix.ts                    # full run
 *   npx tsx agents/opportunity-matrix.ts --batch=1          # batch 1 (20 pays)
 *   npx tsx agents/opportunity-matrix.ts --products=10      # top 10 produits par pays
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
    if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

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
  if (!providers.length) throw new Error('No AI API keys')
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
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 8192, temperature: 0.5 })
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

// Top product categories for opportunity scoring
const PRODUCT_CATEGORIES = [
  'cacao', 'café', 'épices', 'fruits tropicaux', 'noix & anacarde',
  'huile de palme', 'textile & coton', 'maroquinerie', 'cosmétiques naturelles',
  'panneaux solaires', 'miel', 'thé', 'vanille', 'mangue',
  'beurre de karité', 'gomme arabique', 'caoutchouc', 'riz',
  'bijoux artisanaux', 'céramique', 'chocolat', 'huile d\'argan',
  'café spécialité', 'sucre bio', 'coton bio',
]

async function generateOpportunitiesForCountry(
  countryIso: string,
  countryName: string,
  topImport: string,
  numProducts: number
): Promise<any[]> {
  const products = PRODUCT_CATEGORIES.slice(0, numProducts).join(', ')

  const prompt = `You are a trade intelligence analyst. Generate ${numProducts} scored trade OPPORTUNITIES for country ${countryName} (${countryIso}).

Known imports: ${topImport || 'general goods'}

For each of these products: ${products}

Score each opportunity 0-100 based on:
- Market demand (imports volume, growth trends)
- Competition level (fewer competitors = higher score)
- Logistics feasibility (ports, routes, costs)
- Regulatory friendliness (tariffs, certifications needed)

Return ONLY valid JSON array:
[{
  "product": "product name",
  "country_iso": "${countryIso}",
  "score": 75,
  "title": "Short opportunity title (max 80 chars)",
  "description": "2-3 sentence description of the opportunity",
  "market_size_usd": 5000000,
  "competition_level": "low|medium|high",
  "entry_barrier": "low|medium|high",
  "recommended_action": "What an entrepreneur should do",
  "key_buyers": "Who buys this product in ${countryName}",
  "logistics_route": "Best shipping route"
}]

Generate exactly ${numProducts} opportunities. Each must have a unique product.`

  const raw = await gen(prompt)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch {
    return []
  }
}

async function main() {
  providers = buildProviders()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════')
  console.log('  Feel The Gap — Opportunity Matrix Generator')
  console.log('═══════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const batchNum = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '0')
  const numProducts = parseInt(args.find(a => a.startsWith('--products='))?.split('=')[1] ?? '20')

  // Get all countries
  const { data: countries } = await sb
    .from('countries')
    .select('id, name, top_import_text')
    .order('name')

  if (!countries?.length) { console.error('No countries'); return }

  let targets = countries
  if (batchNum > 0) {
    const start = (batchNum - 1) * 20
    targets = countries.slice(start, start + 20)
    console.log(`  Batch ${batchNum}: ${targets.length} countries (${start}-${start + targets.length - 1})`)
  }

  console.log(`  Countries: ${targets.length} | Products/country: ${numProducts}`)
  console.log(`  Expected: ~${targets.length * numProducts} opportunities\n`)

  let totalInserted = 0

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i]
    console.log(`  [${i + 1}/${targets.length}] ${c.name} (${c.id})...`)

    try {
      const opps = await generateOpportunitiesForCountry(c.id, c.name, c.top_import_text ?? '', numProducts)

      for (const opp of opps) {
        const productSlug = opp.product?.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60) ?? 'unknown'
        const { error } = await sb.from('opportunities').upsert({
          country_iso: c.id,
          product_id: productSlug,
          type: 'direct_trade',
          opportunity_score: Math.min(100, Math.max(0, opp.score ?? 50)),
          gap_value_usd: opp.market_size_usd ?? 0,
          land_availability: opp.entry_barrier === 'low' ? 'high' : opp.entry_barrier === 'high' ? 'low' : 'medium',
          summary: [opp.title, opp.description, opp.recommended_action].filter(Boolean).join('. '),
          analysis_json: {
            competition_level: opp.competition_level,
            entry_barrier: opp.entry_barrier,
            key_buyers: opp.key_buyers,
            logistics_route: opp.logistics_route,
          },
        }, { onConflict: 'country_iso,product_id', ignoreDuplicates: true })

        if (!error) totalInserted++
      }

      console.log(`    +${opps.length} opps (total: ${totalInserted})`)
    } catch (err: any) {
      console.error(`    ✗ ${c.name}: ${err.message?.slice(0, 80)}`)
    }

    await new Promise(r => setTimeout(r, 2000))
  }

  const { count } = await sb.from('opportunities').select('*', { count: 'exact', head: true })
  console.log(`\n═══ Inserted ${totalInserted} | Total in DB: ${count} ═══`)
}

if (process.argv[1]?.endsWith('opportunity-matrix.ts')) {
  main().catch(console.error)
}
