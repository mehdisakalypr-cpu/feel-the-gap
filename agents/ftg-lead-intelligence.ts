// @ts-nocheck
/**
 * ftg-lead-intelligence — ingest + score + tier leads via gap-match signals.
 *
 * Pipeline:
 *   1. Pull raw leads from provider adapters (Apollo first, Hunter, PhantomBuster)
 *   2. Upsert into ftg_leads (dedup by email OR linkedin_url)
 *   3. For each new row: run scoreLeadWithOpps → attach gap_match_score + top_opps
 *   4. Promote status: sourced → enriched (if email) → scored
 *
 * Cron: every 30 min on VPS. Idempotent — unique indexes on email/linkedin_url.
 *
 * Usage:
 *   npx tsx agents/ftg-lead-intelligence.ts --source=apollo --max=100
 *   npx tsx agents/ftg-lead-intelligence.ts --score-unscored --max=500
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { searchPeople as apolloSearch, toFtgLeadRow as apolloRow, isConfigured as apolloConfigured } from '@/lib/leads/apollo'
import { verifyEmail as hunterVerify, hunterToVerificationStatus, isConfigured as hunterConfigured } from '@/lib/leads/hunter'
import { scoreLeadWithOpps } from '@/lib/leads/gap-match'

loadEnv()

type Args = { source?: 'apollo' | 'all'; maxLeads: number; scoreUnscored: boolean }
function parseArgs(): Args {
  const out: Args = { maxLeads: 100, scoreUnscored: false }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'source' && v) out.source = v as any
    if (k === 'max' && v) out.maxLeads = Number(v)
    if (k === 'score-unscored') out.scoreUnscored = true
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// ICP queries — rotate through key buyer titles/keywords we want in our pool.
const ICP_QUERIES = [
  { person_titles: ['Founder', 'CEO', 'Owner'], keywords: 'import export trade commodity' },
  { person_titles: ['Head of Trade', 'Head of Sourcing', 'Head of Procurement'], keywords: 'international' },
  { person_titles: ['Managing Director', 'General Manager'], keywords: 'trading company import export' },
  { person_titles: ['Partner', 'Investor', 'Angel'], keywords: 'emerging markets commodities' },
  { person_titles: ['Director'], keywords: 'supply chain import Africa Asia' },
]

// Country priority (matches agent_targets[ftg].priority_countries)
const PRIORITY_COUNTRIES_ISO2 = ['US', 'CN', 'DE', 'JP', 'SA', 'KR', 'EG', 'BR', 'FR', 'NL']

async function ingestApolloBatch(sb: any, maxLeads: number): Promise<number> {
  if (!apolloConfigured()) {
    console.log('[intel] apollo not configured (set APOLLO_API_KEY to enable)')
    return 0
  }
  const perCall = Math.min(25, maxLeads)
  let totalIngested = 0

  for (const q of ICP_QUERIES) {
    if (totalIngested >= maxLeads) break
    const people = await apolloSearch({
      ...q,
      organization_locations: PRIORITY_COUNTRIES_ISO2,
      per_page: perCall,
    })
    if (!people.length) continue

    const rows = people.map((p) => {
      const iso3 = null  // Apollo returns ISO2 on org.country, would need a map. For now null; gap-match just loses 25pts.
      return apolloRow(p, iso3 ?? undefined)
    })
    // Upsert by email OR linkedin (unique constraints)
    const { error } = await sb.from('ftg_leads').upsert(rows, {
      onConflict: 'email',
      ignoreDuplicates: true,
    })
    if (!error) totalIngested += rows.length
    console.log(`[intel] apollo ingest: ${rows.length} people from query "${q.keywords?.slice(0, 40)}"`)
  }
  return totalIngested
}

async function scoreBatch(sb: any, maxLeads: number): Promise<number> {
  const { data: leads } = await sb
    .from('ftg_leads')
    .select('id, title, company_name, company_country_iso, company_size_range, verification_status, source_payload, email')
    .in('status', ['sourced', 'enriched'])
    .is('gap_match_opps', null)  // unscored
    .order('created_at', { ascending: false })
    .limit(maxLeads)

  if (!leads?.length) return 0
  console.log(`[intel] scoring ${leads.length} unscored leads`)

  let scored = 0
  for (const lead of leads) {
    const result = await scoreLeadWithOpps(sb, lead as any)

    // Optional: verify email via Hunter if not yet done
    let verification_status = lead.verification_status
    if (hunterConfigured() && !verification_status && lead.email) {
      const v = await hunterVerify(lead.email)
      if (v) verification_status = hunterToVerificationStatus(v)
    }

    await sb.from('ftg_leads').update({
      gap_match_score: result.gap_match_score,
      gap_match_opps: result.top_opps,
      signals: result.signals,
      tier_target: result.recommended_tier,
      segment: result.recommended_segment,
      status: 'scored',
      verification_status,
      is_priority: result.gap_match_score >= 70,
    }).eq('id', lead.id)
    scored++
  }
  return scored
}

async function main() {
  const args = parseArgs()
  const sb = db()
  console.log('▶ ftg-lead-intelligence:', JSON.stringify(args))

  let ingested = 0
  if (args.source === 'apollo' || args.source === 'all') {
    ingested = await ingestApolloBatch(sb, args.maxLeads)
  }

  const scored = await scoreBatch(sb, args.scoreUnscored ? args.maxLeads : Math.min(args.maxLeads, 200))

  const { count: total } = await sb.from('ftg_leads').select('*', { count: 'exact', head: true })
  const { count: priority } = await sb.from('ftg_leads').select('*', { count: 'exact', head: true }).eq('is_priority', true)
  console.log(`\n→ ingested=${ingested} scored=${scored} · total_leads=${total} · priority=${priority}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
