import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/auth-v2/supabase-server'
import { auditAndEnqueueForOpp, type EishiAuditResult } from '@/lib/eishi-adaptor'

export const dynamic = 'force-dynamic'

// GET /api/content/status?opp_id=X&country=ISO3&lang=fr&enqueue=1
// Returns per-section state (ready | thin | missing | generating). When
// enqueue=1 AND the authenticated user has a paid tier, will enqueue
// priority=100 jobs for any section that isn't ready. The premium UI polls
// this on mount so the user sees "Synthèse en cours" rather than a void.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const oppId = searchParams.get('opp_id')
  const country = searchParams.get('country')
  const lang = searchParams.get('lang') ?? 'fr'
  const wantEnqueue = searchParams.get('enqueue') === '1'

  if (!oppId || !country) {
    return NextResponse.json({ error: 'opp_id and country required' }, { status: 400 })
  }

  // Identify user via cookie-based SSR client (same pattern as the rest of auth-v2)
  const ssr = await supabaseServer()
  const { data: auth } = await ssr.auth.getUser()
  const userId = auth?.user?.id ?? null

  // Audit/enqueue uses the service role admin client (bypasses RLS intentionally —
  // we've already validated the user via cookies above).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  // Only paid users can trigger enqueue. Read tier from profiles.
  let canEnqueue = false
  if (userId && wantEnqueue) {
    const { data: profile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle()
    const tier = profile?.tier
    canEnqueue = !!tier && tier !== 'explorer' && tier !== 'free'
  }

  const result: EishiAuditResult = await auditAndEnqueueForOpp(admin, {
    userId: userId ?? 'anon',
    oppId,
    countryIso: country,
    lang,
    enqueue: canEnqueue,
    source: 'premium_visit',
  })

  return NextResponse.json(result, {
    headers: { 'cache-control': 'no-store' },
  })
}
