// @ts-nocheck
/**
 * Feel The Gap — Deal Flow Generator
 *
 * Génère 120+ deal flows réalistes dans tous les secteurs pour les investisseurs.
 *
 * Secteurs couverts (15 secteurs × 8 deals = 120 deals min) :
 *   - Agroalimentaire (cacao, café, fruits, épices)
 *   - Textile & Mode éthique
 *   - Cosmétiques naturels
 *   - Énergie solaire & renouvelable
 *   - Fintech & mobile money
 *   - Logistique & supply chain
 *   - Santé & pharma
 *   - EdTech & formation
 *   - Immobilier commercial
 *   - Mining & matières premières
 *   - Agriculture tech (AgriTech)
 *   - E-commerce & marketplace
 *   - Tourisme & hospitality
 *   - Infrastructure & BTP
 *   - Économie circulaire & recyclage
 *
 * Stages : seed, series_a, series_b, growth, bridge
 * Géographies : Afrique, Asie du Sud-Est, Latam, MENA, Inde
 *
 * Usage :
 *   npx tsx agents/deal-flow-generator.ts              # 120 deals
 *   npx tsx agents/deal-flow-generator.ts --sector=agri --count=20
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

const SECTORS = [
  { sector: 'agrifood', label: 'Agroalimentaire', countries: ['CIV', 'GHA', 'ETH', 'SEN', 'KEN', 'COL', 'VNM', 'BRA'] },
  { sector: 'textile', label: 'Textile & Mode éthique', countries: ['MAR', 'IND', 'BGD', 'ETH', 'GTM', 'PER'] },
  { sector: 'cosmetics', label: 'Cosmétiques naturels', countries: ['MAR', 'TUN', 'MDG', 'SEN', 'IND', 'BRA'] },
  { sector: 'energy', label: 'Énergie solaire & renouvelable', countries: ['NGA', 'KEN', 'IND', 'EGY', 'MAR', 'BRA'] },
  { sector: 'fintech', label: 'Fintech & Mobile Money', countries: ['NGA', 'KEN', 'GHA', 'SEN', 'IND', 'IDN'] },
  { sector: 'logistics', label: 'Logistique & Supply Chain', countries: ['NGA', 'KEN', 'EGY', 'MAR', 'IDN', 'COL'] },
  { sector: 'health', label: 'Santé & Pharma', countries: ['NGA', 'IND', 'KEN', 'GHA', 'EGY', 'TZA'] },
  { sector: 'edtech', label: 'EdTech & Formation', countries: ['NGA', 'IND', 'KEN', 'IDN', 'BRA', 'EGY'] },
  { sector: 'realestate', label: 'Immobilier commercial', countries: ['NGA', 'KEN', 'MAR', 'EGY', 'TUR', 'MEX'] },
  { sector: 'mining', label: 'Mining & Matières premières', countries: ['COG', 'GIN', 'MOZ', 'TZA', 'GHA', 'PER'] },
  { sector: 'agritech', label: 'AgriTech', countries: ['KEN', 'NGA', 'IND', 'GHA', 'BRA', 'VNM'] },
  { sector: 'ecommerce', label: 'E-commerce & Marketplace', countries: ['NGA', 'KEN', 'IDN', 'IND', 'BRA', 'MEX'] },
  { sector: 'tourism', label: 'Tourisme & Hospitality', countries: ['MAR', 'KEN', 'TZA', 'THA', 'MEX', 'COL'] },
  { sector: 'infrastructure', label: 'Infrastructure & BTP', countries: ['NGA', 'ETH', 'KEN', 'EGY', 'IND', 'IDN'] },
  { sector: 'circular', label: 'Économie circulaire & Recyclage', countries: ['NGA', 'KEN', 'IND', 'IDN', 'BRA', 'GHA'] },
]

const STAGES = ['seed', 'series_a', 'series_b', 'growth', 'bridge'] as const

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Provider setup
function buildProviders() {
  const providers: { name: string; model: LanguageModelV1; exhausted: boolean }[] = []
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

let providers: ReturnType<typeof buildProviders> = []
let pidx = 0

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[pidx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 4096, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate/)) {
        p.exhausted = true; pidx = (pidx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

async function generateDealBatch(sector: typeof SECTORS[0], count: number): Promise<any[]> {
  const stages = STAGES.sort(() => Math.random() - 0.5).slice(0, 3)
  const countries = sector.countries.sort(() => Math.random() - 0.5).slice(0, 4)

  const prompt = `Tu es analyste en private equity spécialisé dans les marchés émergents.

Génère EXACTEMENT ${count} deal flows d'investissement RÉALISTES dans le secteur "${sector.label}".

Pays cibles : ${countries.join(', ')}
Stages possibles : ${stages.join(', ')}
Montants levée : entre 100K€ et 5M€

Chaque deal doit être UNIQUE et RÉALISTE. Retourne UNIQUEMENT un JSON valide :
[
  {
    "title": "Nom du deal (entreprise + contexte)",
    "sector": "${sector.sector}",
    "subsector": "sous-secteur spécifique",
    "stage": "seed|series_a|series_b|growth|bridge",
    "country_iso": "ISO 3-lettres",
    "raise_amount_eur": 500000,
    "valuation_pre_eur": 2500000,
    "equity_offered_pct": 20,
    "revenue_current_eur": 120000,
    "revenue_target_y3_eur": 2000000,
    "ebitda_margin_pct": 15,
    "founders_summary": "2-3 phrases sur les fondateurs",
    "team_size": 8,
    "product_description": "Description du produit/service (100-150 mots)",
    "traction_summary": "Métriques de traction (CA, users, croissance)",
    "competitive_advantage": "Avantage concurrentiel clé",
    "impact_metrics": { "jobs_created": 25, "carbon_saved_tonnes": 100, "beneficiaries": 5000 },
    "sdg_goals": ["SDG 1", "SDG 8"]
  }
]

Mélange les profils : startups tech, coopératives industrielles, PME en expansion, projets à impact.`

  const raw = await gen(prompt)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No array')
    return JSON.parse(match[0])
  } catch {
    console.error(`  ✗ Parse failed for ${sector.sector}`)
    return []
  }
}

async function main() {
  providers = buildProviders()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Deal Flow Generator (120+ Deals)')
  console.log('═══════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const sectorFilter = args.find(a => a.startsWith('--sector='))?.split('=')[1] ?? null
  const perSector = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] ?? '8') || 8

  let sectors = SECTORS
  if (sectorFilter) sectors = sectors.filter(s => s.sector.includes(sectorFilter))

  console.log(`Sectors: ${sectors.length} | Per sector: ${perSector} | Expected: ${sectors.length * perSector} deals\n`)

  let total = 0

  for (const sector of sectors) {
    console.log(`\n── ${sector.label} ──`)
    const deals = await generateDealBatch(sector, perSector)

    for (const deal of deals) {
      const slug = slugify(`${deal.title}-${deal.country_iso ?? 'intl'}`)

      const { data: existing } = await supabase.from('deal_flows').select('id').eq('slug', slug).maybeSingle()
      if (existing) { console.log(`  ⊘ ${slug} (exists)`); continue }

      const { error } = await supabase.from('deal_flows').insert({
        title: deal.title,
        slug,
        sector: deal.sector ?? sector.sector,
        subsector: deal.subsector,
        stage: deal.stage ?? 'seed',
        country_iso: deal.country_iso,
        region: null,
        raise_amount_eur: deal.raise_amount_eur ?? 500000,
        valuation_pre_eur: deal.valuation_pre_eur,
        equity_offered_pct: deal.equity_offered_pct,
        revenue_current_eur: deal.revenue_current_eur,
        revenue_target_y3_eur: deal.revenue_target_y3_eur,
        ebitda_margin_pct: deal.ebitda_margin_pct,
        founders_summary: deal.founders_summary,
        team_size: deal.team_size,
        product_description: deal.product_description,
        traction_summary: deal.traction_summary,
        competitive_advantage: deal.competitive_advantage,
        impact_metrics: deal.impact_metrics ?? {},
        sdg_goals: deal.sdg_goals ?? [],
        status: 'active',
        featured: Math.random() < 0.1,
      })

      if (error) {
        console.error(`  ✗ ${slug}: ${error.message}`)
      } else {
        total++
        console.log(`  ✓ [${total}] ${deal.title}`)
      }
    }

    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n═══ Generated ${total} deal flows ═══`)
}

if (process.argv[1]?.endsWith('deal-flow-generator.ts')) {
  main().catch(console.error)
}
