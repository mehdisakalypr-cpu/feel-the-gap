import { NextResponse } from 'next/server'
import { debit, getBalance } from './debit'
import { CREDIT_COSTS, type CreditAction } from './costs'

/**
 * Middleware helper: require authenticated user + debit credits atomically.
 * Use in API routes:
 *
 *   import { requireCredits } from '@/lib/credits/middleware'
 *   const gate = await requireCredits(req, user, 'bp_generate')
 *   if (!gate.ok) return gate.response
 *   // ... do the work
 */
export async function requireCredits(
  req: Request,
  user: { id: string } | null,
  action: CreditAction,
  opts?: { multiplier?: number; refType?: string; refId?: string },
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    }
  }
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    null
  const ua = req.headers.get('user-agent') ?? null

  const result = await debit({
    userId: user.id,
    action,
    refType: opts?.refType,
    refId: opts?.refId,
    ip,
    userAgent: ua,
    multiplier: opts?.multiplier,
  })

  if (!result.ok && result.error === 'insufficient_credits') {
    const balance = await getBalance(user.id)
    const needed = CREDIT_COSTS[action] * (opts?.multiplier ?? 1)
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'insufficient_credits',
          needed,
          balance,
          upgrade_url: '/pricing',
          topup_url: '/credits/buy',
        },
        { status: 402 }, // HTTP 402 Payment Required
      ),
    }
  }
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: result.error }, { status: 500 }),
    }
  }
  return { ok: true }
}
