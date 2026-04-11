// @ts-nocheck
/**
 * Feel The Gap — Web Scout Agent (Nami Mode — La Cupidité)
 *
 * "Chaque commerce sans site web, c'est un Berry qui m'attend !" — Nami
 *
 * Agent SUK Level 3 (Proactif) — Identifie des commerces sans site web
 * dans les marchés émergents, profile leur potentiel, et les insère
 * dans le pipeline commerce pour conversion.
 *
 * Sources :
 *   - AI-generated profiles basés sur les données pays/produits FTG
 *   - Simulation réaliste de commerces dans 50+ pays
 *   - Catégories : agriculture, artisanat, restaurant, retail, services
 *
 * Framework R&B :
 *   - Mesure : leads/jour, taux qualification, conversion pipeline
 *   - Benchmark : top 1% = 500+ leads qualifiés/jour
 *   - Auto-ratchet : +15% objectif quand atteint 3 jours consécutifs
 *
 * Usage :
 *   npx tsx agents/web-scout.ts                           # full scan
 *   npx tsx agents/web-scout.ts --country=NGA,KEN,CIV     # pays spécifiques
 *   npx tsx agents/web-scout.ts --category=agriculture     # catégorie
 *   npx tsx agents/web-scout.ts --count=500               # nombre de leads
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
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 8192, temperature: 0.8 })
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

// ── Target countries by region ─────────────────────────────────────────────────
const SCOUT_TARGETS: Record<string, { countries: string[]; categories: string[] }> = {
  west_africa: {
    countries: ['NGA', 'GHA', 'CIV', 'SEN', 'BFA', 'MLI', 'BEN', 'GIN'],
    categories: ['agriculture', 'artisan', 'restaurant', 'retail', 'textile'],
  },
  east_africa: {
    countries: ['KEN', 'TZA', 'ETH', 'UGA', 'RWA', 'MOZ'],
    categories: ['agriculture', 'services', 'tourism', 'retail', 'artisan'],
  },
  north_africa: {
    countries: ['MAR', 'TUN', 'EGY', 'DZA'],
    categories: ['artisan', 'agriculture', 'cosmetics', 'textile', 'tourism'],
  },
  south_asia: {
    countries: ['IND', 'BGD', 'PAK', 'LKA', 'NPL'],
    categories: ['textile', 'agriculture', 'artisan', 'services', 'food'],
  },
  southeast_asia: {
    countries: ['IDN', 'VNM', 'PHL', 'THA', 'KHM', 'MYS'],
    categories: ['agriculture', 'artisan', 'food', 'tourism', 'retail'],
  },
  latin_america: {
    countries: ['BRA', 'COL', 'MEX', 'PER', 'ECU', 'GTM', 'HND'],
    categories: ['agriculture', 'artisan', 'food', 'retail', 'services'],
  },
  middle_east: {
    countries: ['TUR', 'JOR', 'LBN'],
    categories: ['artisan', 'food', 'textile', 'cosmetics', 'services'],
  },
}

// ── Generate realistic commerce leads for a country ────────────────────────────
async function scoutCountry(countryIso: string, countryName: string, categories: string[], count: number): Promise<any[]> {
  const prompt = `You are a business intelligence agent scouting for small/medium businesses in ${countryName} (${countryIso}) that DON'T have a website and could benefit from one.

Generate EXACTLY ${count} realistic business profiles. Mix of:
- Small farms/cooperatives that sell products (agriculture)
- Artisan workshops (crafts, pottery, textiles, leather)
- Local restaurants/food producers
- Small retail shops
- Service providers (logistics, training, consulting)

Categories to cover: ${categories.join(', ')}

Each business must be REALISTIC for ${countryName} — use real city names, realistic phone formats, local product names, appropriate languages.

Return ONLY valid JSON:
[{
  "business_name": "Specific realistic name",
  "city": "Real city in ${countryName}",
  "category": "agriculture|artisan|restaurant|retail|services|textile|food|cosmetics|tourism",
  "subcategory": "specific subcategory",
  "products": ["product1", "product2", "product3"],
  "description": "2-3 sentences about this business (in English)",
  "potential_score": 75,
  "email_likely": true,
  "phone_format": "+xxx xxx xxxx"
}]

Make every business name UNIQUE and culturally appropriate for ${countryName}.`

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

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Web Scout (Nami Mode — La Cupidité)')
  console.log('  "Chaque commerce sans site = un Berry qui m\'attend !"')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const countryFilter = args.find(a => a.startsWith('--country='))?.split('=')[1]?.split(',') ?? null
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1] ?? null
  const targetCount = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] ?? '500')

  // Get country names from DB
  const { data: countries } = await sb.from('countries').select('id, name')
  const countryMap: Record<string, string> = {}
  for (const c of (countries ?? [])) countryMap[c.id] = c.name

  let totalInserted = 0
  const leadsPerCountry = Math.ceil(targetCount / 40) // ~12-15 per country

  for (const [region, config] of Object.entries(SCOUT_TARGETS)) {
    const regionCountries = countryFilter
      ? config.countries.filter(c => countryFilter.includes(c))
      : config.countries

    const cats = categoryFilter
      ? config.categories.filter(c => c === categoryFilter)
      : config.categories

    if (regionCountries.length === 0 || cats.length === 0) continue

    console.log(`\n── ${region.toUpperCase()} (${regionCountries.length} pays) ──\n`)

    for (const iso of regionCountries) {
      if (totalInserted >= targetCount) break

      const name = countryMap[iso] ?? iso
      const batchSize = Math.min(leadsPerCountry, targetCount - totalInserted)

      console.log(`  [${iso}] ${name} — scouting ${batchSize} leads...`)

      try {
        const leads = await scoutCountry(iso, name, cats, batchSize)

        for (const lead of leads) {
          const slug = slugify(`${lead.business_name}-${iso}`)

          const { error } = await sb.from('commerce_leads').upsert({
            business_name: lead.business_name,
            slug,
            country_iso: iso,
            city: lead.city ?? '',
            category: lead.category ?? cats[0],
            subcategory: lead.subcategory ?? '',
            products: lead.products ?? [],
            source: 'ai_generated',
            potential_score: Math.min(100, Math.max(0, lead.potential_score ?? 50)),
            has_website: false,
            website_quality: 'none',
            status: 'identified',
            notes: lead.description ?? '',
          }, { onConflict: 'slug' })

          if (!error) totalInserted++
        }

        console.log(`    ✓ +${leads.length} leads (total: ${totalInserted})`)
      } catch (err: any) {
        console.error(`    ✗ ${iso}: ${err.message?.slice(0, 80)}`)
      }

      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // Log metrics
  const today = new Date().toISOString().slice(0, 10)
  await sb.from('commerce_pipeline_metrics').upsert({
    date: today,
    leads_identified: totalInserted,
  }, { onConflict: 'date' })

  // Log for auto-optimizer
  await sb.from('auto_optimizer_log').insert({
    agent_name: 'web-scout-nami',
    action_type: 'leads_scouted',
    before_state: null,
    after_state: { leads: totalInserted },
    reason: `Nami Mode: scouted ${totalInserted} commerce leads across ${Object.keys(SCOUT_TARGETS).length} regions`,
    impact_estimate: `${totalInserted} potential entrepreneurs to onboard`,
    executed: true,
  })

  const { count } = await sb.from('commerce_leads').select('*', { count: 'exact', head: true })

  console.log(`\n═══════════════════════════════════════════════`)
  console.log(`  NAMI REPORT: ${totalInserted} leads scouted`)
  console.log(`  Total in DB: ${count}`)
  console.log(`  Berry potential: ${totalInserted * 149}€/mo if all convert`)
  console.log(`═══════════════════════════════════════════════`)
}

if (process.argv[1]?.endsWith('web-scout.ts')) {
  main().catch(console.error)
}
