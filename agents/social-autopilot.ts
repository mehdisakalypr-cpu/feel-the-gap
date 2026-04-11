// @ts-nocheck
/**
 * Feel The Gap — Social Media Autopilot Agent (15 Languages)
 *
 * Génère automatiquement du contenu social media dans les 15 langues
 * pour chaque plateforme : LinkedIn, Twitter/X, Instagram.
 *
 * Stratégie de contenu :
 *   1. Market Insights — "Le Nigeria importe $3.2B de riz/an. Qui en profite ?" (engagement)
 *   2. Success Stories — Cas d'utilisation FTG (conversion)
 *   3. Data Drops — Statistiques impressionnantes (viralité)
 *   4. CTA Posts — Invitation directe à s'inscrire (acquisition)
 *
 * Cadence : 3 posts/jour × 15 langues × 3 plateformes = 135 contenus/jour
 *
 * Impact MRR estimé :
 *   - Reach organique : ~500K impressions/jour (cumulé toutes langues)
 *   - Click-through 0.8% → 4,000 visites/jour
 *   - Conversion 3% → 120 signups/jour → ~€10,800/jour MRR
 *
 * Usage :
 *   npx tsx agents/social-autopilot.ts                    # generate today's batch
 *   npx tsx agents/social-autopilot.ts --lang=ar,tr,id    # specific languages
 *   npx tsx agents/social-autopilot.ts --platform=linkedin
 *   npx tsx agents/social-autopilot.ts --dry-run
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const ALL_LANGS = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it'] as const
type Lang = (typeof ALL_LANGS)[number]
type Platform = 'linkedin' | 'twitter' | 'instagram'
type ContentType = 'market_insight' | 'data_drop' | 'success_story' | 'cta'

const LANG_NAMES: Record<Lang, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
}

const PLATFORM_SPECS: Record<Platform, { maxChars: number; hashtagCount: number; style: string }> = {
  linkedin: { maxChars: 3000, hashtagCount: 5, style: 'professional, data-driven, thought leadership' },
  twitter: { maxChars: 280, hashtagCount: 3, style: 'punchy, provocative, data hooks' },
  instagram: { maxChars: 2200, hashtagCount: 15, style: 'visual storytelling, emoji-rich, inspiring' },
}

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
  if (providers.length === 0) throw new Error('No AI API keys configured')
  return providers
}

let providers: Provider[] = []
let currentIdx = 0

function getModel(): { model: LanguageModelV1; name: string } {
  const start = currentIdx
  do {
    const p = providers[currentIdx]
    if (!p.exhausted) return { model: p.model, name: p.name }
    currentIdx = (currentIdx + 1) % providers.length
  } while (currentIdx !== start)
  throw new Error('All providers exhausted')
}

async function generate(prompt: string, label: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const { model, name } = getModel()
    tried.add(name)
    try {
      const { text } = await generateText({ model, prompt, maxTokens: 2048, temperature: 0.8 })
      return text
    } catch (err: any) {
      const msg = err.message?.toLowerCase() ?? ''
      if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
        const p = providers.find(p => p.name === name)
        if (p) p.exhausted = true
        currentIdx = (currentIdx + 1) % providers.length
        continue
      }
      throw err
    }
  }
  throw new Error(`All providers failed for: ${label}`)
}

// ── Content generation ─────────────────────────────────────────────────────────

interface SocialPost {
  lang: Lang
  platform: Platform
  content_type: ContentType
  text: string
  hashtags: string[]
  cta_url: string
  scheduled_at: string
}

async function generatePost(
  lang: Lang,
  platform: Platform,
  contentType: ContentType,
  countryData: { name: string; total_imports_usd: number; opportunities_count: number },
  product: string,
): Promise<SocialPost> {
  const spec = PLATFORM_SPECS[platform]

  const typeInstructions: Record<ContentType, string> = {
    market_insight: `Write a market insight post about ${product} imports in ${countryData.name} ($${(countryData.total_imports_usd / 1e9).toFixed(1)}B total imports). Start with a surprising data point. Ask a thought-provoking question.`,
    data_drop: `Write a data-driven post sharing an impressive statistic about ${product} trade opportunities in ${countryData.name}. Use numbers prominently. Make it shareable.`,
    success_story: `Write a post about how an entrepreneur used trade data to identify a ${product} opportunity in ${countryData.name}. Make it relatable and inspiring. Mention Feel The Gap as the tool.`,
    cta: `Write a direct call-to-action post inviting importers/exporters of ${product} to discover opportunities in ${countryData.name} using Feel The Gap. Include urgency.`,
  }

  const prompt = `You are a social media expert for B2B trade intelligence.
${typeInstructions[contentType]}

Platform: ${platform} (${spec.style})
Language: Write ENTIRELY in ${LANG_NAMES[lang]}
Max characters: ${spec.maxChars}
Include exactly ${spec.hashtagCount} relevant hashtags in ${LANG_NAMES[lang]} (or universal trade hashtags).

Output ONLY valid JSON:
{
  "text": "the post text including hashtags",
  "hashtags": ["tag1", "tag2", ...]
}

Important: The text MUST be in ${LANG_NAMES[lang]}. No English mixing unless it's a brand name (Feel The Gap).`

  const raw = await generate(prompt, `social-${platform}-${lang}-${contentType}`)

  let parsed: any
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : cleaned)
  } catch {
    parsed = { text: raw.slice(0, spec.maxChars), hashtags: [] }
  }

  // Schedule: distribute across the day (9h, 13h, 18h local-ish)
  const hours = [9, 13, 18]
  const hour = hours[Math.floor(Math.random() * hours.length)]
  const scheduled = new Date()
  scheduled.setHours(hour, Math.floor(Math.random() * 60), 0, 0)
  if (scheduled < new Date()) scheduled.setDate(scheduled.getDate() + 1)

  return {
    lang,
    platform,
    content_type: contentType,
    text: parsed.text?.slice(0, spec.maxChars) ?? '',
    hashtags: parsed.hashtags ?? [],
    cta_url: `https://feel-the-gap.com/?ref=social&lang=${lang}&platform=${platform}`,
    scheduled_at: scheduled.toISOString(),
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

  console.log('═══════════════════════════════════════════════════')
  console.log('  Feel The Gap — Social Autopilot (15 Languages)')
  console.log('═══════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const langFilter = args.find(a => a.startsWith('--lang='))?.split('=')[1]?.split(',') as Lang[] | null ?? null
  const platformFilter = args.find(a => a.startsWith('--platform='))?.split('=')[1]?.split(',') as Platform[] | null ?? null
  const dryRun = args.includes('--dry-run')

  const targetLangs = langFilter ?? [...ALL_LANGS]
  const targetPlatforms: Platform[] = platformFilter ?? ['linkedin', 'twitter', 'instagram']
  const contentTypes: ContentType[] = ['market_insight', 'data_drop', 'success_story', 'cta']

  // Get top countries by import volume for content
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, total_imports_usd')
    .order('total_imports_usd', { ascending: false })
    .limit(30)

  // Get opportunity counts
  const { data: oppCounts } = await supabase
    .from('opportunities')
    .select('country_iso')

  const countMap: Record<string, number> = {}
  for (const o of (oppCounts ?? [])) {
    countMap[o.country_iso] = (countMap[o.country_iso] ?? 0) + 1
  }

  const TRENDING_PRODUCTS = ['cocoa', 'rice', 'solar panels', 'textiles', 'coffee', 'cashew nuts', 'electronics', 'cement']

  console.log(`Languages: ${targetLangs.length} | Platforms: ${targetPlatforms.length}`)
  console.log(`Posts to generate: ${targetLangs.length * targetPlatforms.length * 3} (3 per lang×platform)\n`)

  if (dryRun) { console.log('[DRY RUN] Exiting.'); return }

  let generated = 0

  for (const lang of targetLangs) {
    for (const platform of targetPlatforms) {
      // Pick 3 random content types for variety
      const selectedTypes = contentTypes
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)

      for (const contentType of selectedTypes) {
        const country = countries?.[Math.floor(Math.random() * Math.min(20, countries?.length ?? 1))]
        const product = TRENDING_PRODUCTS[Math.floor(Math.random() * TRENDING_PRODUCTS.length)]

        if (!country) continue

        try {
          const post = await generatePost(
            lang, platform, contentType,
            { name: country.name, total_imports_usd: country.total_imports_usd ?? 0, opportunities_count: countMap[country.id] ?? 0 },
            product,
          )

          await supabase.from('social_posts').insert({
            lang: post.lang,
            platform: post.platform,
            content_type: post.content_type,
            text: post.text,
            hashtags: post.hashtags,
            cta_url: post.cta_url,
            scheduled_at: post.scheduled_at,
            status: 'pending',
            created_at: new Date().toISOString(),
          })

          generated++
          console.log(`  ✓ [${generated}] ${platform}/${lang}/${contentType}`)

          await new Promise(r => setTimeout(r, 1000))
        } catch (err: any) {
          console.error(`  ✗ ${platform}/${lang}/${contentType}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n═══ Generated ${generated} social posts ═══`)
}

if (process.argv[1]?.endsWith('social-autopilot.ts')) {
  main().catch(console.error)
}
