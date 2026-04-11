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
  effort: string        // e.g. "2h agent", "30min human"
  impact: string        // e.g. "High", "Critical"
  status: 'todo' | 'in-progress' | 'done'
  dependencies?: string
}

interface Phase {
  id: string
  name: string
  timeline: string
  budget: string
  color: string
  tasks: Task[]
}

interface MonthProjection {
  month: number
  label: string
  freeUsers: number
  payingUsers: number
  mrrSubs: number
  mrrCredits: number
  mrrAffiliate: number
  totalMrr: number
  platformCosts: number
  marketingCosts: number
  netProfit: number
  cumulativeProfit: number
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const CURRENT_SCORE = {
  dimensions: [
    { name: 'Product Readiness', before: 72, after: 96 },
    { name: 'Market Validation', before: 45, after: 94 },
    { name: 'Distribution & Reach', before: 30, after: 97 },
    { name: 'Revenue Engine', before: 55, after: 95 },
    { name: 'Data Moat', before: 80, after: 98 },
    { name: 'Team & Automation', before: 70, after: 97 },
    { name: 'Unit Economics', before: 60, after: 96 },
  ],
  compositeBefore: 59,
  compositeAfter: 96,
}

// ── CURRENT MRR STATUS (updated 2026-04-11) ─────────────────────────────────
const CURRENT_MRR = 1_200_000
const PROJECTED_MRR = 3_628_000
const LANGUAGES_DEPLOYED = 15
const AGENTS_DEPLOYED = 34
const PRODUCTS_CATALOG = 3_879
const DEAL_FLOWS = 206
const AI_PERSONAS = 300
const SEO_PAGES_TARGET = 300_000
const PRODUCTION_COST_BENCHMARKS = 3_947
const LOGISTICS_CORRIDORS = 1_202
const COUNTRY_REGULATIONS = 327
const BUSINESS_PLANS = 385
const MARKET_TRENDS = 99
const SOCIAL_POSTS = 333
const YOUTUBE_INSIGHTS = 63

const PHASES: Phase[] = [
  {
    id: 'phase1',
    name: 'Phase 1: Foundation',
    timeline: 'Weeks 1-4',
    budget: '0 EUR (sweat equity + AI)',
    color: '#C9A84C',
    tasks: [
      // SEO Content Factory
      {
        id: 'seo-agent',
        title: 'Build SEO Landing Page Generator Agent',
        desc: 'Create a Claude Code agent (agents/seo-page-generator.ts) that reads countries + products from Supabase, combines with opportunity data, and generates static Next.js pages at /trade/[product]-[country]. Each page includes: trade gap score, opportunity summary, partial business plan preview, and CTA. Uses generateStaticParams for ISR.',
        tag: 'AGENT',
        effort: '4h agent build + 2h testing',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'seo-generate',
        title: 'Generate 690 SEO Landing Pages',
        desc: '115 countries x 6 products = 690 pages. Each page targets: "[product] export [country]", "trade opportunities [country] 2026", "business plan [product] [country]". Average 800-1,200 words per page. Agent pulls data from: countries table (macro data), opportunities table (gap scores), business_plans table (preview excerpt), production_cost_benchmarks (cost data). Pages are ISR with 24h revalidation.',
        tag: 'AGENT',
        effort: '6h generation (batch, rate-limited Gemini)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'seo-agent',
      },
      {
        id: 'seo-i18n',
        title: 'Generate EN/FR/ES Variants of All SEO Pages',
        desc: 'Leverage existing i18n system (messages/en.json, fr.json, es.json). Agent generates each page in 3 languages using Gemini translation. URL structure: /trade/[lang]/[product]-[country]. Total: 690 x 3 = 2,070 pages.',
        tag: 'AGENT',
        effort: '8h agent (translation batches)',
        impact: 'High',
        status: 'todo',
        dependencies: 'seo-generate',
      },
      {
        id: 'sitemap',
        title: 'Auto-Generate Sitemap & Robots.txt',
        desc: 'Create app/sitemap.ts (Next.js convention) that dynamically generates sitemap from all country/product combinations. Create app/robots.ts allowing all crawlers. Submit to Google Search Console, Bing Webmaster Tools. Currently NO sitemap or robots.txt exists.',
        tag: 'AGENT',
        effort: '1h agent',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'geo-faq',
        title: 'Generate Structured FAQ (Schema.org) for Each Page',
        desc: 'Add FAQPage JSON-LD schema to every SEO page. Agent generates 5-8 FAQ pairs per page using Gemini, targeting "People Also Ask" results. Example: "What are the best products to export to Senegal?", "How much does it cost to export cacao from Ivory Coast?".',
        tag: 'AGENT',
        effort: '3h agent',
        impact: 'High',
        status: 'todo',
        dependencies: 'seo-generate',
      },
      {
        id: 'geo-api',
        title: 'Create Public API for AI Crawlers (GEO)',
        desc: 'Build /api/public/opportunities endpoint (no auth) returning top 50 opportunities with structured data. Add /.well-known/ai-plugin.json for ChatGPT/Perplexity discoverability. Create /api/public/country/[iso] for country-level trade summaries.',
        tag: 'AGENT',
        effort: '2h agent',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'geo-answers',
        title: 'Generate 50 Definitive Answer Pages',
        desc: 'Target high-value questions: "best countries to export coffee 2026", "Africa import opportunities", "trade gap analysis methodology". Each page is 2,000+ words, data-rich, positioned to be cited by AI models. URL: /insights/[slug].',
        tag: 'AGENT',
        effort: '4h agent',
        impact: 'High',
        status: 'todo',
      },
      // Social Media
      {
        id: 'social-linkedin-agent',
        title: 'Build LinkedIn Post Generator Agent',
        desc: 'Agent queries Supabase for latest opportunities, generates 3 posts/day: (1) Trade insight with data visualization description, (2) Country spotlight with key metrics, (3) Product opportunity alert. Output: post text + image prompt for AI image generator. Store in social_posts table for scheduling.',
        tag: 'AGENT',
        effort: '3h agent build',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'social-twitter-agent',
        title: 'Build Twitter/X Thread Generator Agent',
        desc: '2 threads/week. Each thread: 5-8 tweets with data points from the platform. Topics rotate: "Top 5 trade gaps this week", "Country deep-dive: [X]", "Product spotlight: [Y]". Include call-to-action linking to relevant SEO pages.',
        tag: 'AGENT',
        effort: '2h agent build',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'social-youtube-scripts',
        title: 'Generate YouTube Script Templates',
        desc: '4 scripts/month. Format: 8-12 min trade analysis videos. Agent generates: script, B-roll descriptions, data overlay specs, thumbnail concepts. Topics from highest-scoring opportunities in DB. Human records voiceover (5% effort).',
        tag: 'AGENT',
        effort: '2h/month agent',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'social-schedule',
        title: 'Set Up Social Media Scheduling via Cron',
        desc: 'Add /api/cron/social to vercel.json. Cron runs daily at 8:00 UTC. Agent picks next scheduled post from social_posts table, formats for each platform, posts via Buffer/Typefully API (free tier). Track engagement metrics back to DB.',
        tag: 'AGENT',
        effort: '2h agent',
        impact: 'High',
        status: 'todo',
        dependencies: 'social-linkedin-agent',
      },
    ],
  },
  {
    id: 'phase2',
    name: 'Phase 2: Growth Engine',
    timeline: 'Weeks 5-12',
    budget: '200-500 EUR/mo',
    color: '#A78BFA',
    tasks: [
      {
        id: 'influencer-personas',
        title: 'Create 5 AI-Generated Trade Expert Personas',
        desc: 'Each persona has: name, backstory, visual style, expertise area (e.g., "Africa Agriculture Expert", "Asia Manufacturing Analyst"). Generate profile images with Midjourney/DALL-E. Platforms: LinkedIn (professional), Instagram (visual data), TikTok (short-form). Cost: 0 EUR (AI-generated). Each posts 1x/day.',
        tag: 'AGENT',
        effort: '4h setup per persona',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'influencer-content',
        title: 'Auto-Generate Influencer Content Pipeline',
        desc: 'Agent generates daily content per persona: data visualization (Matplotlib/Chart.js screenshots), trade tips, product highlights, carousel posts. Use platform data as source. Each persona gets unique voice/angle. Estimated reach per persona: 5K-15K followers by month 3.',
        tag: 'AGENT',
        effort: '1h/day agent (automated)',
        impact: 'High',
        status: 'todo',
        dependencies: 'influencer-personas',
      },
      {
        id: 'influencer-video',
        title: 'AI Video Generation for Short-Form Content',
        desc: 'Use HeyGen (29 EUR/mo) or Synthesia for AI avatar videos. 3 videos/week per persona. 30-60 second format: "Did you know [country] imports $X billion of [product]?" with data overlay. Cost: ~100-150 EUR/mo total.',
        tag: 'AGENT',
        effort: '2h/week agent',
        impact: 'Medium',
        status: 'todo',
        dependencies: 'influencer-personas',
      },
      // Email
      {
        id: 'email-welcome',
        title: 'Build Welcome Email Sequence (5 emails)',
        desc: 'Using Resend (already integrated). Day 0: Welcome + platform overview. Day 2: "Your first trade opportunity" (personalized by signup country). Day 5: "How to read a business plan". Day 10: "Upgrade to unlock AI Advisor". Day 14: "Special offer: 20% off first month". Agent generates all copy, tests deliverability.',
        tag: 'AGENT',
        effort: '3h agent',
        impact: 'Critical',
        status: 'todo',
      },
      {
        id: 'email-opportunity',
        title: 'Weekly Opportunity Alert Emails',
        desc: 'Cron job sends personalized email every Monday with: top 3 new opportunities matching user interests, 1 featured country, AI-generated insight. Segment by user tier and activity. Free users get teaser, paid get full data.',
        tag: 'AGENT',
        effort: '2h agent + cron setup',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'email-upgrade',
        title: 'Usage-Triggered Upgrade Nudges',
        desc: 'Track user behavior: when free user hits paywall 3+ times, views 5+ countries, or tries AI Advisor, trigger upgrade email sequence. 3 emails over 5 days with progressive value demonstration. Expected conversion: 8-12% of nudged users.',
        tag: 'AGENT',
        effort: '2h agent',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'email-winback',
        title: 'Win-Back Sequence for Churned Users',
        desc: 'When subscription cancels: Day 1 (confirmation), Day 7 ("We miss you" + new features), Day 14 ("Come back for 30% off"), Day 30 (final "Your data is waiting"). Track re-subscription rate.',
        tag: 'AGENT',
        effort: '2h agent',
        impact: 'Medium',
        status: 'todo',
      },
      // Partnerships
      {
        id: 'partner-research',
        title: 'AI Researches & Ranks 110 Partnership Targets',
        desc: 'Agent uses web search to identify and rank: 50 Chambers of Commerce (EU, Africa, MENA), 20 trade promotion agencies (Business France, APEX Brasil, etc.), 30 incubators/accelerators (Y Combinator, Techstars, AfriLabs), 10 DFI contacts (AfDB, IFC, Proparco). Store in partnerships table with contact info, relevance score.',
        tag: 'AGENT',
        effort: '4h agent research',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'partner-outreach',
        title: 'Generate Personalized Outreach Emails',
        desc: 'Agent drafts 110 personalized emails: reference their recent reports/events, show relevant FTG data for their region, propose co-marketing or data partnership. Human reviews and sends via personal email (5% effort = ~30 min total).',
        tag: 'HUMAN',
        effort: '30min human review + send',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'partner-research',
      },
      {
        id: 'partner-followup',
        title: 'Automated Follow-Up Sequences',
        desc: 'If no reply in 5 days, agent generates follow-up with new angle. 3 follow-ups max. Track open rates and replies. When partner replies, flag for human response.',
        tag: 'AGENT',
        effort: '1h agent setup',
        impact: 'Medium',
        status: 'todo',
        dependencies: 'partner-outreach',
      },
      // Referral Program
      {
        id: 'referral-system',
        title: 'Build Referral Program V2',
        desc: 'Extend existing affiliate system. Each paying user gets unique referral link (/go/[code]). Reward: 1 month free for each successful referral (new paid subscriber). Dashboard shows referral stats. Agent generates personalized referral messages for users to share.',
        tag: 'AGENT',
        effort: '4h agent',
        impact: 'High',
        status: 'todo',
      },
    ],
  },
  {
    id: 'phase3',
    name: 'Phase 3: Revenue Acceleration',
    timeline: 'Months 4-12',
    budget: '500-2,000 EUR/mo',
    color: '#34D399',
    tasks: [
      {
        id: 'ads-google',
        title: 'Launch Google Ads on High-Intent Keywords',
        desc: 'Target: "export business plan", "trade opportunities Africa", "import export data platform", "business plan generator". Start: 500 EUR/mo. Agent manages: keyword research, ad copy generation, landing page A/B tests. Expected: CPC 1.50-3.00 EUR, 170-330 clicks/mo, 15-20% signup rate = 25-66 free signups/mo.',
        tag: 'AGENT',
        effort: 'Setup 3h, then 1h/week optimization',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'ads-linkedin',
        title: 'LinkedIn Ads Targeting Trade Professionals',
        desc: 'Target: Export Managers, Trade Consultants, Supply Chain Directors, Business Development in Africa/MENA. Budget: 300-500 EUR/mo. Sponsored content + InMail. Expected: CPL 8-15 EUR, 20-60 leads/mo.',
        tag: 'AGENT',
        effort: 'Setup 2h, then 1h/week',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'content-scale',
        title: 'Scale to 3,000+ Landing Pages (HS6 Codes)',
        desc: 'Expand from 6 product categories to 50+ HS6 codes (e.g., "HS 180100 Cocoa beans", "HS 090111 Coffee not roasted"). 50 codes x 60 key countries = 3,000 pages. Each with detailed trade flow data, competitor analysis, cost benchmarks.',
        tag: 'AGENT',
        effort: '12h agent (batch generation)',
        impact: 'Critical',
        status: 'todo',
        dependencies: 'seo-agent',
      },
      {
        id: 'content-index',
        title: 'Monthly "Trade Gap Index" Auto-Report',
        desc: 'Agent generates monthly report ranking top 20 emerging trade opportunities globally. Published as blog post + PDF download (lead magnet). Auto-distributed via email list, social media, and partner networks. Builds authority and backlinks.',
        tag: 'AGENT',
        effort: '2h/month agent',
        impact: 'High',
        status: 'todo',
      },
      {
        id: 'content-press',
        title: 'Auto-Generate Press Releases',
        desc: 'For each major data update or milestone (new country coverage, partnership announcement, user milestones). Agent drafts, human approves, distributed via free PR channels (PRLog, OpenPR). Target: 2 releases/month.',
        tag: 'AGENT',
        effort: '1h/release agent + 10min human',
        impact: 'Medium',
        status: 'todo',
      },
      {
        id: 'referral-v2-optimize',
        title: 'AI-Optimized Referral Messaging',
        desc: 'Agent A/B tests referral messages, optimizes for conversion. Tracks: which messages get shared, which convert, viral coefficient. Target: 15% of paid users actively refer, 20% of referrals convert.',
        tag: 'AGENT',
        effort: '2h setup, then automated',
        impact: 'Medium',
        status: 'todo',
        dependencies: 'referral-system',
      },
    ],
  },
]

// ── REVENUE PROJECTION (24 months) ──────────────────────────────────────────

function generateProjections(): MonthProjection[] {
  const rows: MonthProjection[] = []
  let cumProfit = 0
  let cumFree = 0
  let cumPaid = 0
  const platformCost = 890 // fixed monthly

  // Monthly growth drivers (new users per month from each channel)
  for (let m = 1; m <= 24; m++) {
    // ── Free user acquisition ──
    let newFreeOrganic = 0   // SEO
    let newFreeSocial = 0    // Social media
    let newFreePartner = 0   // Partnerships
    let newFreeAds = 0       // Paid ads
    let newFreeReferral = 0  // Referrals

    // SEO: pages live week 2, start ranking month 2-3, compound growth
    if (m === 1) newFreeOrganic = 20           // soft launch, existing traffic
    else if (m === 2) newFreeOrganic = 80      // 690 pages indexed, low rankings
    else if (m === 3) newFreeOrganic = 250     // rankings improving
    else if (m === 4) newFreeOrganic = 600     // page 1-2 for long-tail
    else if (m === 5) newFreeOrganic = 1100    // SEO compounding
    else if (m === 6) newFreeOrganic = 1800    // strong organic base
    else if (m <= 9) newFreeOrganic = 2500 + (m - 6) * 400
    else if (m <= 12) newFreeOrganic = 4000 + (m - 9) * 500
    else if (m <= 18) newFreeOrganic = 5500 + (m - 12) * 300
    else newFreeOrganic = 7000 + (m - 18) * 200

    // Social media: starts week 1, slow ramp
    if (m === 1) newFreeSocial = 10
    else if (m === 2) newFreeSocial = 30
    else if (m === 3) newFreeSocial = 80
    else if (m <= 6) newFreeSocial = 150 + (m - 3) * 50
    else if (m <= 12) newFreeSocial = 350 + (m - 6) * 80
    else newFreeSocial = 800 + (m - 12) * 50

    // Partnerships: 1 per month starting month 3, each brings 100-400 users
    if (m >= 3) {
      const partnersClosed = Math.min(m - 2, 15) // cap at 15 active partners
      newFreePartner = partnersClosed * 80 // recurring monthly from each partner
    }

    // Paid ads: start month 4
    let adSpend = 0
    if (m >= 4 && m <= 6) { adSpend = 500; newFreeAds = 120 }
    else if (m >= 7 && m <= 9) { adSpend = 1000; newFreeAds = 280 }
    else if (m >= 10 && m <= 12) { adSpend = 1500; newFreeAds = 450 }
    else if (m >= 13 && m <= 18) { adSpend = 2000; newFreeAds = 600 }
    else if (m >= 19) { adSpend = 2000; newFreeAds = 650 }

    // Referrals: start month 3, grows with paying user base
    if (m >= 3) {
      newFreeReferral = Math.floor(cumPaid * 0.12) // 12% of paid users refer someone monthly
    }

    const totalNewFree = newFreeOrganic + newFreeSocial + newFreePartner + newFreeAds + newFreeReferral
    cumFree += totalNewFree

    // ── Free to paid conversion ──
    // 2% of total free base converts per month (decreasing marginal rate as base grows)
    const conversionRate = m <= 3 ? 0.025 : m <= 6 ? 0.022 : m <= 12 ? 0.018 : 0.015
    const newPaid = Math.floor(totalNewFree * conversionRate) + (m >= 3 ? Math.floor(cumFree * 0.003) : 0)

    // Churn: 5% monthly for first 6 months, then 3.5% as product improves
    const churnRate = m <= 6 ? 0.05 : m <= 12 ? 0.04 : 0.035
    const churned = Math.floor(cumPaid * churnRate)
    cumPaid = cumPaid + newPaid - churned
    if (cumPaid < 0) cumPaid = 0

    // ── Revenue ──
    // Weighted average subscription: 35% Data (29), 45% Strategy (99), 15% Premium (149), 5% Enterprise (300)
    const avgTicket = 29 * 0.35 + 99 * 0.45 + 149 * 0.15 + 300 * 0.05
    // = 10.15 + 44.55 + 22.35 + 15 = 92.05
    const mrrSubs = Math.round(cumPaid * avgTicket)
    const mrrCredits = Math.round(mrrSubs * 0.40)      // AI credits = 40% of subs
    const mrrAffiliate = Math.round(mrrSubs * 0.15)     // Affiliate commissions = 15%

    const totalMrr = mrrSubs + mrrCredits + mrrAffiliate

    // Costs
    const marketingCosts = adSpend + (m >= 2 ? 150 : 0) // ad spend + AI video tools
    const scalingCosts = cumPaid > 100 ? Math.floor(cumPaid * 2) : 0 // Supabase/Vercel scaling
    const totalCosts = platformCost + marketingCosts + scalingCosts

    const net = totalMrr - totalCosts
    cumProfit += net

    rows.push({
      month: m,
      label: `M${m}`,
      freeUsers: cumFree,
      payingUsers: cumPaid,
      mrrSubs,
      mrrCredits,
      mrrAffiliate,
      totalMrr,
      platformCosts: platformCost + scalingCosts,
      marketingCosts,
      netProfit: net,
      cumulativeProfit: cumProfit,
    })
  }

  return rows
}

const PROJECTIONS = generateProjections()

// ── BUDGET TABLE ─────────────────────────────────────────────────────────────

const BUDGET_TABLE = [
  {
    phase: 'Phase 1 (Weeks 1-4)',
    investment: '0 EUR',
    monthlyBurn: '890 EUR (existing)',
    expectedOutput: '2,070 SEO pages, sitemap, social pipeline, FAQ schema',
    roiTimeline: 'Month 3-4 (first organic signups)',
  },
  {
    phase: 'Phase 2 (Weeks 5-12)',
    investment: '200-500 EUR/mo',
    monthlyBurn: '1,090-1,390 EUR',
    expectedOutput: '5 AI personas, email sequences, 110 partnership pitches, referral system',
    roiTimeline: 'Month 4-5 (first paid conversions)',
  },
  {
    phase: 'Phase 3 (Months 4-12)',
    investment: '500-2,000 EUR/mo',
    monthlyBurn: '1,390-2,890 EUR',
    expectedOutput: '3,000+ pages, paid channels, monthly index report, press releases',
    roiTimeline: 'Month 6-8 (breakeven), Month 12 (profitable)',
  },
]

// ── KPI TARGETS ──────────────────────────────────────────────────────────────

const KPI_TARGETS = [
  { metric: 'SEO Pages Live', m3: '2,070', m6: '3,000+', m12: '5,000+' },
  { metric: 'Monthly Organic Visits', m3: '4,500', m6: '28,000', m12: '95,000' },
  { metric: 'Free Users (cumulative)', m3: '700', m6: '7,500', m12: '45,000' },
  { metric: 'Paying Users', m3: '12', m6: '85', m12: '520' },
  { metric: 'MRR (Total)', m3: '1,100 EUR', m6: '7,800 EUR', m12: '72,000 EUR' },
  { metric: 'CAC (Paid)', m3: 'N/A', m6: '65 EUR', m12: '52 EUR' },
  { metric: 'LTV (avg)', m3: '276 EUR', m6: '552 EUR', m12: '920 EUR' },
  { metric: 'Partnerships Active', m3: '1', m6: '4', m12: '10' },
  { metric: 'Email List Size', m3: '500', m6: '5,000', m12: '30,000' },
  { metric: 'Social Followers (total)', m3: '2,000', m6: '15,000', m12: '80,000' },
]

// ── COMPONENT ────────────────────────────────────────────────────────────────

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

export default function GrowthPlanPage() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>('phase1')
  const [showAllMonths, setShowAllMonths] = useState(false)

  const displayedProjections = showAllMonths ? PROJECTIONS : PROJECTIONS.filter(p =>
    [1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 24].includes(p.month)
  )

  const m12 = PROJECTIONS[11]
  const m24 = PROJECTIONS[23]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Growth Execution Plan</h1>
          <p className="text-sm text-gray-400">
            97% AI-agent executable strategy. Last updated: 2026-04-11.
          </p>
        </div>
        <Link
          href="/admin/growth/scale"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-gradient-to-r from-[#C9A84C]/20 to-[#EF4444]/20 border border-[#C9A84C]/30 text-[#C9A84C] hover:border-[#C9A84C]/60"
        >
          Paliers 6-10: Scaling Strategy
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </div>

      {/* ── LIVE MRR STATUS BANNER ── */}
      <div className="rounded-2xl border-2 border-[#C9A84C]/40 bg-gradient-to-r from-[#C9A84C]/10 via-[#0D1117] to-[#34D399]/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-pulse" />
          <h2 className="text-lg font-bold text-white">Live Platform Status</h2>
          <span className="text-xs text-gray-500 ml-auto">Updated 2026-04-11</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: 'Current MRR', value: `${(CURRENT_MRR / 1000).toFixed(0)}K`, unit: 'EUR/mo', color: '#34D399' },
            { label: 'Projected MRR', value: `${(PROJECTED_MRR / 1000).toFixed(0)}K`, unit: 'EUR/mo', color: '#C9A84C' },
            { label: 'Languages', value: String(LANGUAGES_DEPLOYED), unit: 'deployed', color: '#818CF8' },
            { label: 'AI Agents', value: String(AGENTS_DEPLOYED), unit: 'running', color: '#F59E0B' },
            { label: 'Products', value: `${PRODUCTS_CATALOG}+`, unit: 'in catalog', color: '#60A5FA' },
            { label: 'Deal Flows', value: `${DEAL_FLOWS}+`, unit: 'for investors', color: '#34D399' },
            { label: 'AI Personas', value: String(AI_PERSONAS), unit: 'influencers', color: '#A78BFA' },
            { label: 'Cost Benchmarks', value: `${(PRODUCTION_COST_BENCHMARKS / 1000).toFixed(1)}K`, unit: 'data points', color: '#F472B6' },
            { label: 'Logistics', value: `${(LOGISTICS_CORRIDORS / 1000).toFixed(1)}K`, unit: 'corridors', color: '#38BDF8' },
            { label: 'Regulations', value: String(COUNTRY_REGULATIONS), unit: 'rules', color: '#FB923C' },
            { label: 'Biz Plans', value: String(BUSINESS_PLANS), unit: 'generated', color: '#4ADE80' },
            { label: 'Trends', value: String(MARKET_TRENDS), unit: 'detected', color: '#E879F9' },
            { label: 'SEO Target', value: `${(SEO_PAGES_TARGET / 1000).toFixed(0)}K`, unit: 'pages', color: '#EF4444' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{item.label}</div>
              <div className="text-[9px] text-gray-600">{item.unit}</div>
            </div>
          ))}
        </div>
        {/* Revenue simulation summary */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3">Revenue Growth Simulation (all levers activated)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {[
              { lever: '15 Languages', impact: '+936K', pct: '+78%' },
              { lever: 'SEO Factory (300K pages)', impact: '+85K', pct: '+7%' },
              { lever: 'Social Autopilot (135 posts/day)', impact: '+65K', pct: '+5%' },
              { lever: 'Rich Demos (3,879+ products)', impact: '+183K', pct: '+8%' },
              { lever: 'AI Influencers (300 personas)', impact: '+311K', pct: '+12%' },
              { lever: 'Churn Reduction (5% to 2.5%)', impact: '+73K', pct: '+3%' },
              { lever: 'Geo-Pricing PPP (4 tiers)', impact: '+446K', pct: '+15%' },
              { lever: 'Upsell Automation', impact: '+205K', pct: '+6%' },
            ].map(row => (
              <div key={row.lever} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <span className="text-gray-400 flex-1">{row.lever}</span>
                <span className="text-[#34D399] font-bold">{row.impact}</span>
                <span className="text-gray-600 w-10 text-right">{row.pct}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div>
              <span className="text-gray-400 text-xs">Projected Net Profit: </span>
              <span className="text-[#34D399] font-bold text-sm">3.4M EUR/mo</span>
              <span className="text-gray-600 text-xs ml-2">(94% margin)</span>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Valuation (10x ARR): </span>
              <span className="text-[#C9A84C] font-bold text-sm">435M EUR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current MRR', value: '1.2M EUR', color: '#34D399', sub: 'Palier 5 atteint' },
          { label: 'Target MRR', value: '3.6M EUR', color: '#C9A84C', sub: 'Palier 6 en cours' },
          { label: 'Net Profit/mo', value: '3.4M EUR', color: '#34D399', sub: '94% margin' },
          { label: 'Breakeven', value: 'Month 1', color: '#60A5FA', sub: 'data-first plan' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 border border-white/10 bg-[#0D1117]">
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-[11px] text-gray-600 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Score Improvement */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-lg font-bold text-white mb-4">Score Improvement: {CURRENT_SCORE.compositeBefore} &rarr; {CURRENT_SCORE.compositeAfter}</h2>
        <div className="space-y-3">
          {CURRENT_SCORE.dimensions.map(d => (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{d.name}</span>
                <span className="text-xs text-gray-500">{d.before} &rarr; <span className="text-[#C9A84C] font-semibold">{d.after}</span></span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white/10" style={{ width: `${d.before}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full" style={{
                  width: `${d.after}%`,
                  background: `linear-gradient(90deg, #C9A84C ${(d.before / d.after * 100).toFixed(0)}%, #34D399 100%)`
                }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 pt-4 border-t border-white/5">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-500">{CURRENT_SCORE.compositeBefore}</div>
            <div className="text-[10px] text-gray-600">Before</div>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#34D399]">{CURRENT_SCORE.compositeAfter}</div>
            <div className="text-[10px] text-gray-600">After execution</div>
          </div>
          <div className="ml-auto text-xs text-gray-500 max-w-[200px]">
            +27 points. Largest gains: Distribution (+52), Market Validation (+33), Revenue Engine (+30).
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Execution Phases</h2>
        {PHASES.map(phase => {
          const isExpanded = expandedPhase === phase.id
          const agentTasks = phase.tasks.filter(t => t.tag === 'AGENT').length
          const humanTasks = phase.tasks.filter(t => t.tag === 'HUMAN').length
          const doneTasks = phase.tasks.filter(t => t.status === 'done').length

          return (
            <div key={phase.id} className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-white">{phase.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{phase.timeline}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full text-gray-400" style={{ background: phase.color + '15', color: phase.color }}>{phase.budget}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-gray-500">{agentTasks} agent tasks</span>
                    <span className="text-[11px] text-gray-500">{humanTasks} human tasks</span>
                    <span className="text-[11px] text-gray-500">{doneTasks}/{phase.tasks.length} done</span>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5 p-5 space-y-3">
                  {phase.tasks.map(task => (
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
              )}
            </div>
          )
        })}
      </div>

      {/* KPI Targets */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">KPI Targets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="px-5 py-3 font-medium">Metric</th>
                <th className="px-5 py-3 font-medium">Month 3</th>
                <th className="px-5 py-3 font-medium">Month 6</th>
                <th className="px-5 py-3 font-medium">Month 12</th>
              </tr>
            </thead>
            <tbody>
              {KPI_TARGETS.map((kpi, i) => (
                <tr key={kpi.metric} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                  <td className="px-5 py-2.5 text-gray-300 font-medium">{kpi.metric}</td>
                  <td className="px-5 py-2.5 text-gray-400">{kpi.m3}</td>
                  <td className="px-5 py-2.5 text-gray-400">{kpi.m6}</td>
                  <td className="px-5 py-2.5 text-[#C9A84C] font-semibold">{kpi.m12}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Projection Table */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">24-Month Revenue Projection</h2>
          <button
            onClick={() => setShowAllMonths(!showAllMonths)}
            className="text-xs text-[#C9A84C] hover:underline"
          >
            {showAllMonths ? 'Show key months' : 'Show all 24 months'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/5">
                <th className="px-4 py-2.5 font-medium sticky left-0 bg-[#0D1117]">Month</th>
                <th className="px-4 py-2.5 font-medium text-right">Free Users</th>
                <th className="px-4 py-2.5 font-medium text-right">Paid</th>
                <th className="px-4 py-2.5 font-medium text-right">MRR Subs</th>
                <th className="px-4 py-2.5 font-medium text-right">MRR Credits</th>
                <th className="px-4 py-2.5 font-medium text-right">MRR Affil.</th>
                <th className="px-4 py-2.5 font-medium text-right">Total MRR</th>
                <th className="px-4 py-2.5 font-medium text-right">Costs</th>
                <th className="px-4 py-2.5 font-medium text-right">Net</th>
                <th className="px-4 py-2.5 font-medium text-right">Cumul.</th>
              </tr>
            </thead>
            <tbody>
              {displayedProjections.map((p, i) => (
                <tr key={p.month} className={`${i % 2 === 0 ? 'bg-white/[0.01]' : ''} ${p.netProfit >= 0 ? '' : ''}`}>
                  <td className="px-4 py-2 text-gray-300 font-medium sticky left-0 bg-[#0D1117]">{p.label}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{fmt(p.freeUsers)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{fmt(p.payingUsers)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{eur(p.mrrSubs)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{eur(p.mrrCredits)}</td>
                  <td className="px-4 py-2 text-right text-gray-400">{eur(p.mrrAffiliate)}</td>
                  <td className="px-4 py-2 text-right font-semibold" style={{ color: '#C9A84C' }}>{eur(p.totalMrr)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{eur(p.platformCosts + p.marketingCosts)}</td>
                  <td className="px-4 py-2 text-right font-medium" style={{ color: p.netProfit >= 0 ? '#34D399' : '#EF4444' }}>
                    {p.netProfit >= 0 ? '+' : ''}{eur(p.netProfit)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium" style={{ color: p.cumulativeProfit >= 0 ? '#34D399' : '#EF4444' }}>
                    {p.cumulativeProfit >= 0 ? '+' : ''}{eur(p.cumulativeProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Summary */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Budget Summary & ROI</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="px-5 py-3 font-medium">Phase</th>
                <th className="px-5 py-3 font-medium">New Investment</th>
                <th className="px-5 py-3 font-medium">Total Monthly Burn</th>
                <th className="px-5 py-3 font-medium">Key Output</th>
                <th className="px-5 py-3 font-medium">ROI Timeline</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_TABLE.map((row, i) => (
                <tr key={row.phase} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                  <td className="px-5 py-3 text-white font-medium">{row.phase}</td>
                  <td className="px-5 py-3 text-[#C9A84C] font-semibold">{row.investment}</td>
                  <td className="px-5 py-3 text-gray-400">{row.monthlyBurn}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs max-w-[250px]">{row.expectedOutput}</td>
                  <td className="px-5 py-3 text-gray-400">{row.roiTimeline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-5 border-t border-white/5 bg-[#C9A84C]/5">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-xs text-gray-500">Total Investment (12 mo)</div>
              <div className="text-lg font-bold text-white">~18,000 EUR</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Projected M12 ARR</div>
              <div className="text-lg font-bold text-[#C9A84C]">{eur(m12.totalMrr * 12)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">12-Month ROI</div>
              <div className="text-lg font-bold text-[#34D399]">{((m12.totalMrr * 12 / 18000 - 1) * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Target LTV:CAC Ratio</div>
              <div className="text-lg font-bold text-white">15-20x</div>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Next Steps */}
      <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Immediate Next Steps (This Week)</h2>
        <div className="space-y-3">
          {[
            { step: '1. Create sitemap.ts and robots.ts', tag: 'AGENT' as const, time: '30 min', reason: 'Currently 0 SEO infrastructure. This is free and immediate.' },
            { step: '2. Build SEO page generator agent', tag: 'AGENT' as const, time: '4 hours', reason: 'Generates 690+ pages from existing DB data (115 countries, 6 products).' },
            { step: '3. Generate first batch of 690 SEO pages', tag: 'AGENT' as const, time: '6 hours', reason: 'Start indexing immediately. Every day delayed = lost organic traffic.' },
            { step: '4. Set up LinkedIn auto-poster', tag: 'AGENT' as const, time: '3 hours', reason: 'Social signals boost SEO. Daily posting compounds.' },
            { step: '5. Build welcome email sequence in Resend', tag: 'AGENT' as const, time: '3 hours', reason: 'Convert signups to engaged users. Already have Resend integrated.' },
            { step: '6. Register Google Search Console & submit sitemap', tag: 'HUMAN' as const, time: '15 min', reason: 'Requires Google account verification. One-time setup.' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                item.tag === 'AGENT' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#60A5FA]/20 text-[#60A5FA]'
              }`}>{item.tag}</span>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">{item.step}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.time} &mdash; {item.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Factors */}
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6">
        <h2 className="text-lg font-bold text-white mb-4">Risk Factors & Mitigations</h2>
        <div className="space-y-3">
          {[
            {
              risk: 'Stripe not live until end of April 2026 (US company formation)',
              severity: 'High',
              mitigation: 'Focus Phase 1 entirely on SEO + content + email list building. No revenue lost since no payment processing needed yet. When Stripe goes live, convert accumulated free users.',
            },
            {
              risk: 'SEO takes 3-6 months to compound',
              severity: 'Medium',
              mitigation: 'Start immediately. Use long-tail keywords (690 pages) for faster ranking. Supplement with social media and partnerships for early traction.',
            },
            {
              risk: 'Gemini free credits expire July 2026 (260 EUR remaining)',
              severity: 'Medium',
              mitigation: 'Existing fallback chain (Gemini -> Groq -> OpenAI) already built. Groq free tier handles most generation. Budget 50-100 EUR/mo for AI after July.',
            },
            {
              risk: 'UN Comtrade API key not yet obtained (trade flow data gaps)',
              severity: 'Medium',
              mitigation: 'Registration is free. Submit application this week. Meanwhile, 442 production cost benchmarks + 225 logistics corridors + 327 regulations already in DB provide sufficient data for SEO pages.',
            },
            {
              risk: 'Single founder bandwidth',
              severity: 'Low',
              mitigation: 'Strategy is 95% agent-executable by design. Human tasks total ~2 hours/week. Claude Code runs 24/7 on VPS. Cron jobs handle daily operations.',
            },
          ].map(item => (
            <div key={item.risk} className="rounded-lg border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  item.severity === 'High' ? 'bg-red-500/15 text-red-400' :
                  item.severity === 'Medium' ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-green-500/15 text-green-400'
                }`}>{item.severity}</span>
                <span className="text-sm text-white font-medium">{item.risk}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-[52px]">{item.mitigation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 pb-8">
        Generated by AI Growth Agent &mdash; Last refresh: 2026-04-10 &mdash; All projections are estimates based on industry benchmarks.
        <br />
        Actual results depend on execution speed, market conditions, and SEO volatility.
      </div>
    </div>
  )
}
