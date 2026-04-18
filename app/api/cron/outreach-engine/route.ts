import { NextRequest, NextResponse } from 'next/server'
import { runOutreachEngine } from '@/agents/outreach-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron — envoie les pitchs outreach aux entrepreneur_demos status='generated'.
 * Prio email (Resend) > WhatsApp (CallMeBot fallback). Fail-silent si clés absentes.
 * Fréquence : quotidienne (11h UTC = 13h Paris, heure ouvrée EU+Afrique matin).
 *
 * Protection :
 *  - Si CRON_SECRET set → requiert header Authorization: Bearer <CRON_SECRET>
 *  - Sinon (dev/early stage) → ouvert mais `apply` requiert ?apply=1 explicite
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  // En cron Vercel, apply=1 par défaut. En hit manuel sans secret, apply=0 par défaut.
  const fromCron = authHeader === `Bearer ${secret}`
  const applyParam = url.searchParams.get('apply')
  const apply = applyParam !== null ? applyParam === '1' : fromCron
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(1, Number(limitParam)), 100) : 25

  try {
    const res = await runOutreachEngine({ apply, limit })
    return NextResponse.json({ ok: true, ...res })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
