import { NextRequest, NextResponse } from 'next/server'
import { getTransportQuote, getTransportQuoteMatrix, type TransportMode } from '@/lib/transport/quotes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/transport/quote — renvoie un (ou plusieurs) devis transport.
 * Body : { originPort, originCountry, destinationPort, destinationCountry, mode?, weightKg, volumeM3?, valueEur?, compare? }
 * Si compare=true → renvoie une matrice (ocean_lcl, air, road).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const required = ['originPort', 'originCountry', 'destinationPort', 'destinationCountry', 'weightKg']
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return NextResponse.json({ error: `missing field: ${k}` }, { status: 400 })
      }
    }

    if (body.compare) {
      const modes: TransportMode[] = Array.isArray(body.modes) && body.modes.length > 0
        ? body.modes
        : ['ocean_lcl', 'air', 'road']
      const matrix = await getTransportQuoteMatrix({
        originPort: body.originPort,
        originCountry: body.originCountry,
        destinationPort: body.destinationPort,
        destinationCountry: body.destinationCountry,
        weightKg: Number(body.weightKg),
        volumeM3: body.volumeM3 !== undefined ? Number(body.volumeM3) : undefined,
        valueEur: body.valueEur !== undefined ? Number(body.valueEur) : undefined,
        incoterm: body.incoterm,
      }, modes)
      return NextResponse.json({ ok: true, quotes: matrix })
    }

    const q = await getTransportQuote({
      originPort: body.originPort,
      originCountry: body.originCountry,
      destinationPort: body.destinationPort,
      destinationCountry: body.destinationCountry,
      mode: body.mode,
      weightKg: Number(body.weightKg),
      volumeM3: body.volumeM3 !== undefined ? Number(body.volumeM3) : undefined,
      valueEur: body.valueEur !== undefined ? Number(body.valueEur) : undefined,
      incoterm: body.incoterm,
    })
    return NextResponse.json({ ok: true, quote: q })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
