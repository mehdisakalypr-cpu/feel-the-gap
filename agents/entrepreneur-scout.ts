// @ts-nocheck
/**
 * Feel The Gap — Entrepreneur Scout Agent
 *
 * "Je serai le Hokage qui voit chaque talent avant qu'il ne s'epanouisse !" — Minato
 *
 * Identifie des entrepreneurs potentiels par secteur/pays,
 * genere un profil enrichi, et lance le demo-generator pour creer
 * une page personnalisee avant outreach.
 *
 * Usage :
 *   npx tsx agents/entrepreneur-scout.ts                         # full scan
 *   npx tsx agents/entrepreneur-scout.ts --country=CIV,SEN       # pays specifiques
 *   npx tsx agents/entrepreneur-scout.ts --sector=agriculture    # secteur
 *   npx tsx agents/entrepreneur-scout.ts --count=100             # nombre de leads
 */

import * as fs from 'fs'
import * as path from 'path'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createMistral } from '@ai-sdk/mistral'

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

// ── Providers ──────────────────────────────────────────────────────────────────
interface Provider { name: string; model: LanguageModelV1; exhausted: boolean }
function buildProviders(): Provider[] {
  const p: Provider[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) p.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  if (process.env.GROQ_API_KEY) { const g = createGroq({ apiKey: process.env.GROQ_API_KEY }); p.push({ name: 'Groq', model: g('llama-3.3-70b-versatile'), exhausted: false }) }
  if (process.env.MISTRAL_API_KEY) { const m = createMistral({ apiKey: process.env.MISTRAL_API_KEY }); p.push({ name: 'Mistral', model: m('mistral-small-latest'), exhausted: false }) }
  if (process.env.OPENAI_API_KEY) { const o = createOpenAI({ apiKey: process.env.OPENAI_API_KEY }); p.push({ name: 'OpenAI', model: o('gpt-4o-mini'), exhausted: false }) }
  if (!p.length) throw new Error('No AI API keys configured')
  return p
}

let providers: Provider[] = []
let idx = 0

async function gen(prompt: string, tokens = 8192): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]; tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: tokens, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate/)) { p.exhausted = true; idx = (idx + 1) % providers.length; continue }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

// ── Supabase ───────────────────────────────────────────────────────────────────
async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ── Config ─────────────────────────────────────────────────────────────────────
const SECTORS = ['agriculture', 'textile', 'food_processing', 'artisan', 'technology', 'renewable_energy', 'logistics', 'aquaculture']

const COUNTRY_PROFILES: Record<string, { name: string; sectors: string[]; cities: string[] }> = {
  CIV: { name: 'Cote d\'Ivoire', sectors: ['agriculture', 'food_processing'], cities: ['Abidjan', 'Bouake', 'Yamoussoukro'] },
  SEN: { name: 'Senegal', sectors: ['aquaculture', 'agriculture', 'textile'], cities: ['Dakar', 'Thies', 'Saint-Louis'] },
  MAR: { name: 'Maroc', sectors: ['textile', 'agriculture', 'renewable_energy'], cities: ['Casablanca', 'Marrakech', 'Tanger'] },
  NGA: { name: 'Nigeria', sectors: ['technology', 'agriculture', 'food_processing'], cities: ['Lagos', 'Abuja', 'Kano'] },
  GHA: { name: 'Ghana', sectors: ['agriculture', 'food_processing', 'artisan'], cities: ['Accra', 'Kumasi', 'Tamale'] },
  KEN: { name: 'Kenya', sectors: ['technology', 'agriculture', 'logistics'], cities: ['Nairobi', 'Mombasa', 'Kisumu'] },
  VNM: { name: 'Vietnam', sectors: ['textile', 'agriculture', 'aquaculture'], cities: ['Ho Chi Minh', 'Hanoi', 'Da Nang'] },
  COL: { name: 'Colombie', sectors: ['agriculture', 'food_processing', 'artisan'], cities: ['Bogota', 'Medellin', 'Cali'] },
  IDN: { name: 'Indonesie', sectors: ['agriculture', 'textile', 'aquaculture'], cities: ['Jakarta', 'Surabaya', 'Bandung'] },
  BRA: { name: 'Bresil', sectors: ['agriculture', 'food_processing', 'renewable_energy'], cities: ['Sao Paulo', 'Rio', 'Belo Horizonte'] },
  IND: { name: 'Inde', sectors: ['textile', 'technology', 'agriculture'], cities: ['Mumbai', 'Delhi', 'Bangalore'] },
  ETH: { name: 'Ethiopie', sectors: ['agriculture', 'textile', 'food_processing'], cities: ['Addis Ababa', 'Dire Dawa', 'Hawassa'] },
  TZA: { name: 'Tanzanie', sectors: ['agriculture', 'artisan', 'logistics'], cities: ['Dar es Salaam', 'Dodoma', 'Arusha'] },
  PHL: { name: 'Philippines', sectors: ['agriculture', 'aquaculture', 'technology'], cities: ['Manila', 'Cebu', 'Davao'] },
  MEX: { name: 'Mexique', sectors: ['agriculture', 'food_processing', 'textile'], cities: ['Mexico City', 'Guadalajara', 'Monterrey'] },
  EGY: { name: 'Egypte', sectors: ['textile', 'agriculture', 'logistics'], cities: ['Le Caire', 'Alexandrie', 'Giza'] },
  TUR: { name: 'Turquie', sectors: ['textile', 'agriculture', 'food_processing'], cities: ['Istanbul', 'Ankara', 'Izmir'] },
  BGD: { name: 'Bangladesh', sectors: ['textile', 'agriculture', 'aquaculture'], cities: ['Dhaka', 'Chittagong', 'Khulna'] },
  PER: { name: 'Perou', sectors: ['agriculture', 'artisan', 'aquaculture'], cities: ['Lima', 'Arequipa', 'Cusco'] },
  ECU: { name: 'Equateur', sectors: ['agriculture', 'aquaculture', 'food_processing'], cities: ['Quito', 'Guayaquil', 'Cuenca'] },
}

const PRODUCTS_BY_SECTOR: Record<string, string[]> = {
  agriculture: ['cacao', 'cafe', 'mangue', 'anacarde', 'huile_palme', 'riz', 'mais', 'coton'],
  textile: ['vetements', 'tissus', 'linge_maison', 'uniformes', 'accessoires'],
  food_processing: ['chocolat', 'jus_fruits', 'conserves', 'epices', 'sauces', 'snacks'],
  artisan: ['bijoux', 'poterie', 'vannerie', 'maroquinerie', 'bois_sculpte'],
  technology: ['fintech', 'agritech', 'edtech', 'healthtech', 'logistics_tech'],
  renewable_energy: ['solaire', 'biomasse', 'eolien', 'mini_hydro'],
  logistics: ['transport_maritime', 'entreposage', 'cold_chain', 'last_mile'],
  aquaculture: ['crevettes', 'tilapia', 'algues', 'huitres'],
}

function generateToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  providers = buildProviders()
  console.log(`[SCOUT] Providers: ${providers.map(p => p.name).join(', ')}`)

  const supabase = await getSupabase()
  const args = process.argv.slice(2)
  const countryArg = args.find(a => a.startsWith('--country='))?.split('=')[1]?.split(',')
  const sectorArg = args.find(a => a.startsWith('--sector='))?.split('=')[1]
  const countArg = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '50')

  const countries = countryArg || Object.keys(COUNTRY_PROFILES)
  const sectors = sectorArg ? [sectorArg] : SECTORS

  console.log(`[SCOUT] Target: ${countArg} entrepreneurs across ${countries.length} countries`)

  let generated = 0
  const batchSize = 5

  for (const iso of countries) {
    if (generated >= countArg) break
    const profile = COUNTRY_PROFILES[iso]
    if (!profile) continue

    const relevantSectors = sectors.filter(s => profile.sectors.includes(s))
    if (relevantSectors.length === 0) continue

    for (const sector of relevantSectors) {
      if (generated >= countArg) break
      const products = PRODUCTS_BY_SECTOR[sector] || []
      const batch = Math.min(batchSize, countArg - generated)

      const prompt = `Generate ${batch} realistic entrepreneur profiles for the ${sector} sector in ${profile.name}.
Each entrepreneur should be someone who would benefit from international trade data and business planning tools.

Return a JSON array with objects containing:
- full_name: realistic local name
- company_name: realistic company name (or null if solo entrepreneur)
- city: one of ${JSON.stringify(profile.cities)}
- sector: "${sector}"
- product_focus: 2-3 products from ${JSON.stringify(products)}
- hero_message: a personalized compelling message (in French) for this entrepreneur, max 100 chars
- executive_summary: 2-3 sentences about their business opportunity
- investment_low: number (EUR) for artisanal scenario
- investment_mid: number (EUR) for mechanized scenario
- investment_high: number (EUR) for AI-automated scenario
- monthly_revenue_low: number (EUR)
- monthly_revenue_mid: number (EUR)
- monthly_revenue_high: number (EUR)

Make profiles diverse, realistic, and specific to the local context.
Return ONLY the JSON array, no markdown.`

      try {
        const raw = await gen(prompt, 4096)
        const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        const entrepreneurs = JSON.parse(cleaned)

        for (const e of entrepreneurs) {
          if (generated >= countArg) break
          const token = generateToken()

          const demoData = {
            token,
            full_name: e.full_name,
            company_name: e.company_name,
            country_iso: iso,
            city: e.city,
            sector: e.sector,
            product_focus: e.product_focus,
            hero_message: e.hero_message,
            business_plan: {
              executive_summary: e.executive_summary,
              market_size: `Marche ${sector} en ${profile.name}`,
              competitive_advantage: `Position strategique en ${e.city} avec acces direct aux fournisseurs ${e.product_focus?.[0] || sector}`,
              scenarios: [
                { name: 'Artisanal', investment: `${e.investment_low || 5000} EUR`, monthly_revenue: `${e.monthly_revenue_low || 2000} EUR`, roi_months: Math.ceil((e.investment_low || 5000) / (e.monthly_revenue_low || 2000)), description: 'Demarrage leger, production manuelle, marche local + premiers exports' },
                { name: 'Mecanise', investment: `${e.investment_mid || 25000} EUR`, monthly_revenue: `${e.monthly_revenue_mid || 8000} EUR`, roi_months: Math.ceil((e.investment_mid || 25000) / (e.monthly_revenue_mid || 8000)), description: 'Semi-industriel, equipement moderne, export regional' },
                { name: 'AI-Automated', investment: `${e.investment_high || 100000} EUR`, monthly_revenue: `${e.monthly_revenue_high || 35000} EUR`, roi_months: Math.ceil((e.investment_high || 100000) / (e.monthly_revenue_high || 35000)), description: 'Full automation, IA qualite/logistique, export mondial' },
              ]
            },
            opportunities: pickRandom([
              { title: `Export ${e.product_focus?.[0] || 'produits'} vers Europe`, country: 'EU', potential: 'Demande croissante +15%/an', sector },
              { title: `Fournisseur certifie bio ${profile.name}`, country: iso, potential: 'Premium +40% prix', sector },
              { title: `Partenariat cooperative locale`, country: iso, potential: 'Volume x3, couts partages', sector },
              { title: `E-commerce B2B international`, country: 'GLOBAL', potential: 'Acces 50+ marches', sector },
              { title: `Transformation locale ${e.product_focus?.[1] || 'valeur ajoutee'}`, country: iso, potential: 'Marge +60% vs export brut', sector },
            ], 3),
            investors: pickRandom([
              { name: 'AfricInvest', type: 'VC', ticket_range: '50K-500K EUR', sectors: ['agriculture', 'technology'] },
              { name: 'Proparco', type: 'DFI', ticket_range: '100K-2M EUR', sectors: ['agriculture', 'renewable_energy', 'food_processing'] },
              { name: 'I&P Afrique', type: 'Impact Fund', ticket_range: '30K-300K EUR', sectors: ['artisan', 'agriculture', 'textile'] },
              { name: 'Oikocredit', type: 'Microfinance', ticket_range: '10K-100K EUR', sectors: ['agriculture', 'food_processing'] },
              { name: 'TechStars Africa', type: 'Accelerateur', ticket_range: '20K-150K EUR', sectors: ['technology', 'logistics'] },
              { name: 'Seedstars', type: 'VC Early Stage', ticket_range: '25K-200K EUR', sectors: ['technology', 'fintech'] },
              { name: 'Bamboo Capital', type: 'Impact Investor', ticket_range: '100K-1M EUR', sectors: ['renewable_energy', 'agriculture'] },
            ], 3),
            market_data: {
              population: profile.name,
              gdp_growth: '+4-7%',
              trade_volume: 'En croissance',
              key_imports: e.product_focus,
              key_exports: e.product_focus,
            },
            status: 'generated',
            source: 'scout',
            source_detail: `auto_${iso}_${sector}`,
          }

          const { error } = await supabase.from('entrepreneur_demos').insert(demoData)
          if (error) {
            console.error(`[SCOUT] Insert error: ${error.message}`)
          } else {
            generated++
            console.log(`[SCOUT] ${generated}/${countArg} | ${e.full_name} (${iso}/${sector}) → /demo/${token}`)
          }
        }
      } catch (err: any) {
        console.error(`[SCOUT] Error ${iso}/${sector}: ${err.message}`)
      }
    }
  }

  // Update metrics
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('scout_metrics').upsert({
    date: today,
    demos_generated: generated,
  }, { onConflict: 'date' })

  console.log(`\n[SCOUT] DONE — ${generated} entrepreneur demos generated`)
  console.log(`[SCOUT] URLs: /demo/{token} — ready for outreach`)
}

main().catch(console.error)
