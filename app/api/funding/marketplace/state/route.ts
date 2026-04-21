import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/funding/marketplace/state
// Public transparency counters for the funding marketplace (phase, dossier counts, waitlist…).
// Used by landing pages to show "47/50 dossiers · phase sourcing" style banners.
export async function GET() {
  const sb = await createSupabaseServer()
  const { data, error } = await sb
    .from('marketplace_state')
    .select('phase, dossiers_complete_count, dossiers_in_progress_count, waitlist_count, unlock_threshold, freeze_floor, founding_pioneer_limit, founding_pioneer_used, founding_pioneer_discount_pct, force_open, last_computed_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({
      phase: 'sourcing',
      dossiers_complete_count: 0,
      dossiers_in_progress_count: 0,
      waitlist_count: 0,
      unlock_threshold: 50,
      freeze_floor: 30,
      founding_pioneer_limit: 50,
      founding_pioneer_used: 0,
      founding_pioneer_discount_pct: 30,
      force_open: false,
      last_computed_at: new Date().toISOString(),
    })
  }
  return NextResponse.json(data)
}
