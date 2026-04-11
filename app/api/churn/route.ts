import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const TIER_REVENUE: Record<string, number> = {
  data: 29, basic: 29, standard: 99, strategy: 99, premium: 149,
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, tier, created_at, updated_at, ai_credits')
    .in('tier', ['data', 'basic', 'standard', 'strategy', 'premium'])

  if (!profiles?.length) {
    return NextResponse.json({ status: 'ok', at_risk: 0, actions: 0 })
  }

  const now = new Date()
  const actions: Array<{ user_id: string; email: string; risk_score: number; action: string; revenue: number }> = []

  for (const p of profiles) {
    const lastActive = new Date(p.updated_at ?? p.created_at)
    const daysInactive = Math.floor((now.getTime() - lastActive.getTime()) / 86400000)
    const daysSinceSignup = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000)

    let risk = 0
    if (daysInactive > 30) risk += 40
    else if (daysInactive > 14) risk += 25
    else if (daysInactive > 7) risk += 10

    if (['standard', 'strategy', 'premium'].includes(p.tier) && (p.ai_credits ?? 0) > 5000) risk += 15
    if (daysSinceSignup < 30 && daysInactive > 5) risk += 20

    if (risk < 40) continue

    let action = 'send_tips'
    if (risk >= 60) action = 'urgent_outreach_discount'
    else if (risk >= 40) action = 'reengagement_email'

    actions.push({
      user_id: p.id,
      email: p.email ?? '',
      risk_score: Math.min(100, risk),
      action,
      revenue: TIER_REVENUE[p.tier] ?? 0,
    })
  }

  // Log churn interventions
  if (actions.length > 0) {
    await sb.from('auto_optimizer_log').insert(
      actions.map(a => ({
        agent_name: 'churn-detector',
        action_type: `churn_${a.action}`,
        target_id: a.user_id,
        before_state: { risk_score: a.risk_score, revenue: a.revenue },
        after_state: { action: a.action },
        reason: `User ${a.email} at risk (score ${a.risk_score}), €${a.revenue}/mo revenue`,
        impact_estimate: `Save €${a.revenue}/mo if retained`,
        executed: true,
      }))
    )
  }

  const totalAtRisk = actions.reduce((s, a) => s + a.revenue, 0)

  return NextResponse.json({
    status: 'ok',
    total_paying: profiles.length,
    at_risk: actions.length,
    revenue_at_risk: totalAtRisk,
    actions: actions.length,
    breakdown: {
      urgent: actions.filter(a => a.action === 'urgent_outreach_discount').length,
      reengagement: actions.filter(a => a.action === 'reengagement_email').length,
      tips: actions.filter(a => a.action === 'send_tips').length,
    },
  })
}
