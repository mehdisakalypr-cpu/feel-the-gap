import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/demo/tour?parcours=entrepreneur — Return tour steps for a parcours
export async function GET(req: NextRequest) {
  try {
    const parcours = req.nextUrl.searchParams.get('parcours')?.trim().toLowerCase()
    if (!parcours) {
      return NextResponse.json({ error: 'Paramètre parcours requis.' }, { status: 400 })
    }

    const validParcours = ['entrepreneur', 'influenceur', 'financeur', 'investisseur']
    if (!validParcours.includes(parcours)) {
      return NextResponse.json({ error: 'Parcours invalide.' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('demo_tours')
      .select('*')
      .eq('parcours', parcours)
      .eq('published', true)
      .order('step_order', { ascending: true })

    if (error) {
      console.error('[demo/tour GET] error', error)
      return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
    }

    return NextResponse.json({ steps: data ?? [] })
  } catch (err) {
    console.error('[demo/tour GET]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
