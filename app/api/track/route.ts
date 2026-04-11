import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, event_type, event_data, page, event, properties } = body

    const admin = supabaseAdmin()

    // Lightweight unsupported language tracking (no session required)
    if ((event ?? event_type) === 'unsupported_lang') {
      const lang = properties?.lang ?? event_data?.lang ?? 'unknown'
      await admin.from('tracking_events').insert({
        session_id: session_id ?? 'anon',
        event_type: 'unsupported_lang',
        event_data: { lang, url: properties?.url ?? page ?? '' },
        page: properties?.url ?? page ?? '',
      })
      return NextResponse.json({ ok: true })
    }

    // Funnel step tracking
    if ((event ?? event_type) === 'funnel_step') {
      await admin.from('funnel_events').insert({
        session_id: properties?.session_id ?? session_id ?? 'anon',
        step: properties?.step ?? '',
        action: properties?.action ?? '',
        metadata: properties ?? {},
      }).then(() => null, () => null) // table might not exist yet
      return NextResponse.json({ ok: true })
    }

    // Exit feedback
    if ((event ?? event_type) === 'exit_feedback') {
      await admin.from('exit_feedback').insert({
        session_id: properties?.session_id ?? session_id ?? 'anon',
        exit_step: properties?.exit_step ?? '',
        reason: properties?.reason,
        feedback_text: properties?.feedback_text,
        would_return: properties?.would_return,
        missing_feature: properties?.missing_feature,
        email: properties?.email,
      }).then(() => null, () => null)
      return NextResponse.json({ ok: true })
    }

    if (!session_id || !event_type) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

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
