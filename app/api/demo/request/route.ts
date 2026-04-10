import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/demo/request — Create a demo request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email?: string
      full_name?: string
      company?: string
      message?: string
    }

    const email = body.email?.trim().toLowerCase()
    if (!email || !body.full_name?.trim()) {
      return NextResponse.json(
        { error: 'Email et nom complet sont requis.' },
        { status: 400 },
      )
    }

    const sb = supabaseAdmin()

    // Check if a request already exists for this email
    const { data: existing, error: fetchErr } = await sb
      .from('demo_requests')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchErr) {
      console.error('[demo/request POST] fetch error', fetchErr)
      return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
    }

    // If pending or approved, return the existing request
    if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
      return NextResponse.json({ request: existing, existing: true })
    }

    // Insert new request
    const { data: inserted, error: insertErr } = await sb
      .from('demo_requests')
      .insert({
        email,
        full_name: body.full_name.trim(),
        company: body.company?.trim() || null,
        message: body.message?.trim() || null,
        status: 'pending',
      })
      .select('*')
      .single()

    if (insertErr) {
      console.error('[demo/request POST] insert error', insertErr)
      return NextResponse.json({ error: 'Impossible de créer la demande.' }, { status: 500 })
    }

    return NextResponse.json({ request: inserted, existing: false }, { status: 201 })
  } catch (err) {
    console.error('[demo/request POST]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/demo/request?email=xxx — Check status of a demo request
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Paramètre email requis.' }, { status: 400 })
    }

    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('demo_requests')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[demo/request GET] error', error)
      return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ request: null })
    }

    return NextResponse.json({ request: data })
  } catch (err) {
    console.error('[demo/request GET]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
