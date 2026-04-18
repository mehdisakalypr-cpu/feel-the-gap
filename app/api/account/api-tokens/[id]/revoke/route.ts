import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getUser() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* readonly */ },
      },
    },
  )
  const { data } = await sb.auth.getUser()
  return data.user
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = admin()
  const { error, count } = await sb
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id)
    .eq('owner_id', user.id)
    .is('revoked_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: 'not found or already revoked' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
