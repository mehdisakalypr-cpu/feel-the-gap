import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, event_type, event_data, page } = body

    if (!session_id || !event_type) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const admin = supabaseAdmin()

    // Upsert session (last_seen + count)
    await admin.from('user_sessions').upsert({
      id: session_id,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })

    // Insert event
    await admin.from('tracking_events').insert({
      session_id,
      event_type,
      event_data: event_data ?? {},
      page,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Never return 5xx — tracking must silently fail
    console.error('[/api/track]', err)
    return NextResponse.json({ ok: false })
  }
}
