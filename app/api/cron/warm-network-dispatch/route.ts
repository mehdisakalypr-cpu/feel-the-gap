import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Persona → sequence segment mapping (mirrors agents/warm-network-dispatcher.ts)
const PERSONA_SEGMENTS: Record<string, string> = {
  alex:   'warm_network_alex',
  maria:  'warm_network_maria',
  thomas: 'warm_network_thomas',
}

/**
 * Cron — enrolls v_warm_network_ready contacts into persona-specific sequences.
 * Idempotent: skips contacts already enrolled. Marks personal_network_contacts.outreach_status='queued'
 * after enrollment so the next pass ignores them. Daily run is plenty given upload cadence.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: ready, error } = await sb.from('v_warm_network_ready').select('*').limit(500)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!ready?.length) return NextResponse.json({ ok: true, ready: 0, enrolled: 0 })

  // Resolve sequences once per request
  const seqByPersona: Record<string, string | null> = {}
  for (const persona of Object.keys(PERSONA_SEGMENTS)) {
    const { data } = await sb
      .from('ftg_sequences')
      .select('id')
      .eq('segment', PERSONA_SEGMENTS[persona])
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    seqByPersona[persona] = data?.id ?? null
  }

  let enrolled = 0, alreadyQueued = 0, missingSeq = 0
  for (const c of ready) {
    const seqId = seqByPersona[c.persona]
    if (!seqId) { missingSeq++; continue }

    const externalId = c.linkedin_url ?? c.email ?? c.id
    const { data: lead, error: leadErr } = await sb
      .from('ftg_leads')
      .upsert({
        source: 'warm_network',
        source_external_id: externalId,
        full_name: c.full_name,
        email: c.email ?? null,
        linkedin_url: c.linkedin_url ?? null,
        company_name: c.company ?? null,
        title: c.headline ?? null,
        status: 'enrolled',
        segment: PERSONA_SEGMENTS[c.persona],
        approval_status: 'approved',
        source_payload: { contact_id: c.id, persona: c.persona, tags: c.tags },
      }, { onConflict: 'source,source_external_id' })
      .select('id')
      .maybeSingle()
    if (leadErr || !lead) continue

    const { data: existing } = await sb
      .from('ftg_sequence_enrollments')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('sequence_id', seqId)
      .limit(1)
      .maybeSingle()

    if (existing) { alreadyQueued++; continue }

    await sb.from('ftg_sequence_enrollments').insert({
      sequence_id: seqId,
      lead_id: lead.id,
      current_step: 0,
      status: 'running',
      next_action_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })

    await sb
      .from('personal_network_contacts')
      .update({
        outreach_status: 'queued',
        assigned_persona: c.persona,
        assignment_reason: 'warm_network_dispatcher_auto',
      })
      .eq('id', c.id)

    enrolled++
  }

  return NextResponse.json({ ok: true, ready: ready.length, enrolled, alreadyQueued, missingSeq })
}
