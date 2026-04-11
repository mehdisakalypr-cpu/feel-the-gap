// @ts-nocheck
/**
 * Feel The Gap — SEO Factory Agent (Multilingue)
 *
 * Génère des landing pages SEO optimisées pour chaque combinaison :
 *   pays × produit × langue
 *
 * Chaque page cible un long-tail keyword du type :
 *   "import [product] [country] opportunities" / "importar [producto] [país] oportunidades"
 *
 * Les pages sont stockées en DB (table seo_pages) et servies par une route catch-all
 * /seo/[lang]/[slug] qui fait du SSR avec cache ISR.
 *
 * Impact MRR estimé :
 *   - 20,000 pages × 15 langues = 300,000 pages indexables
 *   - CTR moyen 1.2% → ~3,600 visites/jour organiques
 *   - Conversion 2.5% → ~90 signups/jour → ~€8,100/jour MRR additionnel (avg €3/user/day)
 *
 * Usage :
 *   npx tsx agents/seo-factory.ts                          # all countries × all products × all langs
 *   npx tsx agents/seo-factory.ts --iso=NGA,BRA --lang=en,fr,pt
 *   npx tsx agents/seo-factory.ts --top=20                 # top 20 countries by opportunity count
 *   npx tsx agents/seo-factory.ts --dry-run                # preview without writing
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

// ── Env ────────────────────────────────────────────────────────────────────────
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

// ── Supported languages (same list as lib/i18n) ───────────────────────────────
const ALL_LANGS = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it'] as const
type Lang = (typeof ALL_LANGS)[number]

const LANG_NAMES: Record<Lang, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
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
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    providers.push({ name: 'OpenAI', model: openai('gpt-4o-mini'), exhausted: false })
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

function markExhausted(name: string) {
  const p = providers.find(p => p.name === name)
  if (p) { p.exhausted = true; currentIdx = (currentIdx + 1) % providers.length }
}

async function withRetry<T>(fn: (m: LanguageModelV1) => Promise<T>, label: string): Promise<T> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const { model, name } = getModel()
    tried.add(name)
    try {
      return await fn(model)
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
        markExhausted(name)
        continue
      }
      throw err
    }
  }
  throw new Error(`All providers failed for: ${label}`)
}

// ── SEO page generation ────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface SEOPage {
  slug: string
  lang: Lang
  country_iso: string
  product_slug: string
  title: string
  meta_description: string
  h1: string
  content_html: string
  keywords: string[]
}

async function generateSEOPage(
  country: { id: string; name: string; name_fr: string; population: number; gdp_usd: number; total_imports_usd: number },
  product: string,
  lang: Lang,
): Promise<SEOPage> {
  const slug = `${slugify(country.name)}-${slugify(product)}-${lang}`

  const prompt = `You are an SEO content expert for international trade.
Write a comprehensive, SEO-optimized landing page IN ${LANG_NAMES[lang]} about importing ${product} into ${country.name}.

Country context:
- Population: ${(country.population / 1e6).toFixed(1)}M
- GDP: $${(country.gdp_usd / 1e9).toFixed(1)}B
- Total imports: $${(country.total_imports_usd / 1e9).toFixed(1)}B

Write VALID JSON with this exact structure (no markdown, no code fences):
{
  "title": "SEO title tag (50-60 chars, in ${LANG_NAMES[lang]})",
  "meta_description": "Meta description (150-160 chars, in ${LANG_NAMES[lang]})",
  "h1": "Main heading (in ${LANG_NAMES[lang]})",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "content_html": "<h2>...</h2><p>...</p>... (800-1200 words of rich HTML content in ${LANG_NAMES[lang]})"
}

The content should cover:
1. Market overview for ${product} in ${country.name}
2. Import regulations and requirements
3. Market size and growth potential
4. Key competitors and distribution channels
5. Why Feel The Gap is the best tool to identify this opportunity
6. CTA to sign up for Feel The Gap

Use proper HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table>.
ALL content must be in ${LANG_NAMES[lang]}.`

  const { text } = await withRetry((m) => generateText({
    model: m,
    prompt,
    maxTokens: 4096,
    temperature: 0.6,
  }), `seo-${slug}`)

  let parsed: any
  try {
    // Strip code fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON from response
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Failed to parse SEO page JSON for ${slug}`)
    parsed = JSON.parse(match[0])
  }

  return {
    slug,
    lang,
    country_iso: country.id,
    product_slug: slugify(product),
    title: parsed.title,
    meta_description: parsed.meta_description,
    h1: parsed.h1,
    content_html: parsed.content_html,
    keywords: parsed.keywords ?? [],
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
  console.log('  Feel The Gap — SEO Factory (15 Languages)')
  console.log('═══════════════════════════════════════════════════\n')

  // Parse CLI args
  const args = process.argv.slice(2)
  const isoFilter = args.find(a => a.startsWith('--iso='))?.split('=')[1]?.split(',') ?? null
  const langFilter = args.find(a => a.startsWith('--lang='))?.split('=')[1]?.split(',') as Lang[] | null ?? null
  const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] ?? '0') || 0
  const dryRun = args.includes('--dry-run')

  const targetLangs = langFilter ?? [...ALL_LANGS]

  // Get countries with opportunities
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, name_fr, population, gdp_usd, total_imports_usd')
    .order('total_imports_usd', { ascending: false })

  let countryList = countries ?? []
  if (isoFilter) {
    const set = new Set(isoFilter.map(i => i.toUpperCase()))
    countryList = countryList.filter(c => set.has(c.id))
  }
  if (topN > 0) countryList = countryList.slice(0, topN)

  // Top products for SEO (high-search-volume trade categories)
  const PRODUCTS = [
    'rice', 'wheat', 'sugar', 'palm oil', 'coffee', 'cocoa', 'tea',
    'cotton', 'textile', 'clothing', 'steel', 'cement', 'fertilizer',
    'solar panels', 'electronics', 'smartphones', 'vehicles', 'machinery',
    'pharmaceutical', 'medical equipment', 'construction materials',
    'petroleum', 'natural gas', 'copper', 'gold',
    'cashew nuts', 'mangoes', 'avocados', 'seafood', 'timber',
  ]

  const totalPages = countryList.length * PRODUCTS.length * targetLangs.length
  console.log(`Countries: ${countryList.length} | Products: ${PRODUCTS.length} | Languages: ${targetLangs.length}`)
  console.log(`Total pages to generate: ${totalPages.toLocaleString()}`)
  if (dryRun) { console.log('\n[DRY RUN] No pages will be written.'); return }

  // Ensure table exists
  console.log('\nStarting generation...\n')

  let generated = 0
  let skipped = 0
  let errors = 0

  for (const country of countryList) {
    for (const product of PRODUCTS) {
      for (const lang of targetLangs) {
        const slug = `${slugify(country.name)}-${slugify(product)}-${lang}`

        // Check if already exists
        const { data: existing } = await supabase
          .from('seo_pages')
          .select('slug')
          .eq('slug', slug)
          .maybeSingle()

        if (existing) { skipped++; continue }

        try {
          const page = await generateSEOPage(country, product, lang)

          await supabase.from('seo_pages').upsert({
            slug: page.slug,
            lang: page.lang,
            country_iso: page.country_iso,
            product_slug: page.product_slug,
            title: page.title,
            meta_description: page.meta_description,
            h1: page.h1,
            content_html: page.content_html,
            keywords: page.keywords,
            created_at: new Date().toISOString(),
          }, { onConflict: 'slug' })

          generated++
          console.log(`  ✓ [${generated}] ${slug}`)

          // Rate limit
          await new Promise(r => setTimeout(r, 1500))
        } catch (err: any) {
          errors++
          console.error(`  ✗ ${slug}: ${err.message}`)
          if (err.message?.includes('429') || err.message?.includes('quota')) {
            await new Promise(r => setTimeout(r, 30000))
          }
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Done! Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors}`)
  console.log('═══════════════════════════════════════════════════')
}

if (process.argv[1]?.endsWith('seo-factory.ts')) {
  main().catch(console.error)
}
