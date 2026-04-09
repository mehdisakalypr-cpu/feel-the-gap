// @ts-nocheck
/**
 * Feel The Gap — Batch Report & Business Plan Generator
 *
 * Generates country reports (reports table) and business plans (business_plans table)
 * for all countries/opportunities that don't have them yet.
 *
 * Run: cd /var/www/feel-the-gap && npx tsx agents/batch-runner.ts
 */

import { createClient } from '@supabase/supabase-js'
import { createGroq } from '@ai-sdk/groq'
import { google } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createMistral } from '@ai-sdk/mistral'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import * as fs from 'fs'
import * as path from 'path'

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found')
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

// ── Supabase admin client ─────────────────────────────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── Concurrency limiter ───────────────────────────────────────────────────────
async function runConcurrent<T>(
  items: T[],
  fn: (item: T, idx: number) => Promise<void>,
  concurrency = 3
) {
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i], i).catch(e => console.error(`  [ERROR] item ${i}:`, e.message))
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

// ── Multi-provider rotation ──────────────────────────────────────────────────
interface Provider {
  name: string
  model: LanguageModelV1
  exhausted: boolean
}

function buildProviders(): Provider[] {
  const providers: Provider[] = []
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    providers.push({ name: 'Groq/Llama-3.3-70B', model: groq('llama-3.3-70b-versatile'), exhausted: false })
  }
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
    providers.push({ name: 'OpenAI/GPT-4o-mini', model: openai('gpt-4o-mini'), exhausted: false })
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push({ name: 'Google/Gemini-2.0-Flash', model: google('gemini-2.5-flash'), exhausted: false })
  }
  if (process.env.MISTRAL_API_KEY) {
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY })
    providers.push({ name: 'Mistral/Small', model: mistral('mistral-small-latest'), exhausted: false })
  }
  if (process.env.TOGETHER_API_KEY) {
    const together = createTogetherAI({ apiKey: process.env.TOGETHER_API_KEY })
    providers.push({ name: 'Together/Llama-3.1-70B', model: together('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'), exhausted: false })
  }
  if (providers.length === 0) throw new Error('No AI API keys configured')
  return providers
}

const providers = buildProviders()
let currentProviderIdx = 0

function getModel(): { model: LanguageModelV1; name: string } {
  // Find next non-exhausted provider
  const start = currentProviderIdx
  do {
    const p = providers[currentProviderIdx]
    if (!p.exhausted) return { model: p.model, name: p.name }
    currentProviderIdx = (currentProviderIdx + 1) % providers.length
  } while (currentProviderIdx !== start)
  // All exhausted — reset and try again (quotas may have refreshed)
  throw new Error('All providers exhausted. Try again later.')
}

function markExhausted(providerName: string) {
  const p = providers.find(p => p.name === providerName)
  if (p) {
    p.exhausted = true
    console.log(`  ⚠ ${providerName} quota exhausted — rotating to next provider`)
    currentProviderIdx = (currentProviderIdx + 1) % providers.length
  }
}

// ── Retry with provider rotation ────────────────────────────────────────────
async function withRetry<T>(fn: (model: LanguageModelV1) => Promise<T>, label: string, maxRetries = 3): Promise<T> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const { model, name } = getModel()
    tried.add(name)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(model)
      } catch (err: unknown) {
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
        const isRateLimit = msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('resource_exhausted')
        if (isRateLimit && attempt < maxRetries) {
          const wait = attempt * 10000
          console.log(`  [${name} rate limit ${label}, attempt ${attempt}/${maxRetries}, waiting ${wait/1000}s]`)
          await new Promise(r => setTimeout(r, wait))
        } else if (isRateLimit) {
          markExhausted(name)
          break // try next provider
        } else {
          throw err
        }
      }
    }
  }
  throw new Error(`All providers failed for: ${label}`)
}

const DELAY_BETWEEN_CALLS = 4000 // 4s between API calls

// ── Country Report Generator ──────────────────────────────────────────────────
async function generateCountryReport(country: any, opps: any[]): Promise<string> {
  const oppList = opps.map(o =>
    `- ${o.products?.name_fr ?? o.product_id}: score ${o.opportunity_score}/100, gap $${((o.gap_value_usd ?? 0) / 1e6).toFixed(0)}M/yr`
  ).join('\n')

  const { text } = await withRetry((m) => generateText({
    model: m,
    prompt: `Generate a professional trade intelligence report in HTML format for ${country.name_fr}.

Data:
- Total imports: $${((country.total_imports_usd ?? 0) / 1e9).toFixed(1)}B
- Total exports: $${((country.total_exports_usd ?? 0) / 1e9).toFixed(1)}B
- Top import category: ${country.top_import_category ?? 'unknown'}
- GDP: $${((country.gdp_usd ?? 0) / 1e9).toFixed(0)}B
- Population: ${((country.population ?? 0) / 1e6).toFixed(1)}M
- Top imports: ${country.top_import_text ?? 'N/A'}

Top opportunities:
${oppList || 'No opportunities yet'}

Write a detailed 800-1200 word HTML report with sections:
1. Country Trade Profile
2. Key Import Dependencies
3. Top Business Opportunities (reference the data above)
4. Market Entry Considerations
5. Outlook & Recommendations

Use professional styling inline (dark theme: background #111827, text #F9FAFB, accent #C9A84C, font-family: system-ui, sans-serif).
Return only the HTML content (no <!DOCTYPE> or <html> wrapper).`,
    maxTokens: 2500,
  }), country.name_fr)

  return text
}

// ── Business Plan Generator ───────────────────────────────────────────────────
async function buildTradePlan(opp: any, productName: string, countryName: string) {
  const { text } = await withRetry((m) => generateText({
    model: m,
    prompt: `You are a global trade consultant. Generate a detailed direct trade business plan in JSON format.

Country: ${countryName}
Product: ${productName}
Annual import gap: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Current avg import price: ${opp.avg_import_price_usd_tonne ? '$' + opp.avg_import_price_usd_tonne + '/tonne' : 'unknown'}

Return ONLY valid JSON with this structure:
{
  "title": "string",
  "executive_summary": "string (2-3 paragraphs)",
  "suppliers": [{ "country": "string", "companies": ["string"], "price_usd_tonne": number, "incoterm": "string", "notes": "string" }],
  "logistics": { "shipping_routes": ["string"], "freight_cost_usd_tonne": number, "customs_duties_pct": number, "lead_time_days": number, "warehousing_notes": "string" },
  "financial_model": { "purchase_price_usd_tonne": number, "total_landed_cost_usd_tonne": number, "suggested_selling_price_usd_tonne": number, "gross_margin_pct": number, "annual_volume_tonnes": number, "annual_revenue_usd": number, "annual_profit_usd": number },
  "risks": ["string"],
  "next_steps": ["string"]
}`,
    maxTokens: 2000,
  }), `trade-${productName}`)
  try { return JSON.parse(text.replace(/```json\n?|\n?```/g, '')) } catch { return { raw: text } }
}

async function buildProductionPlan(opp: any, productName: string, countryName: string) {
  const { text } = await withRetry((m) => generateText({
    model: m,
    prompt: `You are an investment consultant. Generate a local production business plan in JSON format.

Country: ${countryName}
Product: ${productName}
Annual import gap: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Land availability: ${opp.land_availability ?? 'medium'}
Labor cost index (1-100, lower=cheaper): ${opp.labor_cost_index ?? 40}

Focus on Chinese machinery (cost-effective). 3 investment tiers: cost_effective, balanced, high_tech.

Return ONLY valid JSON:
{
  "title": "string",
  "executive_summary": "string",
  "production_setup": { "land_required_ha": number, "location_recommendation": "string", "climate_requirements": "string" },
  "machinery_options": [{ "tier": "cost_effective|balanced|high_tech", "description": "string", "suppliers": [{ "name": "string", "country": "CN", "model": "string", "price_usd": number }], "automation_level": "low|medium|high", "annual_capacity_tonnes": number, "employees_needed": number }],
  "financial_models": {
    "cost_effective": { "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number, "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number },
    "balanced": { "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number, "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number },
    "high_tech": { "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number, "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number }
  },
  "staffing": { "total_employees": number, "roles": [{ "role": "string", "count": number, "monthly_salary_usd": number }] },
  "risks_and_mitigations": [{ "risk": "string", "mitigation": "string" }],
  "next_steps": ["string"]
}`,
    maxTokens: 3000,
  }), `prod-${productName}`)
  try { return JSON.parse(text.replace(/```json\n?|\n?```/g, '')) } catch { return { raw: text } }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Feel The Gap Batch Generator ===')
  console.log(`Providers: ${providers.map(p => p.name).join(' → ')}\n`)

  // Fetch existing reports & plans to skip
  const [{ data: existingReports }, { data: existingPlans }, { data: countries }, { data: allOpps }] = await Promise.all([
    sb.from('reports').select('country_iso'),
    sb.from('business_plans').select('opportunity_id'),
    sb.from('countries').select('*').order('name_fr'),
    sb.from('opportunities').select('*, products(name_fr, category), countries(name_fr)')
      .order('opportunity_score', { ascending: false }),
  ])

  const doneReports = new Set((existingReports ?? []).map(r => r.country_iso))
  const donePlans = new Set((existingPlans ?? []).map(p => p.opportunity_id))

  // Countries that need reports (have opportunities)
  const countriesWithOpps = [...new Set((allOpps ?? []).map(o => o.country_iso))]
  const countriesNeedingReports = (countries ?? []).filter(c =>
    countriesWithOpps.includes(c.id) && !doneReports.has(c.id)
  )
  const oppsNeedingPlans = (allOpps ?? []).filter(o => !donePlans.has(o.id))

  console.log(`Reports to generate: ${countriesNeedingReports.length} (${doneReports.size} already done)`)
  console.log(`Business plans to generate: ${oppsNeedingPlans.length} (${donePlans.size} already done)\n`)

  // ── Phase 1: Country Reports ───────────────────────────────────────────────
  if (countriesNeedingReports.length > 0) {
    console.log('── Phase 1: Country Reports ─────────────────────────────')
    let reportsDone = 0

    await runConcurrent(countriesNeedingReports, async (country, i) => {
      const countryOpps = (allOpps ?? []).filter(o => o.country_iso === country.id)
        .map(o => ({ ...o, products: o.products }))

      console.log(`[${i + 1}/${countriesNeedingReports.length}] Generating report: ${country.name_fr}...`)

      const contentHtml = await generateCountryReport(country, countryOpps)
      const topOpp = countryOpps[0]

      const { error } = await sb.from('reports').insert({
        country_iso: country.id,
        title: `Rapport commerce international — ${country.name_fr}`,
        summary: `Analyse des opportunités d'import/export pour ${country.name_fr}. PIB: $${((country.gdp_usd ?? 0) / 1e9).toFixed(0)}B, imports totaux: $${((country.total_imports_usd ?? 0) / 1e9).toFixed(1)}B.`,
        tier_required: 'basic',
        content_html: contentHtml,
        data_year: 2024,
      })

      // Rate limit delay between reports
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS))

      if (error) {
        console.error(`  [ERROR] ${country.name_fr}:`, error.message)
      } else {
        reportsDone++
        console.log(`  ✓ ${country.name_fr} (${reportsDone} done)`)
      }
    }, 1)

    console.log(`\nReports complete: ${reportsDone}/${countriesNeedingReports.length}\n`)
  }

  // ── Phase 2: Business Plans ────────────────────────────────────────────────
  if (oppsNeedingPlans.length > 0) {
    console.log('── Phase 2: Business Plans ──────────────────────────────')
    let plansDone = 0

    await runConcurrent(oppsNeedingPlans, async (opp, i) => {
      const productName = (opp.products as any)?.name_fr ?? opp.product_id
      const countryName = (opp.countries as any)?.name_fr ?? opp.country_iso

      console.log(`[${i + 1}/${oppsNeedingPlans.length}] Building plan: ${productName} in ${countryName}...`)

      const [tradePlan, prodPlan] = await Promise.all([
        buildTradePlan(opp, productName, countryName),
        buildProductionPlan(opp, productName, countryName),
      ])

      const tradeFinancials = tradePlan?.financial_model
      const prodModel = prodPlan?.financial_models?.balanced

      const { error } = await sb.from('business_plans').insert({
        opportunity_id: opp.id,
        type: 'combined',
        title: prodPlan?.title ?? `${productName} — ${countryName}`,
        tier_required: 'pro',
        trade_suppliers: tradePlan?.suppliers ?? null,
        trade_logistics: tradePlan?.logistics ?? null,
        trade_margins: tradeFinancials ?? null,
        prod_capex_usd: prodModel?.capex_usd ?? null,
        prod_opex_usd_year: prodModel?.opex_year_usd ?? null,
        prod_roi_pct: prodModel?.roi_5yr_pct ?? null,
        prod_payback_years: prodModel?.payback_years ?? null,
        prod_machinery_options: prodPlan?.machinery_options ?? null,
        prod_automation_level: 'medium',
        prod_land_ha: prodPlan?.production_setup?.land_required_ha ?? null,
        prod_employees: prodPlan?.staffing?.total_employees ?? null,
        full_plan_html: JSON.stringify({ trade: tradePlan, production: prodPlan }, null, 2),
      })

      if (error) {
        console.error(`  [ERROR] ${productName}/${countryName}:`, error.message)
      } else {
        plansDone++
        console.log(`  ✓ ${productName} / ${countryName} (${plansDone} done)`)
      }
    }, 2)

    console.log(`\nBusiness plans complete: ${plansDone}/${oppsNeedingPlans.length}\n`)
  }

  console.log('=== Batch generation complete ===')
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1) })
