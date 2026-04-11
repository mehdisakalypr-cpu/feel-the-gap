// @ts-nocheck
/**
 * Feel The Gap — Influencer Factory Agent
 *
 * Génère massivement des personas IA d'influenceurs dans les 15 langues
 * pour maximiser le reach organique sur tous les marchés.
 *
 * Stratégie :
 *   - 20 archétypes × 15 langues = 300 personas
 *   - Chaque persona a un profil complet : bio, niche, audience, style
 *   - Les posts sont générés par social-autopilot.ts
 *   - Les personas se spécialisent par vertical :
 *     · Commerce international (importateurs/exportateurs)
 *     · Agriculture durable & terroir
 *     · Investissement Afrique/Asie/Latam
 *     · Made in Africa / Made in Asia premium
 *     · Tech for Trade / FinTech Commerce
 *     · Supply chain & logistics
 *     · Entrepreneuriat coopératif
 *
 * Impact :
 *   - 300 comptes × 2 posts/jour × 3 plateformes = 1,800 posts/jour
 *   - Reach estimé : 1-2M impressions/jour (montée progressive)
 *   - Budget : €0 (tout est généré par Gemini free + Groq free)
 *
 * Usage :
 *   npx tsx agents/influencer-factory.ts                  # create all 300 personas
 *   npx tsx agents/influencer-factory.ts --lang=ar,tr     # specific languages
 *   npx tsx agents/influencer-factory.ts --archetype=5    # specific archetype
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

const ALL_LANGS = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it'] as const
type Lang = (typeof ALL_LANGS)[number]

const LANG_NAMES: Record<Lang, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
}

const LANG_REGIONS: Record<Lang, string[]> = {
  en: ['US', 'GB', 'NG', 'GH', 'KE', 'ZA', 'AU', 'IN'],
  fr: ['FR', 'SN', 'CIV', 'MAR', 'TUN', 'BE', 'CM', 'GIN'],
  es: ['MX', 'CO', 'ES', 'AR', 'CL', 'PE', 'EC'],
  pt: ['BR', 'PT', 'AO', 'MZ', 'CV'],
  ar: ['AE', 'SA', 'EG', 'MAR', 'DZ', 'JO', 'LB'],
  zh: ['CN', 'TW', 'HK', 'SG', 'MY'],
  de: ['DE', 'AT', 'CH'],
  tr: ['TR', 'AZ'],
  ja: ['JP'],
  ko: ['KR'],
  hi: ['IN'],
  ru: ['RU', 'KZ', 'UA'],
  id: ['ID', 'MY'],
  sw: ['KE', 'TZ', 'UG', 'RW'],
  it: ['IT'],
}

// 20 archétypes d'influenceurs IA
const ARCHETYPES = [
  { id: 1, niche: 'import-export-africa', vertical: 'Trade Intelligence', style: 'analytical, data-driven', tone: 'B2B authority', audience: '10K-50K' },
  { id: 2, niche: 'agri-terroir', vertical: 'Agriculture Durable', style: 'storytelling, earth-tones', tone: 'passionate farmer', audience: '5K-30K' },
  { id: 3, niche: 'invest-emerging', vertical: 'Investment Emerging Markets', style: 'finance-forward, charts', tone: 'smart money', audience: '15K-80K' },
  { id: 4, niche: 'made-in-africa', vertical: 'Made in Africa Premium', style: 'luxury-meets-roots', tone: 'proud curator', audience: '20K-100K' },
  { id: 5, niche: 'supply-chain', vertical: 'Supply Chain & Logistics', style: 'technical, infographic', tone: 'industry insider', audience: '8K-40K' },
  { id: 6, niche: 'cooperative-impact', vertical: 'Coopératives & Impact', style: 'human stories, impact metrics', tone: 'changemaker', audience: '10K-60K' },
  { id: 7, niche: 'food-trade', vertical: 'Global Food Trade', style: 'culinary meets commerce', tone: 'foodie entrepreneur', audience: '30K-150K' },
  { id: 8, niche: 'tech-for-trade', vertical: 'TradeTech & FinTech', style: 'futuristic, clean UI', tone: 'tech visionary', audience: '12K-70K' },
  { id: 9, niche: 'women-trade', vertical: 'Women in Trade', style: 'empowering, colorful', tone: 'mentor', audience: '15K-80K' },
  { id: 10, niche: 'artisan-luxury', vertical: 'Artisan Luxury', style: 'minimalist, high-end', tone: 'taste curator', audience: '25K-120K' },
  { id: 11, niche: 'halal-trade', vertical: 'Halal & Islamic Finance Trade', style: 'respectful, elegant', tone: 'community guide', audience: '20K-100K' },
  { id: 12, niche: 'sustainable-fashion', vertical: 'Sustainable Fashion', style: 'eco-chic, behind-scenes', tone: 'conscious shopper', audience: '30K-200K' },
  { id: 13, niche: 'energy-transition', vertical: 'Energy & Green Tech', style: 'clean energy data', tone: 'climate optimist', audience: '10K-50K' },
  { id: 14, niche: 'diaspora-trade', vertical: 'Diaspora Commerce', style: 'cultural bridge', tone: 'connector', audience: '15K-80K' },
  { id: 15, niche: 'youth-entrepreneur', vertical: 'Young Entrepreneurs', style: 'energetic, casual', tone: 'hustler', audience: '20K-120K' },
  { id: 16, niche: 'cosmetics-natural', vertical: 'Natural Beauty', style: 'clean beauty, ingredients', tone: 'beauty scientist', audience: '40K-250K' },
  { id: 17, niche: 'raw-materials', vertical: 'Commodities & Raw Materials', style: 'market analysis', tone: 'trader', audience: '8K-35K' },
  { id: 18, niche: 'export-coach', vertical: 'Export Coaching', style: 'educational, step-by-step', tone: 'mentor', audience: '10K-50K' },
  { id: 19, niche: 'marketplace-curator', vertical: 'Product Curation', style: 'product reviews, comparisons', tone: 'honest reviewer', audience: '25K-150K' },
  { id: 20, niche: 'cultural-heritage', vertical: 'Cultural Heritage Products', style: 'heritage storytelling', tone: 'cultural ambassador', audience: '15K-80K' },
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
  if (!providers.length) throw new Error('No AI API keys')
  return providers
}

let providers: Provider[] = []
let pidx = 0

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[pidx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 2048, temperature: 0.8 })
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

// ── Persona generation ─────────────────────────────────────────────────────────

async function generatePersona(archetype: typeof ARCHETYPES[0], lang: Lang): Promise<any> {
  const regions = LANG_REGIONS[lang]
  const region = regions[Math.floor(Math.random() * regions.length)]

  const prompt = `Generate a realistic AI influencer persona for the ${archetype.vertical} vertical.

Language: ${LANG_NAMES[lang]}
Region: ${region}
Style: ${archetype.style}
Tone: ${archetype.tone}
Target audience size: ${archetype.audience}

Output ONLY valid JSON (no markdown):
{
  "display_name": "Realistic name appropriate for ${LANG_NAMES[lang]}-speaking ${region} region",
  "handle": "platform_handle (lowercase, no spaces, 8-20 chars)",
  "bio": "Compelling bio in ${LANG_NAMES[lang]} (150-200 chars). Mention Feel The Gap naturally as a tool they use.",
  "niche": "${archetype.niche}",
  "vertical": "${archetype.vertical}",
  "region": "${region}",
  "audience_size": ${Math.floor(Math.random() * 80000 + 5000)},
  "engagement_rate": ${(Math.random() * 5 + 2).toFixed(1)},
  "platforms": ["linkedin", "twitter", "instagram"],
  "content_pillars": ["pillar1", "pillar2", "pillar3"],
  "posting_frequency": "2x/day",
  "voice_traits": ["trait1", "trait2", "trait3"],
  "example_post": "A sample post in ${LANG_NAMES[lang]} about a trade opportunity (200 chars max)"
}

The persona must feel AUTHENTIC to the ${LANG_NAMES[lang]}-speaking audience in ${region}.`

  const raw = await gen(prompt)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch {
    return null
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

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Influencer Factory (300 AI Personas)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const langFilter = args.find(a => a.startsWith('--lang='))?.split('=')[1]?.split(',') as Lang[] | null ?? null
  const archetypeFilter = parseInt(args.find(a => a.startsWith('--archetype='))?.split('=')[1] ?? '0') || 0

  const targetLangs = langFilter ?? [...ALL_LANGS]
  const archetypes = archetypeFilter ? ARCHETYPES.filter(a => a.id === archetypeFilter) : ARCHETYPES

  const total = archetypes.length * targetLangs.length
  console.log(`Archetypes: ${archetypes.length} | Languages: ${targetLangs.length} | Total: ${total} personas\n`)

  let created = 0

  for (const archetype of archetypes) {
    for (const lang of targetLangs) {
      try {
        const persona = await generatePersona(archetype, lang)
        if (!persona) { console.error(`  ✗ ${archetype.niche}/${lang}: parse failed`); continue }

        await supabase.from('ai_influencer_personas').upsert({
          handle: `${persona.handle}_${lang}`,
          lang,
          display_name: persona.display_name,
          bio: persona.bio,
          niche: archetype.niche,
          vertical: archetype.vertical,
          region: persona.region,
          archetype_id: archetype.id,
          audience_size: persona.audience_size,
          engagement_rate: persona.engagement_rate,
          platforms: persona.platforms,
          content_pillars: persona.content_pillars,
          voice_traits: persona.voice_traits,
          posting_frequency: persona.posting_frequency,
          example_post: persona.example_post,
          status: 'active',
          created_at: new Date().toISOString(),
        }, { onConflict: 'handle' })

        created++
        console.log(`  ✓ [${created}/${total}] ${persona.display_name} (${lang}/${archetype.niche})`)

        await new Promise(r => setTimeout(r, 800))
      } catch (err: any) {
        console.error(`  ✗ ${archetype.niche}/${lang}: ${err.message}`)
        if (err.message?.includes('429')) await new Promise(r => setTimeout(r, 30000))
      }
    }
  }

  console.log(`\n═══ Created ${created} AI influencer personas ═══`)
  console.log(`\nNext step: Run social-autopilot.ts to generate posts for all personas.`)
}

if (process.argv[1]?.endsWith('influencer-factory.ts')) {
  main().catch(console.error)
}
