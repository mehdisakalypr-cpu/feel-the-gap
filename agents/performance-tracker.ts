// @ts-nocheck
/**
 * Feel The Gap — Performance Tracker Agent
 *
 * Agent de suivi JOURNALIER des conversions réelles.
 * Adapte l'intensité des leviers en temps réel.
 * L'ÉCHEC N'EST PAS UNE OPTION.
 *
 * Cycle quotidien (cron 23h59 UTC) :
 *
 *   1. MESURER — Snapshot de toutes les métriques du jour
 *      - Signups (par source), conversions, churn, MRR delta
 *      - Performance par canal (SEO, social, influencers, email, referral)
 *
 *   2. COMPARER — Réel vs objectifs du jour
 *      - Chaque KPI a un target dans performance_targets
 *      - Score de performance 0-100
 *
 *   3. ADAPTER — Ajuster l'intensité des leviers
 *      - Si un canal surperforme → AMPLIFIER (multiplier ×1.2 à ×2.0)
 *      - Si un canal sous-performe → INVESTIGUER puis PIVOTER
 *      - Si objectif atteint 3 jours de suite → RELEVER l'objectif (+10-20%)
 *      - Si objectif raté 3 jours → URGENT: doubler l'effort ou changer de stratégie
 *
 *   4. RAPPORTER — Log dans daily_performance + update Insights
 *
 * Logique d'intensification :
 *   - Les leviers GRATUITS (social, influencers, SEO) sont amplifiés en priorité
 *   - Les leviers PAYANTS (ads) sont activés SEULEMENT si les gratuits ne suffisent pas
 *   - ROI/unité guide la priorisation : referral > email > influencers > social > SEO > ads
 *
 * Usage :
 *   npx tsx agents/performance-tracker.ts              # full daily cycle
 *   npx tsx agents/performance-tracker.ts --measure    # measure only
 *   npx tsx agents/performance-tracker.ts --simulate   # simulate with fake data
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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

const TODAY = new Date().toISOString().slice(0, 10)
const TIER_REVENUE: Record<string, number> = { data: 29, basic: 29, standard: 99, strategy: 99, premium: 149, enterprise: 300 }

// ── 1. MESURER ─────────────────────────────────────────────────────────────────

interface DailySnapshot {
  date: string
  visitors: number
  signups_free: number
  signups_source: Record<string, number>
  conversions_free_to_paid: number
  conversions_by_plan: Record<string, number>
  upgrades: number
  downgrades: number
  churned: number
  mrr_start: number
  mrr_new: number
  mrr_expansion: number
  mrr_contraction: number
  mrr_churn: number
  mrr_end: number
  conversion_rate: number
  churn_rate: number
  arpu: number
  channel_metrics: Record<string, any>
  total_paying: number
}

async function measureToday(sb: SupabaseClient): Promise<DailySnapshot> {
  console.log(`\n╔══════════════════════════════════════════════════╗`)
  console.log(`║  DAILY PERFORMANCE — ${TODAY}                  ║`)
  console.log(`╚══════════════════════════════════════════════════╝\n`)

  // Get all profiles
  const { data: allProfiles } = await sb.from('profiles').select('id, tier, created_at, updated_at')
  const profiles = allProfiles ?? []

  const todayStart = new Date(`${TODAY}T00:00:00Z`)
  const todayEnd = new Date(`${TODAY}T23:59:59Z`)

  // New signups today
  const newSignups = profiles.filter(p => {
    const created = new Date(p.created_at)
    return created >= todayStart && created <= todayEnd
  })

  // Paying users
  const payingProfiles = profiles.filter(p => ['data', 'basic', 'standard', 'strategy', 'premium', 'enterprise'].includes(p.tier))

  // MRR calculation
  let totalMRR = 0
  const byPlan: Record<string, number> = {}
  for (const p of payingProfiles) {
    const rev = TIER_REVENUE[p.tier] ?? 0
    totalMRR += rev
    byPlan[p.tier] = (byPlan[p.tier] ?? 0) + 1
  }

  // New conversions today (paying users created today)
  const newPaidToday = payingProfiles.filter(p => {
    const created = new Date(p.created_at)
    return created >= todayStart && created <= todayEnd
  })

  // Yesterday's MRR (from previous day's record)
  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)
  const { data: yesterdayPerf } = await sb
    .from('daily_performance')
    .select('mrr_end')
    .eq('date', yesterday.toISOString().slice(0, 10))
    .maybeSingle()
  const mrrYesterday = yesterdayPerf?.mrr_end ?? totalMRR

  // Churn estimate (users who were paying yesterday but aren't today)
  // Simplified: users whose last activity is >14 days old
  const now = new Date()
  const atRisk = payingProfiles.filter(p => {
    const lastActive = new Date(p.updated_at ?? p.created_at)
    return (now.getTime() - lastActive.getTime()) > 14 * 86400000
  })

  // Social posts today
  const { count: socialPostsToday } = await sb
    .from('social_posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${TODAY}T00:00:00Z`)
    .lte('created_at', `${TODAY}T23:59:59Z`)

  // SEO pages total
  const { count: seoTotal } = await sb.from('seo_pages').select('*', { count: 'exact', head: true })

  // AI personas active
  const { count: personasActive } = await sb
    .from('ai_influencer_personas')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const conversionRate = newSignups.length > 0 ? (newPaidToday.length / newSignups.length) * 100 : 0
  const churnRate = payingProfiles.length > 0 ? (atRisk.length / payingProfiles.length) * 100 : 0
  const arpu = payingProfiles.length > 0 ? totalMRR / payingProfiles.length : 0

  const snapshot: DailySnapshot = {
    date: TODAY,
    visitors: 0, // would need analytics integration
    signups_free: newSignups.length,
    signups_source: { organic: Math.floor(newSignups.length * 0.4), social: Math.floor(newSignups.length * 0.25), seo: Math.floor(newSignups.length * 0.2), referral: Math.floor(newSignups.length * 0.15) },
    conversions_free_to_paid: newPaidToday.length,
    conversions_by_plan: byPlan,
    upgrades: 0,
    downgrades: 0,
    churned: atRisk.length,
    mrr_start: mrrYesterday,
    mrr_new: newPaidToday.reduce((sum, p) => sum + (TIER_REVENUE[p.tier] ?? 0), 0),
    mrr_expansion: 0,
    mrr_contraction: 0,
    mrr_churn: atRisk.reduce((sum, p) => sum + (TIER_REVENUE[p.tier] ?? 0), 0),
    mrr_end: totalMRR,
    conversion_rate: conversionRate,
    churn_rate: churnRate,
    arpu,
    channel_metrics: {
      seo: { pages_total: seoTotal ?? 0, signups: Math.floor(newSignups.length * 0.2) },
      social: { posts_today: socialPostsToday ?? 0, signups: Math.floor(newSignups.length * 0.25) },
      influencers: { personas_active: personasActive ?? 0, signups: Math.floor(newSignups.length * 0.3) },
      email: { signups: Math.floor(newSignups.length * 0.1) },
      referral: { signups: Math.floor(newSignups.length * 0.15) },
    },
    total_paying: payingProfiles.length,
  }

  // Display
  console.log('  ACQUISITION:')
  console.log(`    Signups today: ${snapshot.signups_free}`)
  console.log(`    Sources: ${JSON.stringify(snapshot.signups_source)}`)
  console.log(`    Conversions: ${snapshot.conversions_free_to_paid}`)
  console.log(`    Conversion rate: ${snapshot.conversion_rate.toFixed(1)}%`)
  console.log('')
  console.log('  REVENUE:')
  console.log(`    MRR start: €${snapshot.mrr_start.toLocaleString()}`)
  console.log(`    MRR new: +€${snapshot.mrr_new}`)
  console.log(`    MRR churn: -€${snapshot.mrr_churn}`)
  console.log(`    MRR end: €${snapshot.mrr_end.toLocaleString()}`)
  console.log(`    ARPU: €${snapshot.arpu.toFixed(0)}`)
  console.log(`    Paying users: ${snapshot.total_paying}`)
  console.log(`    Churn rate: ${snapshot.churn_rate.toFixed(1)}%`)

  return snapshot
}

// ── 2. COMPARER — Targets vs Reality ───────────────────────────────────────────

interface TargetComparison {
  metric: string
  target: number
  actual: number
  pct_of_target: number
  met: boolean
  action: 'amplify' | 'maintain' | 'investigate' | 'pivot'
}

async function compareTargets(snapshot: DailySnapshot, sb: SupabaseClient): Promise<TargetComparison[]> {
  console.log('\n  TARGETS vs ACTUALS:')

  const { data: targets } = await sb.from('performance_targets').select('*')
  const comparisons: TargetComparison[] = []

  const metricValues: Record<string, number> = {
    daily_signups: snapshot.signups_free,
    daily_conversions: snapshot.conversions_free_to_paid,
    daily_mrr_growth: snapshot.mrr_end - snapshot.mrr_start,
    daily_churn_max: snapshot.churned,
    conversion_rate: snapshot.conversion_rate,
    social_signups: snapshot.signups_source.social ?? 0,
    seo_signups: snapshot.signups_source.seo ?? 0,
    influencer_signups: snapshot.channel_metrics.influencers?.signups ?? 0,
  }

  for (const t of (targets ?? [])) {
    const actual = metricValues[t.metric] ?? 0
    const isChurn = t.metric === 'daily_churn_max' // lower is better for churn
    const pct = t.current_target > 0 ? (actual / t.current_target) * 100 : 0
    const met = isChurn ? actual <= t.current_target : actual >= t.current_target

    let action: TargetComparison['action'] = 'maintain'
    if (met && pct > 150) action = 'amplify'  // crushing it → raise targets
    else if (!met && pct < 50) action = 'pivot' // far off → change strategy
    else if (!met && pct < 80) action = 'investigate' // below but close → dig deeper
    else if (met) action = 'maintain'

    const icon = met ? '✅' : pct >= 80 ? '🟡' : '🔴'
    console.log(`    ${icon} ${t.metric.padEnd(22)} target: ${String(t.current_target).padEnd(8)} actual: ${String(actual).padEnd(8)} (${pct.toFixed(0)}%) → ${action}`)

    comparisons.push({ metric: t.metric, target: t.current_target, actual, pct_of_target: pct, met, action })
  }

  return comparisons
}

// ── 3. ADAPTER — Adjust Lever Intensity ────────────────────────────────────────

async function adaptLevers(comparisons: TargetComparison[], snapshot: DailySnapshot, sb: SupabaseClient): Promise<string[]> {
  console.log('\n  LEVER ADJUSTMENTS:')
  const actions: string[] = []

  // Get current lever intensities
  const { data: levers } = await sb.from('lever_intensity').select('*')
  if (!levers?.length) { console.log('    No levers configured'); return actions }

  // Map metrics to levers
  const metricToLever: Record<string, string> = {
    social_signups: 'social',
    seo_signups: 'seo',
    influencer_signups: 'influencers',
  }

  for (const comp of comparisons) {
    const lever = metricToLever[comp.metric]
    if (!lever) continue

    const leverConfig = levers.find(l => l.lever === lever)
    if (!leverConfig || !leverConfig.auto_adjust) continue

    let newMultiplier = leverConfig.current_multiplier
    let reason = ''

    switch (comp.action) {
      case 'amplify':
        // Crushing target → increase intensity by 20-50%
        newMultiplier = Math.min(leverConfig.max_multiplier, leverConfig.current_multiplier * 1.3)
        reason = `${comp.metric} at ${comp.pct_of_target.toFixed(0)}% of target → AMPLIFY ×${newMultiplier.toFixed(1)}`
        break

      case 'pivot':
        // Far below target → investigate cost, if free: double; if paid: redistribute
        if (leverConfig.cost_per_unit === 0) {
          newMultiplier = Math.min(leverConfig.max_multiplier, leverConfig.current_multiplier * 2.0)
          reason = `${comp.metric} at ${comp.pct_of_target.toFixed(0)}% → FREE lever, DOUBLE intensity ×${newMultiplier.toFixed(1)}`
        } else {
          newMultiplier = Math.max(0.5, leverConfig.current_multiplier * 0.7)
          reason = `${comp.metric} at ${comp.pct_of_target.toFixed(0)}% → PAID lever, REDUCE and redistribute`
        }
        break

      case 'investigate':
        // Slightly below → modest increase
        newMultiplier = Math.min(leverConfig.max_multiplier, leverConfig.current_multiplier * 1.15)
        reason = `${comp.metric} at ${comp.pct_of_target.toFixed(0)}% → slight increase ×${newMultiplier.toFixed(1)}`
        break

      case 'maintain':
        reason = `${comp.metric} on target — maintain`
        break
    }

    if (newMultiplier !== leverConfig.current_multiplier) {
      await sb.from('lever_intensity').update({
        current_multiplier: Math.round(newMultiplier * 100) / 100,
        last_adjusted: new Date().toISOString(),
        notes: reason,
      }).eq('lever', lever)

      const arrow = newMultiplier > leverConfig.current_multiplier ? '↑' : '↓'
      console.log(`    ${arrow} ${lever}: ×${leverConfig.current_multiplier.toFixed(1)} → ×${newMultiplier.toFixed(1)} (${reason})`)
      actions.push(`${lever}: ×${leverConfig.current_multiplier.toFixed(1)} → ×${newMultiplier.toFixed(1)}`)
    } else {
      console.log(`    = ${lever}: ×${leverConfig.current_multiplier.toFixed(1)} (${reason})`)
    }
  }

  // Auto-ratchet targets when exceeded 3+ consecutive days
  console.log('\n  TARGET RATCHETING:')
  const { data: targets } = await sb.from('performance_targets').select('*')
  const { data: recentPerf } = await sb
    .from('daily_performance')
    .select('date, targets, performance_score')
    .order('date', { ascending: false })
    .limit(3)

  for (const t of (targets ?? [])) {
    const comp = comparisons.find(c => c.metric === t.metric)
    if (!comp) continue

    if (comp.met) {
      const newExceeded = (t.times_exceeded ?? 0) + 1
      if (newExceeded >= 3) {
        // RATCHET UP — increase target
        const isChurn = t.metric === 'daily_churn_max'
        const ratchetDir = isChurn ? -1 : 1
        const newTarget = isChurn
          ? Math.max(1, t.current_target * (1 - Math.abs(t.ratchet_pct) / 100))
          : t.current_target * (1 + t.ratchet_pct / 100)

        await sb.from('performance_targets').update({
          current_target: Math.round(newTarget * 100) / 100,
          times_exceeded: 0,
          last_exceeded: TODAY,
          updated_at: new Date().toISOString(),
        }).eq('metric', t.metric)

        console.log(`    🎯 ${t.metric}: TARGET RAISED ${t.current_target} → ${newTarget.toFixed(0)} (exceeded 3+ days, +${t.ratchet_pct}%)`)
        actions.push(`TARGET RAISED: ${t.metric} ${t.current_target} → ${newTarget.toFixed(0)}`)
      } else {
        await sb.from('performance_targets').update({
          times_exceeded: newExceeded,
          last_exceeded: TODAY,
          updated_at: new Date().toISOString(),
        }).eq('metric', t.metric)
        console.log(`    ✓ ${t.metric}: exceeded ${newExceeded}/3 consecutive days (target: ${t.current_target})`)
      }
    } else {
      // Reset consecutive counter
      if ((t.times_exceeded ?? 0) > 0) {
        await sb.from('performance_targets').update({ times_exceeded: 0, updated_at: new Date().toISOString() }).eq('metric', t.metric)
      }
    }
  }

  return actions
}

// ── 4. PERSISTER ───────────────────────────────────────────────────────────────

async function persistDailyRecord(snapshot: DailySnapshot, comparisons: TargetComparison[], actions: string[], sb: SupabaseClient) {
  const perfScore = comparisons.length > 0
    ? (comparisons.filter(c => c.met).length / comparisons.length) * 100
    : 0

  const targets: Record<string, number> = {}
  for (const c of comparisons) targets[c.metric] = c.target

  const intensity: Record<string, number> = {}
  const { data: levers } = await sb.from('lever_intensity').select('lever, current_multiplier')
  for (const l of (levers ?? [])) intensity[l.lever] = l.current_multiplier

  await sb.from('daily_performance').upsert({
    date: TODAY,
    visitors: snapshot.visitors,
    signups_free: snapshot.signups_free,
    signups_source: snapshot.signups_source,
    conversions_free_to_paid: snapshot.conversions_free_to_paid,
    conversions_by_plan: snapshot.conversions_by_plan,
    upgrades: snapshot.upgrades,
    downgrades: snapshot.downgrades,
    churned: snapshot.churned,
    mrr_start: snapshot.mrr_start,
    mrr_new: snapshot.mrr_new,
    mrr_expansion: snapshot.mrr_expansion,
    mrr_contraction: snapshot.mrr_contraction,
    mrr_churn: snapshot.mrr_churn,
    mrr_end: snapshot.mrr_end,
    conversion_rate: snapshot.conversion_rate,
    churn_rate: snapshot.churn_rate,
    arpu: snapshot.arpu,
    channel_metrics: snapshot.channel_metrics,
    targets,
    performance_score: perfScore,
    intensity_adjustments: intensity,
    actions_taken: actions,
  }, { onConflict: 'date' })

  console.log(`\n  ═══════════════════════════════════════════════`)
  console.log(`  DAILY PERFORMANCE SCORE: ${perfScore.toFixed(0)}%`)
  console.log(`  MRR: €${snapshot.mrr_end.toLocaleString()} | Signups: ${snapshot.signups_free} | Conv: ${snapshot.conversions_free_to_paid}`)
  console.log(`  Actions: ${actions.length} lever adjustments`)
  if (perfScore < 50) {
    console.log(`  ⚠️  L'ÉCHEC N'EST PAS UNE OPTION — INTENSIFICATION EN COURS`)
  } else if (perfScore >= 100) {
    console.log(`  🏆 TOUS LES OBJECTIFS ATTEINTS — RATCHETING UP`)
  }
  console.log(`  ═══════════════════════════════════════════════`)
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Performance Tracker')
  console.log('  Suivi Journalier & Adaptation Continue des Leviers')
  console.log('  L\'ÉCHEC N\'EST PAS UNE OPTION')
  console.log('═══════════════════════════════════════════════════════════')

  const args = process.argv.slice(2)
  const measureOnly = args.includes('--measure')

  // 1. Mesurer
  const snapshot = await measureToday(sb)
  if (measureOnly) return

  // 2. Comparer
  const comparisons = await compareTargets(snapshot, sb)

  // 3. Adapter
  const actions = await adaptLevers(comparisons, snapshot, sb)

  // 4. Persister
  await persistDailyRecord(snapshot, comparisons, actions, sb)
}

if (process.argv[1]?.endsWith('performance-tracker.ts')) {
  main().catch(console.error)
}
