import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const source = req.nextUrl.searchParams.get('source') ?? 'all'

  try {
    const { runFreeCollector, runGapAnalyzer } = await import('@/agents/free-collector')

    if (source === 'all') {
      // Run full collection in background — don't await (too long for HTTP response)
      runFreeCollector({ year: 2023 }).then(() => runGapAnalyzer()).catch(console.error)
      return NextResponse.json({ ok: true, message: 'Full collection started in background', source: 'all' })
    }

    // Source-specific collection
    if (source === 'world_bank' || source === 'world_bank_wits') {
      const { fetchWorldBankIndicators } = await import('@/agents/sources/world-bank')
      const { supabaseAdmin } = await import('@/lib/supabase')
      const admin = supabaseAdmin()

      // Fetch all countries
      const { data: countries } = await admin.from('countries').select('id')
      const isos = (countries ?? []).map((c: any) => c.id)

      fetchWorldBankIndicators(isos, 2023).then(async (data) => {
        for (const [iso3, indicators] of Object.entries(data)) {
          if (!indicators || Object.keys(indicators).length === 0) continue
          await admin.from('countries').upsert({ id: iso3, ...indicators }, { onConflict: 'id' })
        }
      }).catch(console.error)

      return NextResponse.json({ ok: true, message: `World Bank collection started for ${isos.length} countries`, source })
    }

    if (source === 'faostat') {
      runFreeCollector({ year: 2023, sources: ['fao'] }).catch(console.error)
      return NextResponse.json({ ok: true, message: 'FAO STAT collection started', source })
    }

    if (source === 'imf_dots') {
      runFreeCollector({ year: 2023, sources: ['imf'] }).catch(console.error)
      return NextResponse.json({ ok: true, message: 'IMF DOTS collection started', source })
    }

    // Default: run full collector for unknown source
    runFreeCollector({ year: 2023 }).catch(console.error)
    return NextResponse.json({ ok: true, message: `Collection started for source: ${source}`, source })

  } catch (err: any) {
    console.error('[AdminCollect] Error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
