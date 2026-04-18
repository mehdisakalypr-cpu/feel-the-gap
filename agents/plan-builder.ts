// @ts-nocheck
/**
 * Feel The Gap — Business Plan Builder Agent
 *
 * Uses Gemini Pro to generate:
 *   1. Direct Trade plans: sourcing, logistics, margins
 *   2. Local Production plans: capex, machinery, automation, ROI
 *
 * Run: npx tsx agents/plan-builder.ts --opportunity <uuid>
 */

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { supabaseAdmin } from '@/lib/supabase'
import type { Opportunity } from '@/types/database'
import { runCascadeJson, type AiTier } from '@/lib/ai/cascade'

/**
 * Tier-aware wrappers — Vague 4 #8 · 2026-04-18
 * Pour tier premium/ultimate, on passe par runCascade (draft → refine → polish)
 * pour une qualité business-plan niveau agence. Sinon, single-pass Gemini Flash.
 */
export async function buildTradePlanTiered(
  opp: Opportunity,
  productName: string,
  countryName: string,
  tier: AiTier = 'basic',
): Promise<unknown> {
  if (tier === 'premium' || tier === 'ultimate') {
    return runCascadeJson({
      tier,
      task: 'trade-plan',
      basePrompt: `You are a global trade consultant. Return ONLY valid JSON (no markdown).

Country: ${countryName}
Product: ${productName}
Annual import gap: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Current avg import price: ${opp.avg_import_price_usd_tonne ? '$' + opp.avg_import_price_usd_tonne + '/tonne' : 'unknown'}

Structure JSON:
{
  "title": "string",
  "executive_summary": "string (2-3 paragraphs)",
  "suppliers": [{ "country": "string", "companies": ["string"], "price_usd_tonne": number, "incoterm": "string", "notes": "string" }],
  "logistics": { "shipping_routes": ["string"], "freight_cost_usd_tonne": number, "customs_duties_pct": number, "lead_time_days": number, "warehousing_notes": "string" },
  "financial_model": { "purchase_price_usd_tonne": number, "total_landed_cost_usd_tonne": number, "suggested_selling_price_usd_tonne": number, "gross_margin_pct": number, "annual_volume_tonnes": number, "annual_revenue_usd": number, "annual_profit_usd": number },
  "risks": ["string"],
  "next_steps": ["string"]
}`,
    })
  }
  return buildTradePlan(opp, productName, countryName)
}

export async function buildProductionPlanTiered(
  opp: Opportunity,
  productName: string,
  countryName: string,
  tier: AiTier = 'basic',
): Promise<unknown> {
  if (tier === 'premium' || tier === 'ultimate') {
    return runCascadeJson({
      tier,
      task: 'production-plan',
      basePrompt: `You are an agricultural/industrial investment consultant specializing in emerging markets.
Return ONLY valid JSON (no markdown).

Country: ${countryName}
Product to produce locally: ${productName}
Annual import gap to replace: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Land availability: ${opp.land_availability ?? 'medium'}
Labor cost index (1-100): ${opp.labor_cost_index ?? 40}

3 investment tiers (Cost-Effective, Balanced, High-Tech) avec Chinese machinery + AI.

Structure JSON complète avec : title, executive_summary, production_setup{land_required_ha, location_recommendation, climate_requirements}, machinery_options[], financial_models{cost_effective, balanced, high_tech} chacun avec capex_usd/opex_year_usd/revenue_year_usd/gross_margin_pct/payback_years/roi_5yr_pct, staffing{total_employees, roles[]}, competitive_advantages[], risks_and_mitigations[], implementation_roadmap[], next_steps[].`,
    })
  }
  return buildProductionPlan(opp, productName, countryName)
}

// ── Direct Trade Plan ─────────────────────────────────────────────────────────

async function buildTradePlan(opp: Opportunity, productName: string, countryName: string) {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `You are a global trade consultant. Generate a detailed direct trade business plan in JSON format.

Country: ${countryName}
Product: ${productName}
Annual import gap: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Current avg import price: ${opp.avg_import_price_usd_tonne ? '$' + opp.avg_import_price_usd_tonne + '/tonne' : 'unknown'}

Return ONLY valid JSON with this structure:
{
  "title": "string",
  "executive_summary": "string (2-3 paragraphs)",
  "suppliers": [
    { "country": "string", "companies": ["string"], "price_usd_tonne": number, "incoterm": "string", "notes": "string" }
  ],
  "logistics": {
    "shipping_routes": ["string"],
    "freight_cost_usd_tonne": number,
    "customs_duties_pct": number,
    "lead_time_days": number,
    "warehousing_notes": "string"
  },
  "financial_model": {
    "purchase_price_usd_tonne": number,
    "total_landed_cost_usd_tonne": number,
    "suggested_selling_price_usd_tonne": number,
    "gross_margin_pct": number,
    "annual_volume_tonnes": number,
    "annual_revenue_usd": number,
    "annual_profit_usd": number
  },
  "risks": ["string"],
  "next_steps": ["string"]
}`,
    maxTokens: 2000,
  })

  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
  } catch {
    return { raw: text }
  }
}

// ── Local Production Plan ─────────────────────────────────────────────────────

async function buildProductionPlan(opp: Opportunity, productName: string, countryName: string) {
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `You are an agricultural/industrial investment consultant specializing in emerging markets.
Generate a detailed local production business plan in JSON format.

Country: ${countryName}
Product to produce locally: ${productName}
Annual import gap to replace: ${opp.gap_value_usd ? '$' + (opp.gap_value_usd / 1e6).toFixed(1) + 'M' : 'unknown'}
Land availability: ${opp.land_availability ?? 'medium'}
Labor cost index (1-100, lower = cheaper): ${opp.labor_cost_index ?? 40}

Focus on:
- Modern Chinese agricultural/industrial machinery (cost-effective, high automation)
- AI-integrated systems where relevant
- Realistic cost structures for the country context
- 3 investment tiers: Cost-Effective, Balanced, High-Tech

Return ONLY valid JSON:
{
  "title": "string",
  "executive_summary": "string",
  "production_setup": {
    "land_required_ha": number,
    "location_recommendation": "string",
    "climate_requirements": "string"
  },
  "machinery_options": [
    {
      "tier": "cost_effective | balanced | high_tech",
      "description": "string",
      "suppliers": [{ "name": "string", "country": "CN", "model": "string", "price_usd": number, "notes": "string" }],
      "automation_level": "low | medium | high",
      "annual_capacity_tonnes": number,
      "employees_needed": number
    }
  ],
  "financial_models": {
    "cost_effective": {
      "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number,
      "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number
    },
    "balanced": { "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number,
      "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number },
    "high_tech": { "capex_usd": number, "opex_year_usd": number, "revenue_year_usd": number,
      "gross_margin_pct": number, "payback_years": number, "roi_5yr_pct": number }
  },
  "staffing": { "total_employees": number, "roles": [{ "role": "string", "count": number, "monthly_salary_usd": number }] },
  "competitive_advantages": ["string"],
  "risks_and_mitigations": [{ "risk": "string", "mitigation": "string" }],
  "implementation_roadmap": [{ "phase": number, "name": "string", "duration": "string", "key_actions": ["string"] }],
  "next_steps": ["string"]
}`,
    maxTokens: 3000,
  })

  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
  } catch {
    return { raw: text }
  }
}

// ── Report HTML Generator ─────────────────────────────────────────────────────

export async function generateCountryReport(countryIso: string, productId?: string): Promise<string> {
  const admin = supabaseAdmin()

  const { data: country } = await admin.from('countries').select('*').eq('id', countryIso).single()
  if (!country) throw new Error(`Country ${countryIso} not found`)

  const { data: opps } = await admin.from('opportunities')
    .select('*, products(name_fr, category)')
    .eq('country_iso', countryIso)
    .order('opportunity_score', { ascending: false })
    .limit(10)

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `Generate a professional trade intelligence report in HTML format for ${country.name_fr}.

Data:
- Total imports: $${((country.total_imports_usd ?? 0) / 1e9).toFixed(1)}B
- Total exports: $${((country.total_exports_usd ?? 0) / 1e9).toFixed(1)}B
- Top import category: ${country.top_import_category ?? 'unknown'}
- GDP: $${((country.gdp_usd ?? 0) / 1e9).toFixed(0)}B
- Population: ${((country.population ?? 0) / 1e6).toFixed(1)}M

Top opportunities:
${(opps ?? []).map(o => `- ${(o.products as { name_fr: string })?.name_fr}: score ${o.opportunity_score}/100, gap $${((o.gap_value_usd ?? 0) / 1e6).toFixed(0)}M/yr`).join('\n')}

Write a detailed 800-1200 word HTML report with sections:
1. Country Trade Profile
2. Key Import Dependencies
3. Top Business Opportunities (reference the data above)
4. Market Entry Considerations
5. Outlook & Recommendations

Use professional styling inline (dark theme: bg #111827, text #F9FAFB, accent #C9A84C).
Return only the HTML content (no <!DOCTYPE> or <html> wrapper).`,
    maxTokens: 2500,
  })

  return text
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runPlanBuilder(opportunityId: string): Promise<void> {
  const admin = supabaseAdmin()

  const { data: opp } = await admin.from('opportunities')
    .select('*, products(name_fr), countries(name_fr)')
    .eq('id', opportunityId)
    .single()

  if (!opp) { console.error('Opportunity not found:', opportunityId); return }

  const productName = (opp.products as { name_fr: string })?.name_fr ?? opp.product_id
  const countryName = (opp.countries as { name_fr: string })?.name_fr ?? opp.country_iso

  console.log(`[PlanBuilder] Building plan for ${productName} in ${countryName}…`)

  const [tradePlan, prodPlan] = await Promise.all([
    buildTradePlan(opp, productName, countryName),
    buildProductionPlan(opp, productName, countryName),
  ])

  const tradeFinancials = tradePlan?.financial_model
  const prodModel = prodPlan?.financial_models?.balanced

  await admin.from('business_plans').insert({
    opportunity_id: opportunityId,
    type: 'local_production',
    title: prodPlan?.title ?? `${productName} — ${countryName}`,
    tier_required: 'pro',
    trade_suppliers: tradePlan?.suppliers ?? null,
    trade_logistics: tradePlan?.logistics ?? null,
    trade_margins:   tradeFinancials ?? null,
    prod_capex_usd:       prodModel?.capex_usd ?? null,
    prod_opex_usd_year:   prodModel?.opex_year_usd ?? null,
    prod_roi_pct:         prodModel?.roi_5yr_pct ?? null,
    prod_payback_years:   prodModel?.payback_years ?? null,
    prod_machinery_options: prodPlan?.machinery_options ?? null,
    prod_automation_level: 'medium',
    prod_land_ha:     prodPlan?.production_setup?.land_required_ha ?? null,
    prod_employees:   prodPlan?.staffing?.total_employees ?? null,
    full_plan_html:   JSON.stringify({ trade: tradePlan, production: prodPlan }, null, 2),
  })

  console.log(`[PlanBuilder] Plan written for opportunity ${opportunityId}`)
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2)
  const oppId = args[args.indexOf('--opportunity') + 1]
  if (!oppId) { console.error('Usage: --opportunity <uuid>'); process.exit(1) }
  runPlanBuilder(oppId).catch(console.error)
}
