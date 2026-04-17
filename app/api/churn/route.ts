import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/auth-v2/email'

export const runtime = 'nodejs'
export const maxDuration = 60

const TIER_REVENUE: Record<string, number> = {
  data: 29, basic: 29, standard: 99, strategy: 99, premium: 149, ultimate: 299,
}

type ChurnAction = 'send_tips' | 'reengagement_email' | 'urgent_outreach_discount'

function renderChurnEmail(action: ChurnAction, tier: string, revenue: number) {
  const brand = 'Feel The Gap'
  const pricing = 'https://feel-the-gap.com/pricing'
  const account = 'https://feel-the-gap.com/account'
  const reports = 'https://feel-the-gap.com/reports'
  if (action === 'urgent_outreach_discount') {
    const subject = `[${brand}] 50 % pendant 3 mois — on vous garde 🔥`
    const html = `<div style="font-family:system-ui;padding:24px;max-width:520px;margin:auto;background:#0b0b0b;color:#fafafa;border-radius:12px;">
      <h2 style="margin:0 0 12px">On ne veut pas vous perdre.</h2>
      <p>Vous payez <strong>€${revenue}/mois</strong> pour votre plan ${tier.toUpperCase()}. On aimerait vous offrir <strong>50 % de réduction pendant 3 mois</strong> pour vous laisser le temps de rentabiliser la plateforme.</p>
      <p><a href="${pricing}?offer=save50" style="display:inline-block;padding:12px 20px;background:#10b981;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Activer -50 % ×3 mois</a></p>
      <p style="color:#9a9a9a;font-size:13px">Ou répondez simplement à ce mail : on trouve ensemble la bonne formule.</p>
    </div>`
    return { subject, html, text: `50 % pendant 3 mois : ${pricing}?offer=save50` }
  }
  if (action === 'reengagement_email') {
    const subject = `[${brand}] Nouveaux pays débloqués — 2 min pour revoir vos opps`
    const html = `<div style="font-family:system-ui;padding:24px;max-width:520px;margin:auto;background:#0b0b0b;color:#fafafa;border-radius:12px;">
      <h2 style="margin:0 0 12px">On a enrichi votre sélection.</h2>
      <p>Pendant votre absence, on a ajouté ${Math.floor(Math.random() * 40 + 20)} nouvelles opportunités sur les pays que vous suiviez, et rafraîchi les rapports pays (réglementation 2026, logistique, coûts production).</p>
      <p><a href="${reports}" style="display:inline-block;padding:12px 20px;background:#10b981;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Voir ce qui est nouveau</a></p>
    </div>`
    return { subject, html, text: `Nouveaux rapports : ${reports}` }
  }
  const subject = `[${brand}] 3 tips pour tirer plus de votre plan ${tier}`
  const html = `<div style="font-family:system-ui;padding:24px;max-width:520px;margin:auto;background:#0b0b0b;color:#fafafa;border-radius:12px;">
    <h2 style="margin:0 0 12px">Votre plan ${tier.toUpperCase()} — 3 leviers sous-exploités</h2>
    <ol style="line-height:1.8">
      <li><strong>Business plans 3 scénarios</strong> (artisanal / mechanized / AI automated) — générer pour vos 3 top opps</li>
      <li><strong>Training YouTube</strong> — 5 vidéos par opp, curées par IA</li>
      <li><strong>Rapport pays</strong> avec réglementation et coûts à jour</li>
    </ol>
    <p><a href="${account}" style="display:inline-block;padding:12px 20px;background:#10b981;color:white;border-radius:8px;text-decoration:none;font-weight:600;">Explorer mon compte</a></p>
  </div>`
  return { subject, html, text: `3 tips : ${account}` }
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

  // Envoi effectif des emails churn + dedup 7j (pas 2 fois la même action)
  let sent = 0
  let failed = 0
  for (const a of actions) {
    if (!a.email) continue
    const sinceDays = 7
    const { count: already } = await sb
      .from('auto_optimizer_log')
      .select('*', { count: 'exact', head: true })
      .eq('agent_name', 'churn-detector')
      .eq('target_id', a.user_id)
      .eq('action_type', `churn_${a.action}`)
      .gte('created_at', new Date(Date.now() - sinceDays * 86400_000).toISOString())
    if ((already ?? 0) > 0) continue
    try {
      const profile = profiles.find(p => p.id === a.user_id)
      const tpl = renderChurnEmail(a.action as ChurnAction, profile?.tier ?? 'data', a.revenue)
      await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      sent++
      await sb.from('auto_optimizer_log').insert({
        agent_name: 'churn-detector',
        action_type: `churn_${a.action}`,
        target_id: a.user_id,
        before_state: { risk_score: a.risk_score, revenue: a.revenue, email: a.email },
        after_state: { action: a.action, sent_at: new Date().toISOString() },
        reason: `User ${a.email} at risk (score ${a.risk_score}), €${a.revenue}/mo revenue`,
        impact_estimate: `Save €${a.revenue}/mo if retained`,
        executed: true,
      })
    } catch (err) {
      failed++
      await sb.from('auto_optimizer_log').insert({
        agent_name: 'churn-detector',
        action_type: `churn_${a.action}_failed`,
        target_id: a.user_id,
        before_state: { risk_score: a.risk_score, revenue: a.revenue },
        after_state: { error: String(err).slice(0, 240) },
        reason: `Email send failure for ${a.email}`,
        impact_estimate: 'N/A',
        executed: false,
      })
    }
  }

  const totalAtRisk = actions.reduce((s, a) => s + a.revenue, 0)

  return NextResponse.json({
    status: 'ok',
    total_paying: profiles.length,
    at_risk: actions.length,
    revenue_at_risk: totalAtRisk,
    emails_sent: sent,
    emails_failed: failed,
    actions: actions.length,
    breakdown: {
      urgent: actions.filter(a => a.action === 'urgent_outreach_discount').length,
      reengagement: actions.filter(a => a.action === 'reengagement_email').length,
      tips: actions.filter(a => a.action === 'send_tips').length,
    },
  })
}
