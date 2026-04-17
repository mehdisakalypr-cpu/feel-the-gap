import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Actions Fill the Gap valides (map avec l'enum SQL)
const VALID_ACTIONS = new Set([
  'video',
  'clients',
  'store',
  'recap',
  'ai_engine',
  'bp_bulk',
])

const ACTION_TO_DB: Record<string, string> = {
  video:     'fillthegap_video',
  clients:   'fillthegap_clients',
  store:     'fillthegap_store',
  recap:     'fillthegap_recap',
  ai_engine: 'fillthegap_ai',
  bp_bulk:   'fillthegap_bp_bulk',
}

// POST /api/credits/fillthegap/debit
// Body: { action: 'video'|'clients'|'store'|'recap'|'ai_engine'|'bp_bulk', qty?: number, ref_type?: string, ref_id?: string }
// Success: { ok: true, balance }
// 402 if insufficient, 403 if no quota row, 400 on bad input, 401 if not auth
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    const qty = Number.isFinite(body.qty) && body.qty > 0 ? Math.floor(body.qty) : 1
    const refType = typeof body.ref_type === 'string' ? body.ref_type : null
    const refId = typeof body.ref_id === 'string' && body.ref_id.length > 0 ? body.ref_id : null

    if (!VALID_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await sb.rpc('debit_fillthegap', {
      p_user_id:  user.id,
      p_qty:      qty,
      p_action:   ACTION_TO_DB[action],
      p_ref_type: refType,
      p_ref_id:   refId,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('insufficient_fillthegap_credits')) {
        return NextResponse.json({ ok: false, error: 'insufficient' }, { status: 402 })
      }
      if (msg.includes('no_fillthegap_quota')) {
        return NextResponse.json({ ok: false, error: 'no_quota' }, { status: 403 })
      }
      console.error('[/api/credits/fillthegap/debit] rpc error', error)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    const balance = typeof data === 'number' ? data : 0
    return NextResponse.json({ ok: true, balance })
  } catch (err) {
    console.error('[/api/credits/fillthegap/debit]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
