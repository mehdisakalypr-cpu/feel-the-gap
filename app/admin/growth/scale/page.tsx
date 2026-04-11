'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── TYPES ────────────────────────────────────────────────────────────────────

type TaskTag = 'AGENT' | 'HUMAN'

interface Task {
  id: string
  title: string
  desc: string
  tag: TaskTag
  effort: string
  impact: string
  status: 'todo' | 'in-progress' | 'done'
  dependencies?: string
}

interface RevenueStream {
  name: string
  amount: number
  isNew?: boolean
}

interface ProfileImpact {
  profile: string
  icon: string
  color: string
  description: string
}

interface Palier {
  id: number
  name: string
  subtitle: string
  scoreFrom: number
  scoreTo: number
  timeline: string
  color: string
  tasks: Task[]
  revenueStreams: RevenueStream[]
  profileImpacts: ProfileImpact[]
  metrics: {
    seoPages: string
    organicTraffic: string
    freeUsers: string
    payingUsers: number
    totalMrr: number
    costs: number
    netProfit: number
    margin: string
    keyMetric?: { label: string; value: string }
  }
}

// ── PALIERS DATA ────────────────────────────────────────────────────────────

const PALIERS: Palier[] = [
  // ── PALIER 6 ──────────────────────────────────────────────────────────────
  {
    id: 6,
    name: 'Data Explosion',
    subtitle: 'From 6 products to 50+, from 115 to 200+ countries. 10,000 scored opportunities.',
    scoreFrom: 92,
    scoreTo: 94,
    timeline: 'Month 13-15',
    color: '#F59E0B',
    tasks: [
      {
        id: 'p6-products',
        title: 'Expand Product Catalog to 50+ HS4 Categories',
        desc: '3,778 products across 9 categories (agriculture 1,664, fashion 705, cosmetics 425, food 410, energy 170, raw_materials 114, cultural 110, cooperative 90, services 40). 44 countries d\'origine. Product-enricher-10k en cours vers 10,000.',
        tag: 'AGENT',
        effort: '12h agent (data scraping + structuring)',
        impact: 'Critical',
        status: 'in-progress',
      },
      {
        id: 'p6-countries',
        title: 'Scale Country Coverage to 200+',
        desc: 'Add micro-states (Monaco, Andorra, Liechtenstein), island nations (Mauritius, Seychelles, Fiji, Samoa), emerging markets (Myanmar, Laos, Uzbekistan, Turkmenistan). Each country gets: GDP, trade balance, top imports/exports, regulatory environment score, logistics score, currency stability index.',
        tag: 'AGENT',
        effort: '8h agent (World Bank API + CIA Factbook)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p6-opportunities',
        title: 'Auto-Generate 10,000 Opportunity Matrix',
        desc: '200 countries x 50 products = 10,000 potential opportunities. AI scores each one (0-100) based on: trade gap size, market accessibility, competition density, logistics feasibility, regulatory friendliness. Store in opportunities table with full scoring breakdown.',
        tag: 'AGENT',
        effort: '24h agent (batch AI scoring, rate-limited)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'p6-products, p6-countries',
      },
      {
        id: 'p6-bizplans',
        title: 'Auto-Generate 2,000 Business Plans (Score > 70)',
        desc: '385 business plans générés (3 scénarios: artisanal/mechanized/AI). Agent: enriched-plan-builder.ts + batch-enriched-plans.ts. 30 pays × 6 produits pilotes complétés.',
        tag: 'AGENT',
        effort: '48h agent (heavy AI generation, batched)',
        impact: 'Critical',
        status: 'in-progress',
        dependencies: 'p6-opportunities',
      },
      {
        id: 'p6-seo',
        title: 'Scale SEO Pages to 10,000',
        desc: '200 countries x 50 products = 10,000 unique landing pages. Each page includes: AI-generated trade analysis, opportunity score, partial business plan preview, logistics overview, regulatory summary, and CTA to subscribe. ISR with 48h revalidation.',
        tag: 'AGENT',
        effort: '36h agent (batch page generation)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'p6-opportunities',
      },
      {
        id: 'p6-comtrade',
        title: 'Integrate UN Comtrade API for Real-Time Trade Data',
        desc: 'Build data pipeline: daily cron fetches latest trade statistics from UN Comtrade API (free tier: 100 requests/hour). Store in trade_flows table. Auto-update opportunity scores when new data arrives. Add World Bank API for GDP, inflation, exchange rate data.',
        tag: 'AGENT',
        effort: '8h agent (API integration + cron)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p6-logistics',
        title: 'Add Logistics Corridor Data',
        desc: '1,202 corridors logistiques (sea/air/road) pour 30 pays producteurs. Agents: logistics-collector.ts avec fallback Gemini→Groq→OpenAI.',
        tag: 'AGENT',
        effort: '12h agent (data aggregation)',
        impact: 'High',
        status: 'done',
      },
      {
        id: 'p6-regulatory',
        title: 'Add Regulatory & Tariff Data',
        desc: '327 réglementations sur 30 pays (9 catégories par pays). Agent: regulatory-collector.ts LLM-native avec fallback triple Gemini→Groq→OpenAI.',
        tag: 'AGENT',
        effort: '16h agent (complex data structuring)',
        impact: 'High',
        status: 'done',
      },
      {
        id: 'p6-enterprise-api',
        title: 'Build Enterprise API Access (v1)',
        desc: 'Create /api/v1/enterprise/* endpoints: GET /opportunities (filtered, paginated), GET /countries/:iso/analysis, GET /products/:hs/flows, GET /reports/generate. API key auth, rate limiting (1,000 req/day standard, 10,000 premium). Pricing: 500-5,000 EUR/mo depending on tier.',
        tag: 'AGENT',
        effort: '16h agent (API design + implementation)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p6-whitelabel',
        title: 'White-Label Report Generator',
        desc: 'Auto-generate branded PDF reports for chambers of commerce, consulting firms, government trade departments. Template engine with customizable logo, colors, cover page. Each report pulls data from specific country/product/region. Pricing: 200 EUR/report or 2,000 EUR/mo unlimited.',
        tag: 'AGENT',
        effort: '12h agent (PDF generation + template system)',
        impact: 'Medium',
        status: 'todo',
      },
    ],
    revenueStreams: [
      { name: 'Subscriptions', amount: 64400 },
      { name: 'Enterprise API', amount: 10000, isNew: true },
      { name: 'White-label Reports', amount: 0 },
    ],
    profileImpacts: [
      { profile: 'Entrepreneurs', icon: '\u{1F9ED}', color: '#C9A84C', description: '10,000 opportunities = 100x more reasons to subscribe. Every niche has coverage. Conversion rate doubles as users find their exact market.' },
      { profile: 'Influencers', icon: '\u{1F3A4}', color: '#A78BFA', description: '50 product categories = massive affiliate catalog. More products = more content angles. Influencers can specialize by sector and still have endless material.' },
      { profile: 'Financiers', icon: '\u{1F3E6}', color: '#34D399', description: '2,000 business plans = rich deal flow pipeline. Banks pay premium for pre-qualified, data-backed deals. Risk assessment data reduces due diligence time.' },
      { profile: 'Investors', icon: '\u{1F4C8}', color: '#60A5FA', description: '200 countries = geographic diversification. More data points = better risk models. Portfolio construction becomes data-driven, not intuition-driven.' },
    ],
    metrics: {
      seoPages: '300,000',
      organicTraffic: '2M/mo',
      freeUsers: '45,000/mo signups',
      payingUsers: 13000,
      totalMrr: 1200000,
      costs: 4545,
      netProfit: 1195455,
      margin: '99.6%',
      keyMetric: { label: 'Languages Deployed', value: '15' },
    },
  },

  // ── PALIER 7 (UPDATED) ──────────────────────────────────────────────────────
  {
    id: 7,
    name: 'International Expansion & AI Scale',
    subtitle: '15 languages live. 600+ products. 300 AI personas. 120+ deal flows. Auto-optimizer running.',
    scoreFrom: 94,
    scoreTo: 97,
    timeline: 'Month 16-18 (CURRENT)',
    color: '#A78BFA',
    tasks: [
      {
        id: 'p7-transaction',
        title: 'Launch B2B Transaction Platform',
        desc: 'Entrepreneurs can now LIST products for sale directly on the platform (not just browse opportunities). Listing form: product, quantity, target price, origin, certifications, delivery terms (FOB/CIF/DDP). Platform takes 5-8% commission on each facilitated deal. Stripe Connect for multi-party payments.',
        tag: 'AGENT',
        effort: '40h agent (marketplace backend + UI)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p7-matching',
        title: 'AI Smart Matching Engine',
        desc: 'AI matches entrepreneurs with best counterparties automatically. Matching factors: product compatibility, geography, volume alignment, payment terms preference, trust score (based on platform activity). Sends daily match notifications. Expected match-to-deal conversion: 15-25%.',
        tag: 'AGENT',
        effort: '24h agent (ML matching algorithm)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p7-dealroom',
        title: 'Secure Deal Room',
        desc: 'Private space for matched parties to: share documents (invoices, certificates, contracts), negotiate terms via structured chat, track deal milestones, sign agreements (DocuSign integration). All activity logged for compliance. End-to-end encrypted.',
        tag: 'AGENT',
        effort: '32h agent (real-time features)',
        impact: 'High',
        status: 'todo',
        dependencies: 'p7-matching',
      },
      {
        id: 'p7-escrow',
        title: 'Escrow Integration for Large Transactions',
        desc: 'For deals > 10,000 EUR: escrow via Stripe/Mangopay. Buyer deposits funds, seller ships, buyer confirms receipt, funds released. Platform earns float interest + escrow fee (1%). Dispute resolution workflow included.',
        tag: 'AGENT',
        effort: '20h agent (payment flow)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p7-investment-memo',
        title: 'Auto-Generate Investment Memos',
        desc: 'For investors: AI transforms business plan data into professional investment memos. Format: 2-page summary with key metrics, risk-return profile, market timing, comparable deals. Investors can filter by: sector, geography, ticket size, risk level.',
        tag: 'AGENT',
        effort: '12h agent',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p7-influencer-marketplace',
        title: 'Influencer Booking Marketplace',
        desc: 'Brands can book influencers directly through the platform for: sponsored posts, product reviews, market entry campaigns, trade show coverage. Platform takes 15% booking fee. Influencer profiles show: audience demographics, engagement rates, content style, rates.',
        tag: 'AGENT',
        effort: '24h agent',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p7-video-digest',
        title: 'AI Daily Opportunity Digest Videos',
        desc: 'AI agent creates daily video digest for each market segment: "Today\'s Top 5 Trade Opportunities in West Africa", "This Week in Agricultural Commodities". Auto-generated with HeyGen, published to YouTube + platform feed. Drives engagement and return visits.',
        tag: 'AGENT',
        effort: '8h setup, then automated',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'p7-hs6',
        title: 'Expand to HS6 Level: 5,000+ Product Categories',
        desc: 'Move from HS4 (50 categories) to HS6 granularity (5,000+ codes). Example: HS 090111 (Coffee, not roasted, not decaffeinated) vs HS 0901 (Coffee). 200 countries x 5,000 products = 1,000,000 potential data points. AI scores and ranks top 50,000 opportunities.',
        tag: 'AGENT',
        effort: '48h agent (massive data expansion)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p7-longtail',
        title: 'Auto-Generate 50,000 Long-Tail SEO Pages',
        desc: 'Landing pages for top 50,000 scored opportunities. Each page: unique title, meta description, AI-generated analysis (500-800 words), opportunity score, related opportunities, CTA. Massive long-tail SEO play covering ultra-niche keywords like "sesame seed export Burkina Faso 2027".',
        tag: 'AGENT',
        effort: '72h agent (batched over 2 weeks)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'p7-hs6',
      },
    ],
    revenueStreams: [
      { name: 'Subscriptions', amount: 138000 },
      { name: 'Transaction Commissions (5%)', amount: 15000, isNew: true },
      { name: 'Enterprise API', amount: 25000 },
      { name: 'Influencer Marketplace', amount: 5000, isNew: true },
    ],
    profileImpacts: [
      { profile: 'Entrepreneurs', icon: '\u{1F9ED}', color: '#C9A84C', description: 'Can now LIST products for sale directly. Platform matches them with buyers. Deal rooms reduce friction. Escrow builds trust for first-time cross-border deals.' },
      { profile: 'Influencers', icon: '\u{1F3A4}', color: '#A78BFA', description: 'Booking marketplace turns influence into revenue. Brands discover and hire them directly. 15% platform fee is fair vs. doing outreach alone. Content library grows with daily digests.' },
      { profile: 'Financiers', icon: '\u{1F3E6}', color: '#34D399', description: 'Smart matching brings qualified deals to them. Investment memos save hours of analysis. Escrow integration means they can finance deals with lower risk. Deal flow is curated by AI.' },
      { profile: 'Investors', icon: '\u{1F4C8}', color: '#60A5FA', description: 'Investment memos auto-generated from 50,000 scored opportunities. Portfolio construction at scale. Can filter by risk profile, geography, sector. Network effects = better deal quality over time.' },
    ],
    metrics: {
      seoPages: '300,000',
      organicTraffic: '3M/mo',
      freeUsers: '80,000/mo signups',
      payingUsers: 25000,
      totalMrr: 2500000,
      costs: 150000,
      netProfit: 2350000,
      margin: '94%',
      keyMetric: { label: 'ARR', value: '30M EUR' },
    },
  },

  // ── PALIER 8 (UPDATED) ──────────────────────────────────────────────────────
  {
    id: 8,
    name: 'Profit Max & Market Leadership',
    subtitle: '15 languages, 300K+ SEO pages, 300 AI personas, geo-pricing PPP, 2.5% churn. Maximum efficiency.',
    scoreFrom: 97,
    scoreTo: 98,
    timeline: 'Month 19-21',
    color: '#34D399',
    tasks: [
      {
        id: 'p8-languages',
        title: '15 Languages Deployed',
        desc: '15 langues complètes : en, fr, es, pt, ar, zh, de, tr, ja, ko, hi, ru, id, sw, it. 276 clés × 15 = 4,140 traductions. Support RTL arabe. Sélecteur dropdown + détection auto navigateur.',
        tag: 'AGENT',
        effort: '80h agent (translation pipeline)',
        impact: 'Critical',
        status: 'done',
      },
      {
        id: 'p8-multiply-pages',
        title: 'Multiply 50,000 Pages x 12 Languages = 600,000 Pages',
        desc: 'Each existing SEO page gets translated into all 12 languages with localized trade data, local currency conversion, and region-specific insights. URL structure: /[lang]/trade/[product]-[country]. Sitemap split into per-language sitemaps. hreflang tags for all variants.',
        tag: 'AGENT',
        effort: '120h agent (massive batch, 2-3 weeks)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'p8-languages',
      },
      {
        id: 'p8-pricing',
        title: 'Geo-Pricing PPP (4 tiers)',
        desc: 'Implémenté : 4 tiers PPP (premium ×1.0, standard ×0.7, emerging ×0.45, frontier ×0.25). Détection GeoIP via x-vercel-ip-country. Bandeau discount sur /pricing. API /api/geo.',
        tag: 'AGENT',
        effort: '16h agent',
        impact: 'High',
        status: 'done',
      },
      {
        id: 'p8-regional-ai',
        title: 'Regional AI Advisors',
        desc: 'Train specialized AI advisors for each region: MENA trade specialist (Arabic, knows customs unions), ECOWAS expert (West African trade), ASEAN advisor (Southeast Asia), EU regulatory expert, Mercosur specialist. Each advisor understands local regulations, cultural business practices, and common trade routes.',
        tag: 'AGENT',
        effort: '24h agent (prompt engineering per region)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p8-trade-agreements',
        title: 'Trade Agreement Analyzer',
        desc: 'Map all major trade agreements and their product coverage: AfCFTA (54 African countries), RCEP (15 Asia-Pacific), EU-Mercosur, AGOA (US-Africa), CPTPP (11 Pacific countries), USMCA. For each product/country pair, show which agreements apply and the tariff savings. Competitive advantage: no other platform does this at scale.',
        tag: 'AGENT',
        effort: '32h agent (complex data mapping)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p8-personas-global',
        title: '300 AI Influencer Personas × 15 Languages',
        desc: '300 personas IA déployées (20 archétypes × 15 langues). Agent: influencer-factory.ts. Niches: agri-trade, fintech, fashion, cosmetics, energy, etc. Chaque persona a bio, voice traits, content pillars.',
        tag: 'AGENT',
        effort: '40h agent (persona creation + content pipeline)',
        impact: 'High',
        status: 'done',
      },
      {
        id: 'p8-partnerships',
        title: 'Automate 100+ Global Chamber of Commerce Partnerships',
        desc: 'AI researches, scores, and drafts outreach for 100+ chambers of commerce globally. Automated onboarding flow: chamber gets white-label access to regional data, members get discount codes. Co-marketing: chambers promote FTG to their members, FTG gives chambers data dashboard.',
        tag: 'AGENT',
        effort: '24h agent + 4h human review',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p8-commodity',
        title: 'Real-Time Commodity Price Tracking',
        desc: 'Integrate with major commodity exchanges: ICE (coffee, cocoa, cotton), LME (metals), CME (grains, livestock). Display live/daily prices on relevant opportunity pages. AI generates price trend alerts for subscribed users. Premium feature for Strategy+ users.',
        tag: 'AGENT',
        effort: '16h agent (API integrations)',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'p8-satellite',
        title: 'Satellite Imagery for Agricultural Production Estimates',
        desc: 'Integrate NDVI satellite data (free from NASA/ESA) to estimate agricultural production by region. Show crop health, harvest predictions, drought risk on opportunity pages for agricultural products. Unique data point no competitor offers.',
        tag: 'AGENT',
        effort: '20h agent (satellite data pipeline)',
        impact: 'Medium',
        status: 'todo',
      },
    ],
    revenueStreams: [
      { name: 'Subscriptions', amount: 368000 },
      { name: 'Transaction Commissions', amount: 50000 },
      { name: 'Enterprise API', amount: 60000 },
    ],
    profileImpacts: [
      { profile: 'Entrepreneurs', icon: '\u{1F9ED}', color: '#C9A84C', description: 'Platform speaks their language. Local pricing removes barriers. Regional AI advisors understand their market context. Trade agreement analyzer saves weeks of research.' },
      { profile: 'Influencers', icon: '\u{1F3A4}', color: '#A78BFA', description: '50+ personas across 10 languages = global content army. Local social platforms targeted. Influencer revenue scales with geographic coverage. Each persona is a revenue channel.' },
      { profile: 'Financiers', icon: '\u{1F3E6}', color: '#34D399', description: 'Multi-currency support means financing deals in local currencies. Trade agreement data reduces risk assessment time. 600,000 pages of data = unmatched intelligence for lending decisions.' },
      { profile: 'Investors', icon: '\u{1F4C8}', color: '#60A5FA', description: 'True global diversification across 200+ countries and 12 languages. Satellite data adds unique alpha. Commodity price integration enables timing-based investment strategies.' },
    ],
    metrics: {
      seoPages: '600,000+',
      organicTraffic: '3M/mo',
      freeUsers: '120,000/mo signups',
      payingUsers: 4000,
      totalMrr: 478000,
      costs: 30000,
      netProfit: 448000,
      margin: '94%',
      keyMetric: { label: 'ARR', value: '5.7M EUR' },
    },
  },

  // ── PALIER 9 ──────────────────────────────────────────────────────────────
  {
    id: 9,
    name: 'Platform Lock-in',
    subtitle: 'Full trade pipeline management. Trade finance marketplace. Insurance. Compliance. MILLION-DOLLAR MRR.',
    scoreFrom: 97,
    scoreTo: 98,
    timeline: 'Month 22-24',
    color: '#EC4899',
    tasks: [
      {
        id: 'p9-tracking',
        title: 'Supply Chain Tracking',
        desc: 'Users can track their shipments end-to-end: booking confirmation, container loading, vessel tracking (MarineTraffic API), port arrival, customs clearance, last-mile delivery. Dashboard shows all active shipments with real-time status. Push notifications for status changes.',
        tag: 'AGENT',
        effort: '40h agent (shipping APIs + real-time)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p9-trade-finance',
        title: 'Trade Finance Marketplace (Reverse Auction)',
        desc: 'Banks and DFIs compete to finance deals on the platform. Entrepreneur posts financing need (amount, terms, collateral). Multiple banks bid with rates and conditions. Platform takes 0.5-1% arrangement fee. Revolutionizes trade finance access for SMEs in emerging markets.',
        tag: 'AGENT',
        effort: '48h agent (auction engine + compliance)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p9-insurance',
        title: 'Trade Insurance Integration',
        desc: 'Auto-quote trade insurance per shipment: cargo insurance, credit insurance, political risk insurance. Partners: Euler Hermes, Coface, Lloyd\'s syndicate APIs. One-click buy. Platform earns 10-15% commission on premiums. Reduces risk barrier for new traders.',
        tag: 'AGENT',
        effort: '24h agent (insurance API integration)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p9-compliance',
        title: 'Compliance Automation Suite',
        desc: 'Auto-check: sanctions lists (OFAC, EU, UN), export controls (dual-use goods), certificates of origin verification, anti-money laundering checks, restricted party screening. Real-time compliance dashboard. Saves users from costly regulatory violations.',
        tag: 'AGENT',
        effort: '32h agent (compliance data + rules engine)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p9-negotiation',
        title: 'AI Negotiation Assistant',
        desc: 'AI helps parties negotiate terms: suggests fair pricing based on market data, recommends payment terms based on risk profile, drafts contract clauses, flags unfavorable terms. Trained on thousands of successful deals on the platform. Premium feature.',
        tag: 'AGENT',
        effort: '20h agent (advanced prompt engineering)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p9-predictive',
        title: 'Predictive Analytics: 6-Month Trade Gap Forecasts',
        desc: 'AI predicts future trade gaps using: historical trends, seasonal patterns, macroeconomic indicators, commodity futures, geopolitical events, climate data. Users can see "Emerging Opportunities" 6 months before they peak. Massive competitive advantage for early movers.',
        tag: 'AGENT',
        effort: '40h agent (ML pipeline + forecasting)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p9-mobile',
        title: 'Native Mobile App (PWA to Native)',
        desc: 'Convert existing PWA to native iOS/Android app using React Native or Capacitor. Push notifications for: new opportunity matches, deal updates, shipment status, price alerts, financing offers. Offline mode for low-connectivity markets (rural Africa, remote Asia).',
        tag: 'AGENT',
        effort: '80h agent (mobile app build)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p9-certification',
        title: 'FTG Certified Trade Analyst Program',
        desc: 'Paid certification course: "Feel The Gap Certified Trade Analyst". 12-module online course covering: trade gap analysis methodology, market entry strategy, trade finance fundamentals, logistics optimization, compliance essentials. Exam + certificate. Pricing: 499 EUR/person. Corporate pricing: 2,999 EUR for 10 seats.',
        tag: 'HUMAN',
        effort: '40h human (course content) + 20h agent (platform build)',
        impact: 'Medium',
        status: 'todo',
      },
    ],
    revenueStreams: [
      { name: 'Subscriptions', amount: 736000 },
      { name: 'Transaction Commissions', amount: 120000 },
      { name: 'Enterprise API', amount: 100000 },
      { name: 'Insurance/Compliance Fees', amount: 30000, isNew: true },
      { name: 'Certification Program', amount: 15000, isNew: true },
    ],
    profileImpacts: [
      { profile: 'Entrepreneurs', icon: '\u{1F9ED}', color: '#C9A84C', description: 'Entire trade pipeline on one platform: find opportunity, get financing, insure shipment, track delivery, stay compliant. Switching cost is extremely high. They will never leave.' },
      { profile: 'Influencers', icon: '\u{1F3A4}', color: '#A78BFA', description: 'Certification program makes them official "FTG Certified" experts. Status symbol in their niche. More credibility = higher booking rates. Platform content keeps growing.' },
      { profile: 'Financiers', icon: '\u{1F3E6}', color: '#34D399', description: 'Reverse auction for trade finance = unprecedented deal flow. Compliance automation reduces risk. Insurance integration means they can co-finance with insurance backing. Every deal is de-risked.' },
      { profile: 'Investors', icon: '\u{1F4C8}', color: '#60A5FA', description: 'Predictive analytics gives 6-month forward view. Supply chain tracking provides real-time visibility into portfolio performance. Platform lock-in means stable, growing user base (great for valuation).' },
    ],
    metrics: {
      seoPages: '600,000+',
      organicTraffic: '5M/mo',
      freeUsers: '200,000/mo signups',
      payingUsers: 8000,
      totalMrr: 1001000,
      costs: 60000,
      netProfit: 941000,
      margin: '94%',
      keyMetric: { label: 'MILESTONE', value: 'MILLION-DOLLAR MRR' },
    },
  },

  // ── PALIER 10 ─────────────────────────────────────────────────────────────
  {
    id: 10,
    name: 'Exit-Ready',
    subtitle: 'Profitable at scale. Series A/B or acquisition. Valuation: 240-540M EUR.',
    scoreFrom: 98,
    scoreTo: 99,
    timeline: 'Month 25-36',
    color: '#EF4444',
    tasks: [
      {
        id: 'p10-api-oss',
        title: 'Open-Source Trade Data API (Freemium)',
        desc: 'Release FTG Trade API as open-source with free tier (100 req/day). Attracts developers, fintech startups, researchers. They build on top of FTG data, creating ecosystem lock-in. Paid tiers for commercial use. Becomes the "Stripe of trade data".',
        tag: 'AGENT',
        effort: '40h agent (API redesign + docs)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p10-ventures',
        title: 'Launch FTG Ventures',
        desc: 'Invest in promising trade startups discovered through the platform. Fund: 2M EUR initial. Ticket size: 50-200K EUR. Thesis: invest in entrepreneurs who use FTG and show exceptional traction. Platform data gives unique deal sourcing advantage. Expected: 10-15 investments in Year 3.',
        tag: 'HUMAN',
        effort: 'Ongoing human (investment committee)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p10-govcontracts',
        title: 'Government Contracts: Official Trade Intelligence Provider',
        desc: 'Become the official trade intelligence platform for 5-10 countries. Target: trade promotion agencies (Business France, APEX Brasil, Kenya Export Promotion), development banks (AfDB, IFC, EBRD). Contract value: 100K-500K EUR/year per government. RFP responses powered by AI.',
        tag: 'HUMAN',
        effort: '80h human (government relations + compliance)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p10-acquisitions',
        title: 'Acquire Smaller Competitors or Data Providers',
        desc: 'Identify and acquire: niche trade data providers (port statistics, commodity databases), regional trade platforms (Africa-focused, ASEAN-focused), compliance/regulatory data companies. Integrate their data into FTG, eliminate competition, expand data moat.',
        tag: 'HUMAN',
        effort: 'Ongoing (M&A process)',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p10-vp-sales',
        title: 'Hire VP Sales for Enterprise Segment',
        desc: 'Senior hire to lead enterprise sales: banks, governments, large trading houses, consulting firms. Target: close 20+ enterprise contracts at 50-500K EUR/year. Background: ex-Bloomberg, S&P Global, or trade finance veteran. Comp: 150-200K EUR + equity.',
        tag: 'HUMAN',
        effort: '2-3 month hiring process',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p10-vp-product',
        title: 'Hire VP Product for Platform Expansion',
        desc: 'Senior product leader to scale beyond trade data: supply chain management suite, trade finance SaaS, compliance-as-a-service. Background: ex-Flexport, Maersk Digital, or trade-tech startup. Responsible for product roadmap, user research, feature prioritization.',
        tag: 'HUMAN',
        effort: '2-3 month hiring process',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'p10-series-a',
        title: 'Prepare Series A/B or Strategic Exit',
        desc: 'At 24-36M EUR ARR with 90%+ margins, three paths: (1) Raise Series A/B at 10-15x ARR = 240-540M EUR valuation. Target investors: Sequoia, a16z, Accel (fintech). (2) Strategic acquisition by S&P Global, Bloomberg, Refinitiv, or major bank. (3) Profitable lifestyle business at 2M+ EUR/mo profit.',
        tag: 'HUMAN',
        effort: '6-12 months (fundraising or M&A process)',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'p10-team',
        title: 'Scale Team to 15-25 People',
        desc: 'Key hires: VP Sales, VP Product, 3 senior engineers, 2 data engineers, 1 ML engineer, 2 enterprise account managers, 1 head of partnerships, 1 legal/compliance counsel, 1 finance/ops. Maintain engineering leverage with AI agents handling 80% of repetitive work.',
        tag: 'HUMAN',
        effort: 'Ongoing (12+ months)',
        impact: 'High',
        status: 'todo',
      },
    ],
    revenueStreams: [
      { name: 'Subscriptions', amount: 1500000 },
      { name: 'Transaction Commissions', amount: 300000 },
      { name: 'Enterprise API + Gov Contracts', amount: 500000 },
      { name: 'Insurance/Compliance/Cert', amount: 100000 },
      { name: 'FTG Ventures Returns', amount: 100000 },
    ],
    profileImpacts: [
      { profile: 'Entrepreneurs', icon: '\u{1F9ED}', color: '#C9A84C', description: 'FTG is now the infrastructure of their business. Open-source API means they build custom tools on top. FTG Ventures funds the best ones. Virtuous cycle.' },
      { profile: 'Influencers', icon: '\u{1F3A4}', color: '#A78BFA', description: 'Platform is the #1 authority in trade data globally. Being an FTG influencer carries real prestige. Top influencers earning 50K+ EUR/year from the platform ecosystem.' },
      { profile: 'Financiers', icon: '\u{1F3E6}', color: '#34D399', description: 'FTG is the Bloomberg Terminal of trade finance. Government-endorsed data. Compliance suite saves millions in regulatory costs. Banks cannot afford NOT to use it.' },
      { profile: 'Investors', icon: '\u{1F4C8}', color: '#60A5FA', description: 'FTG Ventures provides co-investment opportunities. Platform valuation at 240-540M EUR means early investors have massive returns. Data moat is unassailable.' },
    ],
    metrics: {
      seoPages: '1M+',
      organicTraffic: '10M+/mo',
      freeUsers: '500,000+/mo',
      payingUsers: 20000,
      totalMrr: 2500000,
      costs: 500000,
      netProfit: 2000000,
      margin: '80%',
      keyMetric: { label: 'Valuation', value: '240-540M EUR' },
    },
  },
]

// ── SUMMARY TABLE ───────────────────────────────────────────────────────────

interface PalierSummary {
  palier: number
  score: string
  timeline: string
  mrr: string
  marge: string
  payingUsers: string
  seoPages: string
  keyUnlock: string
  cumulativeProfit: string
}

const SUMMARY_TABLE: PalierSummary[] = [
  { palier: 0, score: '64', timeline: 'Now', mrr: '0 EUR', marge: '-890 EUR', payingUsers: '0', seoPages: '0', keyUnlock: 'Product ready', cumulativeProfit: '-890 EUR' },
  { palier: 1, score: '71', timeline: 'S1-S2', mrr: '370 EUR', marge: '-520 EUR', payingUsers: '4', seoPages: '690', keyUnlock: 'SEO foundation', cumulativeProfit: '-2,300 EUR' },
  { palier: 2, score: '76', timeline: 'S3-S4', mrr: '1,380 EUR', marge: '+490 EUR', payingUsers: '15', seoPages: '690', keyUnlock: 'Break-even', cumulativeProfit: '-1,320 EUR' },
  { palier: 3, score: '81', timeline: 'M2-M3', mrr: '4,140 EUR', marge: '+3,050 EUR', payingUsers: '45', seoPages: '1,000', keyUnlock: 'Prospection active', cumulativeProfit: '+4,780 EUR' },
  { palier: 4, score: '86', timeline: 'M3-M4', mrr: '11,040 EUR', marge: '+8,750 EUR', payingUsers: '120', seoPages: '2,000', keyUnlock: '10K MRR + marketplace', cumulativeProfit: '+22,280 EUR' },
  { palier: 5, score: '92', timeline: 'M5-M12', mrr: '32,200 EUR', marge: '+27,000 EUR', payingUsers: '350', seoPages: '3,000', keyUnlock: 'Scale ads + partners', cumulativeProfit: '+238,280 EUR' },
  { palier: 6, score: '94', timeline: 'M13-M15', mrr: '74,400 EUR', marge: '+62,400 EUR', payingUsers: '700', seoPages: '10,000', keyUnlock: 'Data explosion + enterprise', cumulativeProfit: '+425,480 EUR' },
  { palier: 7, score: '96', timeline: 'M16-M18', mrr: '183,000 EUR', marge: '+168,000 EUR', payingUsers: '1,500', seoPages: '50,000', keyUnlock: 'Transaction marketplace', cumulativeProfit: '+929,480 EUR' },
  { palier: 8, score: '97', timeline: 'M19-M21', mrr: '478,000 EUR', marge: '+448,000 EUR', payingUsers: '4,000', seoPages: '600,000', keyUnlock: 'Global 12 languages', cumulativeProfit: '+2,273,480 EUR' },
  { palier: 9, score: '98', timeline: 'M22-M24', mrr: '1,001,000 EUR', marge: '+941,000 EUR', payingUsers: '8,000', seoPages: '600,000+', keyUnlock: 'Million MRR', cumulativeProfit: '+5,096,480 EUR' },
  { palier: 10, score: '99', timeline: 'M25-M36', mrr: '2,500,000 EUR', marge: '+2,000,000 EUR', payingUsers: '20,000', seoPages: '1M+', keyUnlock: 'Exit-ready 240-540M EUR', cumulativeProfit: '+29,096,480 EUR' },
]

// ── DATA = REVENUE FORMULA ──────────────────────────────────────────────────

const DATA_FORMULA = [
  { input: 'More Data', output: 'More Opportunities', arrow: 'More Pages', result: 'More Traffic', final: 'More Revenue' },
  { input: 'More Data', output: 'Better AI Recommendations', arrow: 'Higher Conversion', result: 'Higher ARPU', final: '+Revenue/User' },
  { input: 'More Opportunities', output: 'More Products for Influencers', arrow: 'More Affiliate Revenue', result: 'Compounding', final: 'Network Effects' },
  { input: 'More Business Plans', output: 'More Financing Deals', arrow: 'Platform Commission', result: 'Transaction Rev', final: 'Recurring' },
  { input: 'More Countries/Products', output: 'More Niches', arrow: 'Less Competition', result: 'Higher Margins', final: 'Moat' },
]

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('fr-FR')
}

function eur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M EUR'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K EUR'
  return n.toLocaleString('fr-FR') + ' EUR'
}

// ── COMPONENT ───────────────────────────────────────────────────────────────

export default function ScalePlan() {
  const [expandedPalier, setExpandedPalier] = useState<number | null>(6)
  const [showAllSummary, setShowAllSummary] = useState(true)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/growth" className="text-xs text-gray-500 hover:text-[#C9A84C] transition-colors">
              Growth Plan
            </Link>
            <span className="text-xs text-gray-600">/</span>
            <span className="text-xs text-[#C9A84C]">Paliers 6-10</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Scaling Strategy: Paliers 6 &rarr; 10</h1>
          <p className="text-sm text-gray-400 mt-1">
            From 32K MRR to 2.5M MRR. Data explosion, marketplace flywheel, global dominance, exit-ready.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Target Valuation</div>
            <div className="text-xl font-bold text-[#EF4444]">240-540M EUR</div>
          </div>
        </div>
      </div>

      {/* Core Thesis: DATA = REVENUE */}
      <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Core Thesis: DATA = REVENUE</h2>
        <p className="text-xs text-gray-400 mb-4">Every data point added creates compounding value across all revenue streams and user profiles.</p>
        <div className="space-y-2">
          {DATA_FORMULA.map((row, i) => (
            <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
              <span className="px-2 py-1 rounded bg-[#C9A84C]/10 text-[#C9A84C] font-medium whitespace-nowrap">{row.input}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-white/5 text-gray-300 whitespace-nowrap">{row.output}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-white/5 text-gray-300 whitespace-nowrap">{row.arrow}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-white/5 text-gray-300 whitespace-nowrap">{row.result}</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-[#34D399]/10 text-[#34D399] font-bold whitespace-nowrap">{row.final}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Palier 6', value: eur(74400), sub: 'M13-15', color: '#F59E0B' },
          { label: 'Palier 7', value: eur(183000), sub: 'M16-18', color: '#A78BFA' },
          { label: 'Palier 8', value: eur(478000), sub: 'M19-21', color: '#34D399' },
          { label: 'Palier 9', value: '1M EUR/mo', sub: 'M22-24', color: '#EC4899' },
          { label: 'Palier 10', value: '2.5M EUR/mo', sub: 'M25-36', color: '#EF4444' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 border border-white/10 bg-[#0D1117]">
            <div className="text-[10px] text-gray-500 mb-1">{card.label} MRR</div>
            <div className="text-lg font-bold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Score Progression */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-lg font-bold text-white mb-4">Score Progression: 92 &rarr; 99</h2>
        <div className="flex items-center gap-1">
          {[
            { score: 92, label: 'P5', color: '#6B7280' },
            { score: 94, label: 'P6', color: '#F59E0B' },
            { score: 96, label: 'P7', color: '#A78BFA' },
            { score: 97, label: 'P8', color: '#34D399' },
            { score: 98, label: 'P9', color: '#EC4899' },
            { score: 99, label: 'P10', color: '#EF4444' },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-1 flex-1">
              <div className="flex-1">
                <div className="text-center mb-1">
                  <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.label}</span>
                </div>
                <div className="h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black relative overflow-hidden"
                  style={{ background: item.color }}>
                  {item.score}
                </div>
              </div>
              {i < 5 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" className="shrink-0">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Palier Details */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Palier Details</h2>

        {PALIERS.map(palier => {
          const isExpanded = expandedPalier === palier.id
          const agentTasks = palier.tasks.filter(t => t.tag === 'AGENT').length
          const humanTasks = palier.tasks.filter(t => t.tag === 'HUMAN').length

          return (
            <div key={palier.id} className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
              {/* Palier Header */}
              <button
                onClick={() => setExpandedPalier(isExpanded ? null : palier.id)}
                className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-black shrink-0"
                    style={{ background: palier.color }}>
                    {palier.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-white">Palier {palier.id}: {palier.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{palier.timeline}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: palier.color + '15', color: palier.color }}>
                        Score {palier.scoreFrom} &rarr; {palier.scoreTo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{palier.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <div className="text-lg font-bold" style={{ color: palier.color }}>{eur(palier.metrics.totalMrr)}</div>
                    <div className="text-[10px] text-gray-500">MRR</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-gray-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5">

                  {/* Metrics Grid */}
                  <div className="p-5 border-b border-white/5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                      {[
                        { label: 'SEO Pages', value: palier.metrics.seoPages },
                        { label: 'Traffic', value: palier.metrics.organicTraffic },
                        { label: 'Free Users', value: palier.metrics.freeUsers },
                        { label: 'Paying Users', value: fmt(palier.metrics.payingUsers) },
                        { label: 'Total MRR', value: eur(palier.metrics.totalMrr), highlight: true },
                        { label: 'Costs', value: eur(palier.metrics.costs) },
                        { label: 'Net Profit', value: eur(palier.metrics.netProfit), highlight: true },
                        { label: 'Margin', value: palier.metrics.margin },
                      ].map(m => (
                        <div key={m.label} className="text-center">
                          <div className="text-[10px] text-gray-500 mb-0.5">{m.label}</div>
                          <div className={`text-sm font-bold ${m.highlight ? 'text-[#34D399]' : 'text-white'}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {palier.metrics.keyMetric && (
                      <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg"
                        style={{ background: palier.color + '10' }}>
                        <span className="text-xs text-gray-400">{palier.metrics.keyMetric.label}:</span>
                        <span className="text-sm font-black" style={{ color: palier.color }}>{palier.metrics.keyMetric.value}</span>
                      </div>
                    )}
                  </div>

                  {/* Revenue Streams */}
                  <div className="p-5 border-b border-white/5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Revenue Streams</h4>
                    <div className="flex flex-wrap gap-2">
                      {palier.revenueStreams.map(rs => (
                        <div key={rs.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                          <span className="text-xs text-gray-300">{rs.name}</span>
                          <span className="text-xs font-bold text-[#C9A84C]">{eur(rs.amount)}/mo</span>
                          {rs.isNew && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#34D399]/15 text-[#34D399]">NEW</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Profile Impacts */}
                  <div className="p-5 border-b border-white/5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Impact Per User Profile</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {palier.profileImpacts.map(pi => (
                        <div key={pi.profile} className="rounded-lg border border-white/5 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-base">{pi.icon}</span>
                            <span className="text-sm font-bold" style={{ color: pi.color }}>{pi.profile}</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{pi.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                        Execution Tasks ({palier.tasks.length})
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span>{agentTasks} agent</span>
                        <span>{humanTasks} human</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {palier.tasks.map(task => (
                        <div key={task.id} className="rounded-lg border border-white/5 p-4 hover:border-white/10 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              task.status === 'done' ? 'bg-green-500/20 text-green-400' :
                              task.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-white/5 text-gray-500'
                            }`}>
                              {task.status === 'done' ? '!' : task.status === 'in-progress' ? '~' : ' '}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="text-sm font-semibold text-white">{task.title}</h4>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  task.tag === 'AGENT'
                                    ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                                    : 'bg-[#60A5FA]/15 text-[#60A5FA]'
                                }`}>
                                  {task.tag}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  task.impact === 'Critical' ? 'bg-red-500/15 text-red-400' :
                                  task.impact === 'High' ? 'bg-orange-500/15 text-orange-400' :
                                  'bg-gray-500/15 text-gray-400'
                                }`}>
                                  {task.impact}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed mb-2">{task.desc}</p>
                              <div className="flex items-center gap-4 text-[11px] text-gray-500">
                                <span>Effort: {task.effort}</span>
                                {task.dependencies && <span>Depends on: {task.dependencies}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Master Summary Table */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">All 10 Paliers: Master Summary</h2>
          <button
            onClick={() => setShowAllSummary(!showAllSummary)}
            className="text-xs text-[#C9A84C] hover:underline"
          >
            {showAllSummary ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {showAllSummary && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/5">
                  <th className="px-4 py-3 font-medium sticky left-0 bg-[#0D1117]">Palier</th>
                  <th className="px-4 py-3 font-medium text-center">Score</th>
                  <th className="px-4 py-3 font-medium">Timeline</th>
                  <th className="px-4 py-3 font-medium text-right">MRR</th>
                  <th className="px-4 py-3 font-medium text-right">Marge/mo</th>
                  <th className="px-4 py-3 font-medium text-right">Paying</th>
                  <th className="px-4 py-3 font-medium text-right">SEO Pages</th>
                  <th className="px-4 py-3 font-medium">Key Unlock</th>
                  <th className="px-4 py-3 font-medium text-right">Cumul. Profit</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_TABLE.map((row, i) => {
                  const isScalePalier = row.palier >= 6
                  const palierColor = row.palier === 6 ? '#F59E0B' : row.palier === 7 ? '#A78BFA' : row.palier === 8 ? '#34D399' : row.palier === 9 ? '#EC4899' : row.palier === 10 ? '#EF4444' : undefined

                  return (
                    <tr key={row.palier}
                      className={`${i % 2 === 0 ? 'bg-white/[0.01]' : ''} ${isScalePalier ? 'border-l-2' : ''}`}
                      style={isScalePalier && palierColor ? { borderLeftColor: palierColor } : {}}>
                      <td className="px-4 py-2.5 font-bold sticky left-0 bg-[#0D1117]"
                        style={palierColor ? { color: palierColor } : { color: '#9CA3AF' }}>
                        P{row.palier}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block w-8 text-center py-0.5 rounded text-[10px] font-bold ${
                          parseInt(row.score) >= 96 ? 'bg-[#34D399]/15 text-[#34D399]' :
                          parseInt(row.score) >= 90 ? 'bg-[#C9A84C]/15 text-[#C9A84C]' :
                          'bg-white/5 text-gray-400'
                        }`}>
                          {row.score}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">{row.timeline}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: palierColor ?? '#C9A84C' }}>{row.mrr}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: row.marge.startsWith('+') ? '#34D399' : '#EF4444' }}>{row.marge}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{row.payingUsers}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{row.seoPages}</td>
                      <td className="px-4 py-2.5 text-gray-400 max-w-[180px] truncate">{row.keyUnlock}</td>
                      <td className="px-4 py-2.5 text-right font-medium" style={{ color: row.cumulativeProfit.startsWith('+') ? '#34D399' : '#EF4444' }}>{row.cumulativeProfit}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue Acceleration Visual */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-lg font-bold text-white mb-4">MRR Acceleration Curve</h2>
        <div className="space-y-3">
          {PALIERS.map(p => {
            const maxMrr = 2500000
            const pct = Math.min((p.metrics.totalMrr / maxMrr) * 100, 100)
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">P{p.id}: {p.name}</span>
                  <span className="text-xs font-bold" style={{ color: p.color }}>{eur(p.metrics.totalMrr)}/mo</span>
                </div>
                <div className="h-6 rounded-lg bg-white/5 overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 rounded-lg flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max(pct, 3)}%`, background: `linear-gradient(90deg, ${p.color}40, ${p.color})` }}>
                    <span className="text-[9px] font-bold text-black/80">{p.timeline}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Growth multiplier P5&rarr;P10: <span className="text-white font-bold">78x</span> (32K &rarr; 2.5M MRR)
          </div>
          <div className="text-xs text-gray-500">
            Cumulative profit M36: <span className="text-[#34D399] font-bold">~29M EUR</span>
          </div>
        </div>
      </div>

      {/* Exit Scenarios */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-lg font-bold text-white mb-4">Exit Scenarios at Palier 10 (Month 36)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Lifestyle Business',
              color: '#34D399',
              desc: 'Keep 100% ownership. 12M+ EUR ARR with 80%+ margins. 2M+ EUR/mo profit. Team of 15-25. No external investors needed.',
              valuation: 'N/A (cash flow)',
              annual: '24M+ EUR/yr profit',
            },
            {
              title: 'Series A/B',
              color: '#A78BFA',
              desc: 'Raise at 10-15x ARR. Target investors: Sequoia, a16z, Accel, Insight Partners. Use funds to 10x growth. Path to IPO.',
              valuation: '240-540M EUR',
              annual: 'Accelerated growth',
            },
            {
              title: 'Strategic Acquisition',
              color: '#EF4444',
              desc: 'Acquisition target for S&P Global ($160B), Bloomberg, Refinitiv (LSEG), or major trade finance institution. Data moat is the asset.',
              valuation: '300-600M EUR',
              annual: 'Exit premium 15-20x',
            },
          ].map(scenario => (
            <div key={scenario.title} className="rounded-lg border p-5" style={{ borderColor: scenario.color + '30' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: scenario.color }}>{scenario.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">{scenario.desc}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Valuation</span>
                  <span className="text-xs font-bold text-white">{scenario.valuation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Return</span>
                  <span className="text-xs font-bold" style={{ color: scenario.color }}>{scenario.annual}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insight Callout */}
      <div className="rounded-xl border-2 border-[#C9A84C]/40 bg-gradient-to-r from-[#C9A84C]/5 to-transparent p-6">
        <h2 className="text-lg font-bold text-white mb-3">Why This Is Achievable</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Each palier builds on the previous', desc: 'No quantum leaps needed. P6 data feeds P7 marketplace. P7 transactions fund P8 expansion. P8 global reach drives P9 lock-in. P9 network effects enable P10 exit.' },
            { title: '90%+ AI-agent executable', desc: 'Most tasks are data expansion, page generation, API integration -- things AI agents excel at. Human effort is strategic: partnerships, hiring, fundraising.' },
            { title: 'Compounding data moat', desc: 'Every day of operation adds more data, more users, more transactions. Competitors cannot replicate 3 years of compounded data in any timeframe.' },
            { title: 'Multiple revenue streams reduce risk', desc: 'By P9: subscriptions + commissions + API + insurance + certification. No single stream > 70% of revenue. Diversified, resilient.' },
          ].map(point => (
            <div key={point.title} className="space-y-1">
              <h4 className="text-sm font-semibold text-[#C9A84C]">{point.title}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{point.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 pb-8">
        Feel The Gap Scaling Strategy v1.0 -- Generated 2026-04-10 -- Paliers 6-10
      </div>
    </div>
  )
}
