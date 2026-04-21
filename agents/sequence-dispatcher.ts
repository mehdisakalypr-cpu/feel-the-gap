// @ts-nocheck
/**
 * ⚡ Sequence Dispatcher — multi-channel orchestrator.
 *
 * Pulls ftg_sequence_enrollments due now (next_action_at <= now), executes
 * the current step's touch via the appropriate provider, logs to
 * ftg_sequence_touches, advances to next step (or stops on reply).
 *
 * Runs every 15 min via cron. Respects per-channel rate limits:
 *   email (Instantly)         : provider handles throttling
 *   linkedin_dm (PhantomBuster): 80/day safe max per account
 *   linkedin_connect          : 25/day safe max (LinkedIn cap)
 *   whatsapp (Twilio)         : pay-per-msg
 *
 * Adapter pattern — each channel's API call is ready-to-key (no-op if key missing).
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { generateHancockPersona, renderTouchMessage, type HancockPersona } from '@/lib/outreach/hancock-persona'
import { isConfigured as instantlyReady, addLeadsToCampaign as instantlyAddLeads } from '@/lib/leads/instantly'
import { isConfigured as pbReady, launchPhantom } from '@/lib/leads/phantombuster'

loadEnv()

type Args = { maxTouches: number; dry: boolean }
function parseArgs(): Args {
  const out: Args = { maxTouches: 50, dry: false }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max' && v) out.maxTouches = Number(v)
    if (k === 'dry') out.dry = true
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function getOrCreatePersona(sb: any, enrollmentId: string, lead: any): Promise<HancockPersona | null> {
  const { data: existing } = await sb
    .from('ftg_sequence_enrollments')
    .select('hancock_persona')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (existing?.hancock_persona) return existing.hancock_persona as HancockPersona

  const persona = await generateHancockPersona(lead, lead.gap_match_opps ?? [])
  if (persona) {
    await sb.from('ftg_sequence_enrollments').update({ hancock_persona: persona }).eq('id', enrollmentId)
  }
  return persona
}

async function dispatchTouch(sb: any, enrollment: any): Promise<{ ok: boolean; next_delay_days?: number; stop?: string }> {
  // Load sequence + lead
  const [{ data: seq }, { data: lead }] = await Promise.all([
    sb.from('ftg_sequences').select('*').eq('id', enrollment.sequence_id).maybeSingle(),
    sb.from('ftg_leads').select('*').eq('id', enrollment.lead_id).maybeSingle(),
  ])
  if (!seq || !lead) return { ok: false, stop: 'missing_seq_or_lead' }

  const steps = (seq.steps as any[]) ?? []
  const idx = enrollment.current_step ?? 0
  if (idx >= steps.length) return { ok: true, stop: 'completed' }
  const step = steps[idx]

  // Do-not-contact + unsub checks
  if (lead.do_not_contact) return { ok: false, stop: 'stopped_unsub' }
  if (lead.status === 'replied' || lead.status === 'demo_booked' || lead.status === 'paid') return { ok: false, stop: 'stopped_reply' }

  // Generate or reuse Hancock persona
  const persona = await getOrCreatePersona(sb, enrollment.id, lead)

  // Render message with persona
  const subject = step.subject_template ? renderTouchMessage(step.subject_template, lead, persona) : null
  const body = renderTouchMessage(step.body_template ?? '', lead, persona)

  // Pick provider per channel
  const channel = step.channel as string
  const provider = step.provider ?? defaultProvider(channel)

  // Dispatch
  let sent = false
  let externalId: string | null = null
  let cost = 0
  let error: string | null = null

  if (channel === 'email' && provider === 'instantly' && instantlyReady()) {
    // Campaign id must be provided in step config (created ahead in Instantly)
    const campaignId = step.provider_campaign_id
    if (!campaignId) { error = 'missing_instantly_campaign_id' }
    else if (!lead.email) { error = 'no_email' }
    else {
      const res = await instantlyAddLeads(campaignId, [{
        email: lead.email,
        first_name: lead.first_name ?? undefined,
        last_name: lead.last_name ?? undefined,
        company_name: lead.company_name ?? undefined,
        personalization: body,
        variables: { subject: subject ?? '', body },
      }])
      if (res) { sent = true; externalId = `instantly:${campaignId}` }
      else error = 'instantly_send_failed'
    }
  } else if ((channel === 'linkedin_dm' || channel === 'linkedin_connect') && pbReady()) {
    const phantomId = step.provider_phantom_id
    if (!phantomId) { error = 'missing_phantom_id' }
    else if (!lead.linkedin_url) { error = 'no_linkedin_url' }
    else {
      const res = await launchPhantom(phantomId, {
        profileUrl: lead.linkedin_url,
        message: body,
      })
      if (res) { sent = true; externalId = `pb:${res.containerId}` }
      else error = 'pb_launch_failed'
    }
  } else {
    error = `channel_${channel}_provider_${provider}_not_configured`
  }

  // Log touch
  await sb.from('ftg_sequence_touches').insert({
    enrollment_id: enrollment.id,
    step_idx: idx,
    channel,
    provider,
    provider_external_id: externalId,
    subject,
    body,
    status: sent ? 'sent' : 'failed',
    scheduled_at: enrollment.next_action_at,
    sent_at: sent ? new Date().toISOString() : null,
    error: error ?? null,
    cost_eur: cost,
  })

  // Advance enrollment
  const nextIdx = idx + 1
  if (nextIdx >= steps.length) {
    await sb.from('ftg_sequence_enrollments').update({
      current_step: nextIdx,
      status: 'completed',
      last_touch_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq('id', enrollment.id)
    return { ok: sent, stop: 'completed' }
  }

  const delayDays = steps[nextIdx]?.delay_days ?? 3
  const nextAt = new Date(Date.now() + delayDays * 86_400_000).toISOString()
  await sb.from('ftg_sequence_enrollments').update({
    current_step: nextIdx,
    status: 'running',
    last_touch_at: new Date().toISOString(),
    next_action_at: nextAt,
  }).eq('id', enrollment.id)

  return { ok: sent, next_delay_days: delayDays }
}

function defaultProvider(channel: string): string {
  if (channel === 'email') return 'instantly'
  if (channel === 'linkedin_dm' || channel === 'linkedin_connect' || channel === 'linkedin_like') return 'phantombuster'
  if (channel === 'whatsapp' || channel === 'sms') return 'twilio'
  if (channel === 'video_pitch') return 'seedance'
  return 'custom'
}

async function main() {
  const args = parseArgs()
  const sb = db()
  console.log(`⚡ sequence-dispatcher — max=${args.maxTouches} dry=${args.dry}`)

  const { data: due } = await sb.rpc('ftg_next_due_touches', { p_limit: args.maxTouches })
  if (!due?.length) { console.log('— no touches due now'); return }
  console.log(`→ ${due.length} enrollments due`)

  let sent = 0, failed = 0, stopped = 0
  for (const enrollment of due) {
    if (args.dry) { console.log(`[dry] would dispatch enrollment ${enrollment.id.slice(0, 8)} step ${enrollment.current_step}`); continue }
    try {
      const res = await dispatchTouch(sb, enrollment)
      if (res.stop) stopped++
      else if (res.ok) sent++
      else failed++
    } catch (e: any) {
      console.error(`[dispatch] ${enrollment.id.slice(0,8)}: ${e.message?.slice(0, 120)}`)
      failed++
    }
    await new Promise((r) => setTimeout(r, 300))  // light throttle
  }
  console.log(`→ sent=${sent} failed=${failed} stopped=${stopped}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
