import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { BUYER_REVEAL_COST_CREDITS } from '@/lib/credits/costs'

/**
 * POST /api/buyers/reveal
 * Body: { buyer_ids: string[], iso?: string }
 *
 * Débit atomique des crédits Fill-the-Gap pour révéler les buyers locked,
 * puis insertion dans `buyer_reveals` (idempotent via unique(user_id, buyer_id)).
 *
 * Coût par buyer :
 *   - vérifié : BUYER_REVEAL_COST_CREDITS.verified
 *   - non vérifié : BUYER_REVEAL_COST_CREDITS.basic
 *
 * Réponses :
 *   200 { ok:true, revealed: BuyerReveal[], balance, debited }
 *   400 invalid_input
 *   401 unauthorized
 *   402 insufficient { needed, balance }
 *   403 no_quota
 *   500 server_error
 */

const MAX_IDS_PER_CALL = 50

export async function POST(req: NextRequest) {
  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}))
    const idsRaw: unknown[] = Array.isArray(body.buyer_ids)
      ? (body.buyer_ids as unknown[])
      : []
    const iso = typeof body.iso === 'string' ? body.iso.toUpperCase() : null

    const ids: string[] = Array.from(
      new Set(
        idsRaw
          .filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v))
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

    // 1) Charger les buyers candidats (pour calculer le coût et filtrer pays).
    const admin = supabaseAdmin()
    let buyersQuery = admin
      .from('local_buyers')
      .select('id, verified, country_iso')
      .in('id', ids)
    if (iso) buyersQuery = buyersQuery.eq('country_iso', iso)

    const { data: buyers, error: buyersErr } = await buyersQuery
    if (buyersErr) {
      console.error('[/api/buyers/reveal] buyers fetch', buyersErr)
      return NextResponse.json({ ok: false, error: 'fetch_error' }, { status: 500 })
    }

    if (!buyers?.length) {
      return NextResponse.json({ ok: false, error: 'buyers_not_found' }, { status: 400 })
    }

    // 2) Filtrer ceux déjà révélés pour ce user — gratuits, on les retournera
    //    quand même pour confirmer côté client.
    const { data: alreadyRevealed, error: revErr } = await admin
      .from('buyer_reveals')
      .select('buyer_id')
      .eq('user_id', user.id)
      .in('buyer_id', buyers.map(b => b.id))
    if (revErr) {
      console.error('[/api/buyers/reveal] reveals fetch', revErr)
      return NextResponse.json({ ok: false, error: 'fetch_error' }, { status: 500 })
    }
    const alreadySet = new Set((alreadyRevealed ?? []).map(r => r.buyer_id))

    // 3) Calcul du coût pour les buyers à débiter.
    const toDebit = buyers.filter(b => !alreadySet.has(b.id))
    const costByBuyer = new Map<string, number>(
      toDebit.map(b => [
        b.id,
        b.verified
          ? BUYER_REVEAL_COST_CREDITS.verified
          : BUYER_REVEAL_COST_CREDITS.basic,
      ]),
    )
    const totalCost = Array.from(costByBuyer.values()).reduce((a, b) => a + b, 0)

    // 4) Si rien à débiter (tout déjà révélé), succès direct.
    if (totalCost === 0) {
      const { data: balRow } = await sb.rpc('fillthegap_balance', { p_user_id: user.id })
      const row = Array.isArray(balRow) ? balRow[0] : balRow
      const balance: number = typeof row?.balance === 'number' ? row.balance : 0
      return NextResponse.json({
        ok: true,
        revealed: buyers.map(b => b.id),
        balance,
        debited: 0,
      })
    }

    // 5) Pré-check balance pour 402 propre.
    const { data: balRow, error: balErr } = await sb.rpc('fillthegap_balance', {
      p_user_id: user.id,
    })
    if (balErr) {
      console.error('[/api/buyers/reveal] balance rpc', balErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }
    const row = Array.isArray(balRow) ? balRow[0] : balRow
    const balance: number = typeof row?.balance === 'number' ? row.balance : 0

    if (balance < totalCost) {
      return NextResponse.json(
        { ok: false, error: 'insufficient', balance, needed: totalCost },
        { status: 402 },
      )
    }

    // 6) Débit atomique (1 row agrégée sur ftg_fillthegap_tx, action=fillthegap_clients).
    const { data: newBalance, error: debitErr } = await sb.rpc('debit_fillthegap', {
      p_user_id:  user.id,
      p_qty:      totalCost,
      p_action:   'fillthegap_clients',
      p_ref_type: 'buyer',
      p_ref_id:   null,
    })
    if (debitErr) {
      const msg = (debitErr.message || '').toLowerCase()
      if (msg.includes('insufficient_fillthegap_credits')) {
        return NextResponse.json(
          { ok: false, error: 'insufficient', balance, needed: totalCost },
          { status: 402 },
        )
      }
      if (msg.includes('no_fillthegap_quota')) {
        return NextResponse.json({ ok: false, error: 'no_quota' }, { status: 403 })
      }
      console.error('[/api/buyers/reveal] debit rpc', debitErr)
      return NextResponse.json({ ok: false, error: 'rpc_error' }, { status: 500 })
    }

    // 7) Insert reveals (service-role, on respecte unique pour idempotence).
    const inserts = toDebit.map(b => ({
      user_id: user.id,
      buyer_id: b.id,
      cost_credits: costByBuyer.get(b.id) ?? 0,
    }))
    const { error: insertErr } = await admin
      .from('buyer_reveals')
      .upsert(inserts, { onConflict: 'user_id,buyer_id', ignoreDuplicates: true })
    if (insertErr) {
      // Le débit a réussi mais l'insert échoue — on log mais on ne re-crédite pas
      // (la transaction est déjà committée). Le user verra les buyers comme locked
      // au prochain reload mais aura été débité — à monitorer.
      console.error('[/api/buyers/reveal] reveals insert', insertErr)
      return NextResponse.json({ ok: false, error: 'reveal_insert_failed' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      revealed: buyers.map(b => b.id),
      balance: typeof newBalance === 'number' ? newBalance : balance - totalCost,
      debited: totalCost,
    })
  } catch (err) {
    console.error('[/api/buyers/reveal]', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
