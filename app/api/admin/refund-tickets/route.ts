import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, getAuthUser } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// POST: create a refund ticket
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { userId, reason, months } = body

  if (!userId || !reason || !Array.isArray(months) || months.length === 0) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  const totalAmount = months.reduce((s: number, m: any) => s + (Number(m.amount_eur) || 0), 0)

  const admin = supabaseAdmin()

  // Check if requester is super admin or delegate
  const { data: requesterProfile } = await admin.from('profiles')
    .select('is_admin, is_delegate_admin')
    .eq('id', user.id).single()

  const isSuperAdmin = requesterProfile?.is_admin === true
  const isDelegate = requesterProfile?.is_delegate_admin === true

  if (!isSuperAdmin && !isDelegate) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
  }

  // Super admin: ticket goes directly to approved status
  // Delegate admin: ticket starts as pending (needs super admin validation)
  const initialStatus = isSuperAdmin ? 'approved' : 'pending'

  const { data: ticket, error } = await admin.from('refund_tickets').insert({
    user_id: userId,
    requested_by: user.id,
    status: initialStatus,
    reason,
    months,
    total_amount_eur: totalAmount,
  }).select('id, ticket_number, status').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add initial message
  await admin.from('refund_ticket_messages').insert({
    ticket_id: ticket.id,
    author_id: user.id,
    message: reason,
    action: isSuperAdmin ? 'approve' : null,
  })

  return NextResponse.json({ ticket })
}

// GET: list tickets (for admin dashboard)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status')
  const admin = supabaseAdmin()

  let query = admin.from('refund_tickets')
    .select(`
      id, ticket_number, status, reason, months, total_amount_eur, created_at, updated_at,
      user:user_id (id, email, full_name),
      requester:requested_by (id, email, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tickets: data ?? [] })
}
