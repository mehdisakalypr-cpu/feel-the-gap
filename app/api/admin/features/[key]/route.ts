import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, getAuthUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function service() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const gate = await requireAdmin()
  if (gate) return gate
  const { key } = await params
  const body = await req.json().catch(() => ({}))
  const enabled = body?.enabled === true
  const user = await getAuthUser()

  const sb = service()
  const { data, error } = await sb
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('key', key)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
  return NextResponse.json({ ok: true, flag: data })
}
