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

export async function GET(_req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  const db = adminDb()
  const { data, error } = await db
    .from('content_libraries')
    .select('*, library_items(count)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ libraries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  let body: { name: string; slug: string; description?: string; created_by?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || !body.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  const db = adminDb()
  const { data, error } = await db
    .from('content_libraries')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      created_by: body.created_by ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ library: data })
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  let body: { id: string; name?: string; description?: string; cover_url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const db = adminDb()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.cover_url !== undefined) updates.cover_url = body.cover_url

  const { data, error } = await db
    .from('content_libraries')
    .update(updates)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ library: data })
}
