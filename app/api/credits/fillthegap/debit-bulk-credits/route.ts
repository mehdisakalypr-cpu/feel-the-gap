/**
 * POST /api/credits/fillthegap/debit-bulk-credits
 *
 * Alternative à /debit-bulk pour les users **sans quota Fill-the-Gap** (tiers
 * free / solo_producer / starter / strategy) qui veulent quand même générer
 * des business plans en payant avec leurs crédits standard (bp_generate × N).
 *
 * Body: { opportunity_ids: string[] }
 * 200  { ok:true, balance, queued, debited_credits }
 * 400  invalid_input · 401 unauthorized · 402 insufficient_credits · 500 rpc_error
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { CREDIT_COSTS } from '@/lib/credits/costs'

export const runtime = 'nodejs'

const MAX_IDS_PER_CALL = 50

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}))
    const idsRaw: unknown[] = Array.isArray(body.opportunity_ids)
      ? (body.opportunity_ids as unknown[])
      : []
    const ids: string[] = Array.from(
      new Set(
        idsRaw
          .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
          .slice(0, MAX_IDS_PER_CALL),
      ),
    )
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'no_ids' }, { status: 400 })
    }

    const sb = await createSupabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const admin = adminClient()
    const { data: balRow, error: balErr } = await admin.rpc('credits_balance', { p_user_id: user.id })
    if (balErr) {
      console.error('[debit-bulk-credits] balance rpc error', balErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }
    const bal = balRow?.[0]
    const credits = Number(bal?.total ?? 0)
    const costPerBp = CREDIT_COSTS.bp_generate
    const needed = costPerBp * ids.length

    if (credits < needed) {
      return NextResponse.json(
        { ok: false, error: 'insufficient_credits', balance: credits, needed },
        { status: 402 },
      )
    }

    const { error: debitErr } = await admin.rpc('debit_credits', {
      p_user_id:   user.id,
      p_cost:      needed,
      p_action:    'bp_generate',
      p_ref_type:  'opportunity_bulk',
      p_ref_id:    null,
      p_ip:        req.headers.get('x-forwarded-for') ?? null,
      p_user_agent: req.headers.get('user-agent') ?? null,
    })

    if (debitErr) {
      const msg = (debitErr.message || '').toLowerCase()
      if (debitErr.code === '23514' || msg.includes('insufficient')) {
        return NextResponse.json(
          { ok: false, error: 'insufficient_credits', balance: credits, needed },
          { status: 402 },
        )
      }
      console.error('[debit-bulk-credits] debit rpc error', debitErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      balance: credits - needed,
      queued: ids.length,
      debited_credits: needed,
    })
  } catch (err) {
    console.error('[debit-bulk-credits]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
