import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/supabase-server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

const DEFAULT = { newsletter: true, product_updates: true, outreach: false }

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = admin()
  const { data } = await sb.from('profiles').select('email_preferences').eq('id', user.id).maybeSingle()
  return NextResponse.json({ preferences: data?.email_preferences ?? DEFAULT })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let prefs: Record<string, boolean> = {}
  try { prefs = (await req.json())?.preferences ?? {} } catch {}
  const clean = {
    newsletter: !!prefs.newsletter,
    product_updates: !!prefs.product_updates,
    outreach: !!prefs.outreach,
  }
  const sb = admin()
  const { error } = await sb.from('profiles').update({ email_preferences: clean }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await sb.from('account_audit_log').insert({ user_id: user.id, event: 'email_preferences_updated', details: clean })
  return NextResponse.json({ ok: true, preferences: clean })
}
