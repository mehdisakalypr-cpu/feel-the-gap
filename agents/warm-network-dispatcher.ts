// @ts-nocheck
/**
 * 🕵️ Warm Network Dispatcher — bridges personal LinkedIn network → outreach pipeline.
 *
 * Reads `v_warm_network_ready` (non-excluded contacts with persona suggested),
 * upserts each as an `ftg_lead` (source='warm_network'), enrolls into the
 * persona-specific sequence, then flips `personal_network_contacts.outreach_status`
 * to 'queued' so the next pass skips it.
 *
 * Idempotent: existing enrollments are not duplicated.
 *
 * The actual sending is handled by the existing `sequence-dispatcher.ts` cron
 * (LinkedIn DM via PhantomBuster, email via Instantly, etc.).
 *
 * Run: npx tsx agents/warm-network-dispatcher.ts [--dry] [--limit N]
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'

loadEnv()

type Args = { dry: boolean; limit: number }
function parseArgs(): Args {
  const out: Args = { dry: false, limit: 200 }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'dry') out.dry = true
    if (k === 'limit' && v) out.limit = Number(v)
  }
  return out
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Persona → sequence segment mapping. Sequences are seeded in
// 20260422080000_warm_network_sequences.sql with these segment names.
const PERSONA_SEGMENTS: Record<string, string> = {
  alex:   'warm_network_alex',
  maria:  'warm_network_maria',
  thomas: 'warm_network_thomas',
}

async function getSequenceIdForPersona(sb: any, persona: string): Promise<string | null> {
  const segment = PERSONA_SEGMENTS[persona]
  if (!segment) return null
  const { data } = await sb
    .from('ftg_sequences')
    .select('id')
    .eq('segment', segment)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function upsertLead(sb: any, contact: any): Promise<string | null> {
  // Upsert by source + source_external_id (LinkedIn URL is canonical).
  const externalId = contact.linkedin_url ?? contact.email ?? contact.id
  const row = {
    source: 'warm_network',
    source_external_id: externalId,
    full_name: contact.full_name,
    email: contact.email ?? null,
    linkedin_url: contact.linkedin_url ?? null,
    company_name: contact.company ?? null,
    title: contact.headline ?? null,
    status: 'enrolled',
    segment: PERSONA_SEGMENTS[contact.persona] ?? null,
    approval_status: 'approved', // warm contacts are pre-approved (user uploaded them)
    source_payload: { contact_id: contact.id, persona: contact.persona, tags: contact.tags },
  }
  const { data, error } = await sb
    .from('ftg_leads')
    .upsert(row, { onConflict: 'source,source_external_id' })
    .select('id')
    .maybeSingle()
  if (error) { console.error(`[upsertLead] ${contact.full_name}: ${error.message}`); return null }
  return data?.id ?? null
}

async function enrollIfMissing(sb: any, leadId: string, sequenceId: string): Promise<boolean> {
  const { data: existing } = await sb
    .from('ftg_sequence_enrollments')
    .select('id')
    .eq('lead_id', leadId)
    .eq('sequence_id', sequenceId)
    .limit(1)
    .maybeSingle()
  if (existing) return false // already enrolled
  const { error } = await sb.from('ftg_sequence_enrollments').insert({
    sequence_id: sequenceId,
    lead_id: leadId,
    current_step: 0,
    status: 'running',
    next_action_at: new Date().toISOString(), // ready immediately, sequence-dispatcher picks up next cron
    started_at: new Date().toISOString(),
  })
  if (error) { console.error(`[enroll] lead=${leadId.slice(0,8)}: ${error.message}`); return false }
  return true
}

async function main() {
  const args = parseArgs()
  const sb = db()
  console.log(`🕵️ warm-network-dispatcher — dry=${args.dry} limit=${args.limit}`)

  const { data: ready, error } = await sb
    .from('v_warm_network_ready')
    .select('*')
    .limit(args.limit)
  if (error) { console.error(`[query] ${error.message}`); process.exit(1) }
  if (!ready?.length) { console.log('— no warm contacts ready'); return }

  console.log(`→ ${ready.length} contacts ready`)

  // Resolve sequences once
  const seqByPersona: Record<string, string | null> = {}
  for (const persona of Object.keys(PERSONA_SEGMENTS)) {
    seqByPersona[persona] = await getSequenceIdForPersona(sb, persona)
    if (!seqByPersona[persona]) console.warn(`⚠ no active sequence for persona=${persona} (segment=${PERSONA_SEGMENTS[persona]})`)
  }

  let enrolled = 0, skipped = 0, queuedAlready = 0, missingSeq = 0
  for (const c of ready) {
    const seqId = seqByPersona[c.persona]
    if (!seqId) { missingSeq++; continue }

    if (args.dry) {
      console.log(`[dry] would enroll ${c.full_name} → persona=${c.persona} seq=${seqId.slice(0,8)}`)
      continue
    }

    const leadId = await upsertLead(sb, c)
    if (!leadId) { skipped++; continue }

    const justEnrolled = await enrollIfMissing(sb, leadId, seqId)
    if (justEnrolled) {
      enrolled++
      // Mark contact as queued so next pass skips it
      await sb
        .from('personal_network_contacts')
        .update({
          outreach_status: 'queued',
          assigned_persona: c.persona,
          assignment_reason: 'warm_network_dispatcher_auto',
        })
        .eq('id', c.id)
    } else {
      queuedAlready++
    }
  }

  console.log(`→ enrolled=${enrolled} already_queued=${queuedAlready} missing_seq=${missingSeq} skipped=${skipped}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
