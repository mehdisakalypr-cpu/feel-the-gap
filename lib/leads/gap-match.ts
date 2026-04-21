/**
 * FTG Lead Intelligence — gap-match scoring.
 *
 * Scores a lead 0-100 on how likely they convert on our import/export
 * opportunity data. Our unique IP: matching the lead's signals (title, bio,
 * company country, industry) with the opportunities that would hit their
 * exact pain point (country gap × product × market angle).
 *
 * Scoring factors (weighted):
 *   - Title signal (30pts): founder/CEO/import-export/trading → high
 *   - Bio keywords (20pts): 'export', 'import', 'commodity', 'supplier' → high
 *   - Company size fit (15pts): 1-200 employees = our ICP sweet spot
 *   - Country × opp match (25pts): their country has top-10 gap opps? → high
 *   - Email verified (10pts): deliverable => actionable
 *
 * Returns score + matched opportunities (top 3) so the campaign can include
 * their best 3 opps in the personalized pitch.
 */

export interface LeadInput {
  title?: string | null
  company_name?: string | null
  company_country_iso?: string | null     // ISO3
  company_size_range?: string | null      // '1-10' | '11-50' | ...
  verification_status?: string | null
  source_payload?: any                    // raw provider payload (bio, headline, etc.)
  email?: string | null
}

export interface MatchedOpp {
  opp_id: string
  product_name: string
  country_iso: string
  opportunity_score: number
  gap_value_usd: number | null
}

export interface ScoringResult {
  gap_match_score: number       // 0-100
  signals: {
    title_fit: number
    bio_fit: number
    size_fit: number
    country_fit: number
    email_ok: boolean
    matched_keywords: string[]
  }
  top_opps: MatchedOpp[]        // top 3
  recommended_tier: 'data' | 'strategy' | 'premium' | 'ultimate'
  recommended_segment: 'entrepreneur' | 'trading_company' | 'investor' | 'student' | 'unknown'
}

// ─── Keyword dictionaries ─────────────────────────────────────────────

const TITLE_KEYWORDS_HIGH = [
  'founder', 'ceo', 'chief executive', 'owner', 'managing director',
  'import', 'export', 'trade', 'trading', 'commodity', 'commodities',
  'procurement', 'sourcing', 'buyer', 'head of supply',
]
const TITLE_KEYWORDS_MEDIUM = [
  'director', 'vp', 'vice president', 'head of', 'general manager',
  'partner', 'investor', 'angel', 'family office',
]
const TITLE_KEYWORDS_LOW = ['student', 'intern', 'analyst', 'consultant']

const BIO_KEYWORDS = [
  'export', 'import', 'trade', 'trader', 'commodity', 'commodities',
  'global', 'international', 'emerging market', 'africa', 'asia',
  'supplier', 'sourcing', 'manufacturer', 'factory', 'wholesale',
  'impact', 'investment', 'family office', 'diaspora', 'cooperative',
]

const SEGMENT_TITLE_MAP: Array<[RegExp, ScoringResult['recommended_segment']]> = [
  [/founder|ceo|owner|entrepreneur/i, 'entrepreneur'],
  [/import|export|trading|commodity|supply/i, 'trading_company'],
  [/investor|partner|angel|venture|family office/i, 'investor'],
  [/student|intern|mba/i, 'student'],
]

const TIER_BY_COMPANY_SIZE: Record<string, ScoringResult['recommended_tier']> = {
  '1-10': 'data',
  '11-50': 'strategy',
  '51-200': 'strategy',
  '201-1000': 'premium',
  '1001-5000': 'premium',
  '5000+': 'ultimate',
}

// ─── Scoring helpers ─────────────────────────────────────────────────

function scoreTitle(title: string | null | undefined): { pts: number; matched: string[] } {
  if (!title) return { pts: 0, matched: [] }
  const t = title.toLowerCase()
  const matched: string[] = []
  let pts = 0
  for (const k of TITLE_KEYWORDS_HIGH) if (t.includes(k)) { pts = Math.max(pts, 30); matched.push(k); break }
  if (pts < 30) for (const k of TITLE_KEYWORDS_MEDIUM) if (t.includes(k)) { pts = Math.max(pts, 18); matched.push(k); break }
  if (pts === 0) for (const k of TITLE_KEYWORDS_LOW) if (t.includes(k)) { pts = 5; matched.push(k); break }
  return { pts, matched }
}

function scoreBio(payload: any): { pts: number; matched: string[] } {
  const text = [
    payload?.headline, payload?.bio, payload?.summary,
    payload?.description, payload?.about,
  ].filter(Boolean).join(' ').toLowerCase()
  if (!text) return { pts: 0, matched: [] }
  const matched = BIO_KEYWORDS.filter((k) => text.includes(k))
  // 2 pts per match, cap 20
  return { pts: Math.min(matched.length * 2, 20), matched }
}

function scoreCompanySize(sizeRange: string | null | undefined): number {
  if (!sizeRange) return 5
  if (sizeRange === '11-50' || sizeRange === '51-200') return 15   // sweet spot
  if (sizeRange === '1-10') return 10
  if (sizeRange === '201-1000') return 10
  return 5
}

function scoreEmail(status: string | null | undefined, hasEmail: boolean): number {
  if (status === 'valid') return 10
  if (hasEmail) return 5
  return 0
}

function pickSegment(title: string | null | undefined): ScoringResult['recommended_segment'] {
  if (!title) return 'unknown'
  for (const [rx, seg] of SEGMENT_TITLE_MAP) if (rx.test(title)) return seg
  return 'unknown'
}

// ─── Main scoring ────────────────────────────────────────────────────

/**
 * Score a lead without DB access (pure function). Country match score is 0
 * since it requires DB lookup; use scoreLeadWithOpps() when you have a
 * Supabase client to compute country fit + top matched opps.
 */
export function scoreLeadPure(lead: LeadInput): ScoringResult {
  const titleR = scoreTitle(lead.title)
  const bioR = scoreBio(lead.source_payload)
  const sizePts = scoreCompanySize(lead.company_size_range)
  const emailPts = scoreEmail(lead.verification_status, !!lead.email)

  const total = titleR.pts + bioR.pts + sizePts + emailPts  // max 75 without country match
  return {
    gap_match_score: total,
    signals: {
      title_fit: titleR.pts,
      bio_fit: bioR.pts,
      size_fit: sizePts,
      country_fit: 0,
      email_ok: !!lead.email && lead.verification_status !== 'invalid',
      matched_keywords: [...titleR.matched, ...bioR.matched],
    },
    top_opps: [],
    recommended_tier: TIER_BY_COMPANY_SIZE[lead.company_size_range ?? ''] ?? 'data',
    recommended_segment: pickSegment(lead.title),
  }
}

/**
 * Score with DB: adds country_fit (25pts) based on lead's company country
 * having high-value opps in our DB. Also returns top 3 matched opps.
 */
export async function scoreLeadWithOpps(
  sb: any,
  lead: LeadInput,
): Promise<ScoringResult> {
  const base = scoreLeadPure(lead)

  if (!lead.company_country_iso) return base

  // Top 3 opps for lead's country by opportunity_score
  const { data: opps } = await sb
    .from('opportunities')
    .select('id, product_name, country_iso, opportunity_score, gap_value_usd')
    .eq('country_iso', lead.company_country_iso)
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(3)

  const top_opps: MatchedOpp[] = (opps ?? []).map((o: any) => ({
    opp_id: o.id,
    product_name: o.product_name ?? '',
    country_iso: o.country_iso,
    opportunity_score: Number(o.opportunity_score ?? 0),
    gap_value_usd: o.gap_value_usd !== null ? Number(o.gap_value_usd) : null,
  }))

  // Country fit: 25 if top opp score >= 80, else scaled
  const topScore = top_opps[0]?.opportunity_score ?? 0
  const country_fit = Math.round((topScore / 100) * 25)

  return {
    ...base,
    gap_match_score: Math.min(100, base.gap_match_score + country_fit),
    signals: { ...base.signals, country_fit },
    top_opps,
  }
}
