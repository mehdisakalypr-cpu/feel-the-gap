import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()

  const { data: row } = await sb
    .from('user_referral_codes')
    .select('unique_code, clicks, signups, conversions, bonus_months_earned, recurring_credit_cents')
    .eq('user_id', user.id)
    .maybeSingle()

  let bonusMonths = 0
  const { data: profile } = await sb
    .from('profiles')
    .select('bonus_months_credit')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.bonus_months_credit) bonusMonths = profile.bonus_months_credit

  return NextResponse.json({
    code: row?.unique_code ?? null,
    clicks: row?.clicks ?? 0,
    signups: row?.signups ?? 0,
    conversions: row?.conversions ?? 0,
    bonus_months: bonusMonths,
    recurring_credit_cents: row?.recurring_credit_cents ?? 0,
  })
}

export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()
  const { data, error } = await sb.rpc('get_or_create_user_referral_code', { p_user: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}
