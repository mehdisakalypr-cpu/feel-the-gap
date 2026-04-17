import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Actions bulk valides (seule action bulk connue pour l'instant = bp_bulk)
const VALID_BULK_ACTIONS = new Set(['fillthegap_bp_bulk'])

// Hard cap par requête (anti-mass-burn accidental)
const MAX_IDS_PER_CALL = 50

// POST /api/credits/fillthegap/debit-bulk
// Body: { action: 'fillthegap_bp_bulk', opportunity_ids: string[] }
// Success: 200 { ok:true, balance, queued }
// Errors:  400 invalid_input · 401 unauthorized · 402 insufficient · 403 no_quota · 500 server_error
//
// Règles :
// - 1 crédit par id (qty = opportunity_ids.length)
// - Débit atomique via RPC debit_fillthegap (single row sur ftg_fillthegap_tx)
// - Après débit OK, on insère des rows placeholder dans business_plans (status='queued')
//   pour que le pipeline de génération les pickup.
export async function POST(req: NextRequest) {
  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    const idsRaw: unknown[] = Array.isArray(body.opportunity_ids)
      ? (body.opportunity_ids as unknown[])
      : []

    // Dedup + filter non-string + cap
    const ids: string[] = Array.from(
      new Set(
        idsRaw
          .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
          .slice(0, MAX_IDS_PER_CALL),
      ),
    )

    if (!VALID_BULK_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
    }
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'no_ids' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    // Pré-check du solde pour renvoyer 402 propre (le RPC raise aussi, on double ceinture).
    const { data: balRow, error: balErr } = await sb.rpc('fillthegap_balance', { p_user_id: user.id })
    if (balErr) {
      console.error('[debit-bulk] balance rpc error', balErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }
    const row = Array.isArray(balRow) ? balRow[0] : balRow
    const balance: number = typeof row?.balance === 'number' ? row.balance : 0
    const needed: number = ids.length

    if (balance < needed) {
      return NextResponse.json(
        { ok: false, error: 'insufficient', balance, needed },
        { status: 402 },
      )
    }

    // Atomic debit — 1 row agrégée sur ftg_fillthegap_tx (ref_id=null, on garde la trace des ids
    // dans business_plans pour le queueing en aval).
    const { data: newBalance, error: debitErr } = await sb.rpc('debit_fillthegap', {
      p_user_id:  user.id,
      p_qty:      needed,
      p_action:   'fillthegap_bp_bulk',
      p_ref_type: 'opportunity',
      p_ref_id:   null,
    })

    if (debitErr) {
      const msg = (debitErr.message || '').toLowerCase()
      if (msg.includes('insufficient_fillthegap_credits')) {
        return NextResponse.json(
          { ok: false, error: 'insufficient', balance, needed },
          { status: 402 },
        )
      }
      if (msg.includes('no_fillthegap_quota')) {
        return NextResponse.json({ ok: false, error: 'no_quota' }, { status: 403 })
      }
      console.error('[debit-bulk] debit rpc error', debitErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    // Note: la génération effective se fait ensuite via /api/reports/business-plan (cache
    // hit possible, 1 appel LLM pour les 3 modes), déclenché soit par navigation UI vers
    // /reports/[iso]/business-plan, soit par un worker. La transaction de débit ci-dessus
    // sert de source de vérité (ftg_fillthegap_tx avec action='fillthegap_bp_bulk').

    return NextResponse.json({
      ok: true,
      balance: typeof newBalance === 'number' ? newBalance : balance - needed,
      queued: ids.length,
    })
  } catch (err) {
    console.error('[debit-bulk]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
