// @ts-nocheck
/**
 * Feel The Gap — Product Opportunity Farming Scanner
 *
 * Takes a product description from a manufacturer/distributor and returns:
 *   1. Geographic opportunity map (scored locations)
 *   2. Competitor/distributor landscape per geography
 *   3. Channel strategy options (distribution, POS, operator partnerships)
 *   4. Profitability + time-to-market comparison across channels
 */

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export interface ScanInput {
  product: string          // e.g. "exoskeleton hiking assistance device"
  manufacturer?: string    // e.g. "ExoWalk Technologies"
  geography?: string       // e.g. "Alps region" or "worldwide"
  budget?: string          // e.g. "50000-200000 EUR"
  affiliateLink?: string   // optional, for influencer module
}

export interface GeoOpportunity {
  name: string             // e.g. "Swiss Alps region"
  countries: string[]
  score: number            // 0-100
  rationale: string
  market_size_eur: number
  key_use_cases: string[]
}

export interface Competitor {
  name: string
  type: 'manufacturer' | 'distributor' | 'retailer'
  geography: string
  market_share_pct?: number
  weakness?: string
}

export interface ChannelOption {
  channel: 'local_distribution' | 'own_point_of_sale' | 'operator_partnership' | 'affiliate_ecommerce'
  label: string
  description: string
  revenue_share_pct?: number
  capex_eur: number
  opex_year_eur: number
  margin_pct: number
  time_to_market_weeks: number
  risk_score: number          // 1-5
  roi_12m_pct: number
  roi_36m_pct: number
  best_for: string            // e.g. "mountains with existing tour operators"
  next_steps: string[]
}

export interface OpportunityScanResult {
  product_summary: string
  top_geographies: GeoOpportunity[]
  competitor_map: Competitor[]
  channel_options: ChannelOption[]
  recommended_channel: string   // channel type
  executive_summary: string
  influencer_angles?: string[]  // only if affiliateLink provided
}

const SCANNER_PROMPT = (input: ScanInput) => `
You are a world-class GTM (Go-To-Market) strategist specializing in finding geographic and channel opportunities for physical products.

PRODUCT: ${input.product}
${input.manufacturer ? `MANUFACTURER / DISTRIBUTOR: ${input.manufacturer}` : ''}
${input.geography ? `TARGET GEOGRAPHY: ${input.geography}` : 'TARGET GEOGRAPHY: worldwide (identify best regions)'}
${input.budget ? `BUDGET AVAILABLE: ${input.budget}` : ''}

YOUR TASK: Identify where and how this product can be sold, distributed or integrated into existing ecosystems.

Return ONLY valid JSON matching this exact structure:
{
  "product_summary": "2-sentence description of the product and its core value proposition",
  "top_geographies": [
    {
      "name": "region or zone name",
      "countries": ["ISO-2 or country name"],
      "score": 85,
      "rationale": "Why this geography is ideal (geography, demographics, existing demand, culture)",
      "market_size_eur": 5000000,
      "key_use_cases": ["specific use case 1", "specific use case 2"]
    }
  ],
  "competitor_map": [
    {
      "name": "company name",
      "type": "distributor",
      "geography": "region or country",
      "market_share_pct": 15,
      "weakness": "their key weakness the manufacturer can exploit"
    }
  ],
  "channel_options": [
    {
      "channel": "local_distribution",
      "label": "Local Distribution Partner",
      "description": "Find local distributors (sporting goods shops, mountain sports specialists) who stock and sell your product with their own sales force",
      "revenue_share_pct": 35,
      "capex_eur": 15000,
      "opex_year_eur": 8000,
      "margin_pct": 45,
      "time_to_market_weeks": 8,
      "risk_score": 2,
      "roi_12m_pct": 42,
      "roi_36m_pct": 180,
      "best_for": "regions with established outdoor retail networks",
      "next_steps": ["Identify top-3 distributors in target region", "Prepare distributor pitch deck", "Negotiate exclusivity terms"]
    },
    {
      "channel": "own_point_of_sale",
      "label": "Own Point of Sale",
      "description": "Open a branded shop or pop-up at high-traffic trailheads, mountain villages, or tourism hubs",
      "capex_eur": 80000,
      "opex_year_eur": 45000,
      "margin_pct": 72,
      "time_to_market_weeks": 24,
      "risk_score": 4,
      "roi_12m_pct": -15,
      "roi_36m_pct": 95,
      "best_for": "iconic destinations with year-round tourism",
      "next_steps": ["Scout 3 locations with footfall data", "Hire local store manager", "Obtain retail permits"]
    },
    {
      "channel": "operator_partnership",
      "label": "Operator Integration (Tours & Excursions)",
      "description": "Partner with hiking tour operators, mountain guide associations, and trekking agencies to integrate your product into their offerings as a rental or upsell",
      "revenue_share_pct": 20,
      "capex_eur": 25000,
      "opex_year_eur": 12000,
      "margin_pct": 58,
      "time_to_market_weeks": 12,
      "risk_score": 2,
      "roi_12m_pct": 28,
      "roi_36m_pct": 210,
      "best_for": "experiential products that benefit from try-before-you-buy",
      "next_steps": ["Map tour operators in top-3 geographies", "Create operator kit (demo units + training materials)", "Draft revenue-share agreement template"]
    },
    {
      "channel": "affiliate_ecommerce",
      "label": "Affiliate & E-commerce",
      "description": "Leverage travel influencers, outdoor YouTubers and bloggers who naturally reach your target audience to drive online sales via affiliate commissions",
      "capex_eur": 5000,
      "opex_year_eur": 18000,
      "margin_pct": 55,
      "time_to_market_weeks": 4,
      "risk_score": 3,
      "roi_12m_pct": 65,
      "roi_36m_pct": 320,
      "best_for": "products with strong visual demo potential and aspirational lifestyle fit",
      "next_steps": ["Build affiliate tracking system", "Identify top-20 outdoor content creators", "Create unboxing + demo content kit"]
    }
  ],
  "recommended_channel": "operator_partnership",
  "executive_summary": "3-paragraph strategic summary: best geography + best channel + why",
  ${input.affiliateLink ? `"influencer_angles": ["angle 1 for content creators", "angle 2", "angle 3"]` : '"influencer_angles": []'}
}

IMPORTANT:
- Be specific to the product. An exoskeleton has different opportunities than a water purifier.
- Score geographies honestly (not everything is 90+)
- Include real competitor names where known, or realistic archetypes
- ROI figures should be conservative and realistic
- At least 5 geographies, 3+ competitors, exactly 4 channel options
- Respond ONLY with valid JSON, no markdown, no explanation
`

export async function scanOpportunities(input: ScanInput): Promise<OpportunityScanResult> {
  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: SCANNER_PROMPT(input),
    maxTokens: 4000,
  })

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as OpportunityScanResult
}
