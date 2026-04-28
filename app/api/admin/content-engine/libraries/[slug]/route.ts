import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase-server'

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const gate = await requireAdmin()
  if (gate) return gate

  const { slug } = await params
  const db = adminDb()

  const { data: library, error } = await db
    .from('content_libraries')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !library) {
    return NextResponse.json({ error: 'Library not found' }, { status: 404 })
  }

  const { data: items } = await db
    .from('library_items')
    .select('*')
    .eq('library_id', library.id)
    .order('added_at', { ascending: false })

  return NextResponse.json({ library, items: items ?? [] })
}
