import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = supabaseAdmin()

  const [
    { data: profile },
    { data: sessions },
    { data: pageViews },
    { data: payments },
    { data: tickets },
  ] = await Promise.all([
    admin.from('profiles')
      .select('id, email, full_name, company, tier, is_billed, is_admin, is_delegate_admin, demo_expires_at, ai_credits, stripe_customer_id, stripe_subscription_id, created_at')
      .eq('id', id).single(),
    admin.from('user_sessions')
      .select('id, started_at, last_seen_at, page_count, events_count, ip_hash, user_agent, referrer, converted')
      .eq('user_id', id)
      .order('started_at', { ascending: false })
      .limit(100),
    admin.from('tracking_events')
      .select('id, event_type, page, event_data, created_at, session_id')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('revenue_events')
      .select('id, event_type, amount_eur, plan, interval, stripe_event_id, metadata, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('refund_tickets')
      .select('id, ticket_number, status, reason, months, total_amount_eur, created_at, updated_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!profile) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })

  // Compute page time analytics from page_view events
  const pageTimeMap: Record<string, { totalMs: number; count: number }> = {}
  const sortedViews = (pageViews ?? [])
    .filter((e: any) => e.event_type === 'page_view' && e.page)
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  for (let i = 0; i < sortedViews.length; i++) {
    const current = sortedViews[i] as any
    const next = sortedViews[i + 1] as any
    const page = current.page as string

    if (!pageTimeMap[page]) pageTimeMap[page] = { totalMs: 0, count: 0 }
    pageTimeMap[page].count++

    // Estimate time on page: diff to next event in same session, cap at 10min
    if (next && next.session_id === current.session_id) {
      const diff = new Date(next.created_at).getTime() - new Date(current.created_at).getTime()
      if (diff > 0 && diff < 600000) {
        pageTimeMap[page].totalMs += diff
      }
    }
  }

  // Calculate percentages
  const totalTimeMs = Object.values(pageTimeMap).reduce((s, v) => s + v.totalMs, 0)
  const pageAnalytics = Object.entries(pageTimeMap)
    .map(([page, data]) => ({
      page,
      views: data.count,
      totalTimeMs: data.totalMs,
      avgTimeMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
      pctTime: totalTimeMs > 0 ? Math.round((data.totalMs / totalTimeMs) * 100) : 0,
    }))
    .sort((a, b) => b.totalTimeMs - a.totalTimeMs)

  // Compute session analytics
  const sessionAnalytics = (sessions ?? []).map((s: any) => {
    const duration = s.last_seen_at && s.started_at
      ? new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()
      : 0
    return { ...s, durationMs: duration }
  })

  // Payment history: monthly invoices
  const invoices = (payments ?? [])
    .filter((p: any) => p.event_type === 'invoice_paid' || p.event_type === 'subscription_created')
    .map((p: any) => ({
      id: p.id,
      date: p.created_at,
      amount_eur: p.amount_eur,
      plan: p.plan,
      stripe_event_id: p.stripe_event_id,
      metadata: p.metadata,
    }))

  return NextResponse.json({
    profile,
    sessions: sessionAnalytics,
    pageAnalytics,
    invoices,
    tickets: tickets ?? [],
    totalConnections: sessions?.length ?? 0,
  })
}
