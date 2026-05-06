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

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (gate) return gate

  let body: {
    library_id: string
    job_id: string
    variant_id?: string | null
    media_url: string
    caption?: string
    persona?: string
    target_saas?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.library_id || !body.job_id || !body.media_url) {
    return NextResponse.json({ error: 'library_id, job_id, media_url are required' }, { status: 400 })
  }

  const db = adminDb()
  const { data, error } = await db
    .from('library_items')
    .upsert(
      {
        library_id: body.library_id,
        job_id: body.job_id,
        variant_id: body.variant_id ?? null,
        media_url: body.media_url,
        caption: body.caption ?? null,
        persona: body.persona ?? null,
        target_saas: body.target_saas ?? null,
      },
      { onConflict: 'library_id,job_id,variant_id' },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
