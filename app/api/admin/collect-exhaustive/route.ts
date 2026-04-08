import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const mode  = body.mode  ?? 'missing'
  const isos  = body.isos  ?? undefined
  const year  = body.year  ?? 2023

  try {
    const { runExhaustiveCollector } = await import('@/agents/exhaustive-collector')

    // Fire and forget — runs as long as needed
    runExhaustiveCollector({ mode, isos, year }).catch(console.error)

    return NextResponse.json({
      ok: true,
      message: `Exhaustive collection started in background (mode=${mode}, year=${year})`,
      countries: mode === 'europe' ? '47 pays Europe' : mode === 'missing' ? 'Pays sans données uniquement' : '190+ pays tous continents',
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
