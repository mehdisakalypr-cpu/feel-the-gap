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
  if (process.env.CEREBRAS_API_KEY) {
    const cerebras = createOpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1' })
    providers.push({ name: 'Cerebras', model: cerebras('llama-3.3-70b'), exhausted: false })
  }
  if (process.env.MISTRAL_API_KEY) {
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY })
    providers.push({ name: 'Mistral', model: mistral('mistral-small-latest'), exhausted: false })
  }
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    providers.push({ name: 'OpenAI', model: openai('gpt-4o-mini'), exhausted: false })
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
      const msg = (err.message ?? '').toLowerCase()
      // Retry on ANY error (rate limit, not found, API disabled, network, etc.)
      console.warn(`    [${p.name} fail: ${msg.slice(0, 60)}]`)
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        p.exhausted = true
      }
      idx = (idx + 1) % providers.length
    }
  }
  throw new Error('All providers exhausted')
}

async function generateOpportunitiesForCountry(
  countryIso: string,
  countryName: string,
  topImport: string,
  productIds: string[],
  locale: Locale = 'fr',
): Promise<any[]> {
  const productList = productIds.map(id => id.replace(/^\d+_/, '').replace(/_/g, ' ')).join(', ')

  const rawPrompt = `You are a trade intelligence analyst. Score these ${productIds.length} products as trade opportunities for ${countryName} (${countryIso}).

Known imports: ${topImport || 'general goods'}

Products to score: ${productList}

Score each 0-100 based on: market demand, competition, logistics, regulations.

Return ONLY valid JSON array (one entry per product, same order):
[{"score":75,"summary":"2-3 sentences about this opportunity in ${countryName}","market_size_usd":5000000}]`

  const prompt = localizeUserPrompt(rawPrompt, locale)
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
  const batchSize = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] ?? '30')
  const numProducts = parseInt(args.find(a => a.startsWith('--products='))?.split('=')[1] ?? '150')
  const delayMs = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '500')

  // Get all countries
  const { data: countries } = await sb
    .from('countries')
    .select('id, name, top_import_text')
    .order('name')

  if (!countries?.length) { console.error('No countries'); return }

  // Get existing product IDs from the products table
  const { data: products } = await sb
    .from('products')
    .select('id')
    .limit(numProducts)

  if (!products?.length) { console.error('No products in products table'); return }
  const productIds = products.map(p => p.id)

  let targets = countries
  if (batchNum > 0) {
    const start = (batchNum - 1) * batchSize
    targets = countries.slice(start, start + batchSize)
    console.log(`  Batch ${batchNum}: ${targets.length} countries (${start}-${start + targets.length - 1})`)
  }

  console.log(`  Countries: ${targets.length} | Products: ${productIds.length} | Delay: ${delayMs}ms`)

  // Pre-load existing (country, product) pairs to skip in-flight
  const existingPairs = new Set<string>()
  const { data: existing } = await sb.from('opportunities').select('country_iso, product_id')
  for (const row of existing ?? []) existingPairs.add(`${row.country_iso}|${row.product_id}`)
  console.log(`  Existing pairs in DB: ${existingPairs.size}\n`)

  let totalInserted = 0

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i]
    // Filter products not yet scored for this country
    const missingProductIds = productIds.filter(pid => !existingPairs.has(`${c.id}|${pid}`))
    if (missingProductIds.length === 0) {
      console.log(`  [${i + 1}/${targets.length}] ${c.name} (${c.id}) — all ${productIds.length} products scored, skip`)
      continue
    }
    console.log(`  [${i + 1}/${targets.length}] ${c.name} (${c.id}) — ${missingProductIds.length} missing...`)

    // Process in chunks of 25 to keep prompt small
    const CHUNK = 25
    let cAdded = 0
    for (let k = 0; k < missingProductIds.length; k += CHUNK) {
      const chunk = missingProductIds.slice(k, k + CHUNK)
      try {
        const scores = await generateOpportunitiesForCountry(c.id, c.name, c.top_import_text ?? '', chunk)
        const rows = []
        for (let j = 0; j < Math.min(scores.length, chunk.length); j++) {
          const s = scores[j]
          rows.push({
            country_iso: c.id,
            product_id: chunk[j],
            type: 'direct_trade',
            opportunity_score: Math.min(100, Math.max(0, s.score ?? 50)),
            gap_value_usd: s.market_size_usd ?? 0,
            summary: s.summary ?? '',
          })
        }
        if (rows.length) {
          const { error } = await sb.from('opportunities').insert(rows)
          if (!error) {
            totalInserted += rows.length
            cAdded += rows.length
            for (const r of rows) existingPairs.add(`${r.country_iso}|${r.product_id}`)
          } else if (!error.message.includes('duplicate')) {
            console.error(`    ✗ insert: ${error.message.slice(0, 100)}`)
          }
        }
      } catch (err: any) {
        console.error(`    ✗ chunk: ${err.message?.slice(0, 100)}`)
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
    console.log(`    +${cAdded} opps (total: ${totalInserted})`)
  }

  const { count } = await sb.from('opportunities').select('*', { count: 'exact', head: true })
  console.log(`\n═══ Inserted ${totalInserted} | Total in DB: ${count} ═══`)
}

if (process.argv[1]?.endsWith('opportunity-matrix.ts')) {
  main().catch(console.error)
}
