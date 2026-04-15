import { createClient } from '@supabase/supabase-js'
import { CREDIT_COSTS, type CreditAction } from './costs'

/**
 * Atomic debit using the SQL function `debit_credits`.
 * Throws `insufficient_credits` if balance too low (caller should catch and
 * propose top-up packs in UI).
 */
export async function debit(params: {
  userId: string
  action: CreditAction
  refType?: string
  refId?: string
  ip?: string | null
  userAgent?: string | null
  multiplier?: number // e.g. 20 buyers exported = multiplier=20
}): Promise<{ ok: true } | { ok: false; error: 'insufficient_credits' | string }> {
  const cost = CREDIT_COSTS[params.action] * (params.multiplier ?? 1)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { error } = await admin.rpc('debit_credits', {
    p_user_id: params.userId,
    p_cost: cost,
    p_action: params.action,
    p_ref_type: params.refType ?? null,
    p_ref_id: params.refId ?? null,
    p_ip: params.ip ?? null,
    p_user_agent: params.userAgent ?? null,
  })
  if (error) {
    if (error.code === '23514' || /insufficient/i.test(error.message)) {
      return { ok: false, error: 'insufficient_credits' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Read solde (subscription + topup combined). */
export async function getBalance(userId: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data } = await admin.rpc('credits_balance', { p_user_id: userId })
  return data?.[0] ?? { subscription: 0, topup: 0, total: 0, plan: 'free', period_end: null }
}
