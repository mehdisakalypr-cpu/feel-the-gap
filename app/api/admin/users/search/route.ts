import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ users: [] })

  const admin = supabaseAdmin()

  // Search by email (ilike), full_name (ilike), or exact UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)

  let query = admin.from('profiles').select('id, email, full_name, company, tier, is_billed, is_admin, is_delegate_admin, demo_expires_at, ai_credits, stripe_customer_id, stripe_subscription_id, created_at')

  if (isUUID) {
    query = query.eq('id', q)
  } else {
    // Search email or full_name
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
  }

  const { data: users, error } = await query.order('created_at', { ascending: false }).limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: users ?? [] })
}
