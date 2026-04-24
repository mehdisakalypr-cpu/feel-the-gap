/**
 * POST /api/reports/bp-access
 *
 * Ticket d'accès unifié pour la génération Business Plans (bouton vert FTG).
 * Le client envoie le nombre d'opportunités sélectionnées; on répond avec
 * le mode d'accès et les infos pour que l'UI affiche la bonne modale :
 *
 *   - mode='direct'  → user a tier Premium/Strategy/Ultimate → génération OK
 *   - mode='credits' → user a assez de crédits pour payer N × bp_generate
 *   - mode='upsell'  → propose subscription OR top-up (pas assez de crédits)
 *
 * 401 si non authentifié (UX: l'UI doit rediriger vers /login).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase-server'
import { CREDIT_COSTS, FILLTHEGAP_QUOTA_BY_TIER } from '@/lib/credits/costs'

export const runtime = 'nodejs'

type AccessMode = 'direct' | 'credits' | 'upsell'

const DIRECT_TIERS = new Set(['premium', 'strategy', 'ultimate', 'custom'])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch {}
  const oppsCount = Math.max(1, Math.min(500, Number(body?.opps_count) || 1))

  const admin = adminClient()

  const { data: profile } = await admin
    .from('user_profiles')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle()
  const tier = (profile?.tier as string | undefined) ?? 'free'

  const { data: balRow } = await admin.rpc('credits_balance', { p_user_id: user.id })
  const balance = balRow?.[0]
  const credits = Number(balance?.total ?? 0)
  const subscriptionCredits = Number(balance?.subscription ?? 0)
  const topupCredits = Number(balance?.topup ?? 0)

  const { data: ftgRow } = await admin.rpc('fillthegap_balance', { p_user_id: user.id })
  const ftg = Array.isArray(ftgRow) ? ftgRow[0] : ftgRow
  const ftgBalance = Number(ftg?.balance ?? 0)

  const creditCostPerBp = CREDIT_COSTS.bp_generate
  const totalCreditsRequired = creditCostPerBp * oppsCount
  const ftgQuotaForTier = (FILLTHEGAP_QUOTA_BY_TIER as Record<string, number>)[tier] ?? 0

  let mode: AccessMode
  let reason: string
  if (DIRECT_TIERS.has(tier) && (ftgQuotaForTier === 0 || ftgBalance >= oppsCount)) {
    mode = 'direct'
    reason = ftgQuotaForTier === 0 ? 'tier_direct_access' : 'tier_with_ftg_quota'
  } else if (credits >= totalCreditsRequired) {
    mode = 'credits'
    reason = 'credits_sufficient'
  } else {
    mode = 'upsell'
    reason = DIRECT_TIERS.has(tier) ? 'ftg_quota_exhausted' : 'insufficient_credits_and_tier'
  }

  return NextResponse.json({
    ok: true,
    mode,
    reason,
    tier,
    opps_count: oppsCount,
    credits: {
      balance: credits,
      subscription: subscriptionCredits,
      topup: topupCredits,
      required: totalCreditsRequired,
      cost_per_bp: creditCostPerBp,
      sufficient: credits >= totalCreditsRequired,
    },
    ftg: {
      balance: ftgBalance,
      monthly_quota: ftgQuotaForTier,
      sufficient: ftgQuotaForTier > 0 && ftgBalance >= oppsCount,
    },
    upsell: mode === 'upsell' ? {
      missing_credits: Math.max(0, totalCreditsRequired - credits),
      subscribe_url: '/pricing',
      topup_url: '/pricing#topup',
    } : null,
  })
}
