import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300 // FFmpeg can take 2-3 min for 4 variants

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// POST /api/seller/ad-variants
// body: { product_id, source_video_url, ratios?: ['9:16', '1:1', '16:9', '4:5'] }
// Generates all variants and persists them into ad_variants table.
// Synchronous for MVP — async/queue later.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      product_id?: string
      source_video_url: string
      ratios?: Array<'9:16' | '1:1' | '16:9' | '4:5'>
    }
    if (!body.source_video_url) {
      return NextResponse.json({ error: 'Missing source_video_url' }, { status: 400 })
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ratios = body.ratios ?? ['9:16', '1:1', '16:9', '4:5']

    // Insert "queued" rows up front so the UI can track progress
    const queueRows = ratios.map((ratio) => ({
      product_id: body.product_id ?? null,
      user_id: user.id,
      source_video_url: body.source_video_url,
      ratio,
      status: 'queued' as const,
    }))
    const { data: queued, error: queueErr } = await supabase
      .from('ad_variants')
      .insert(queueRows)
      .select('id, ratio')
    if (queueErr) return NextResponse.json({ error: queueErr.message }, { status: 500 })

    // Generate variants (synchronous for MVP)
    const { generateAllVariants } = await import('@/agents/ad-variant-generator')
    const outdir = path.join(process.cwd(), 'public', 'ad-variants', user.id.slice(0, 8))

    const results = await generateAllVariants(body.source_video_url, outdir, ratios)

    // Update DB with output URLs
    const updates = []
    for (const r of results) {
      const queueRow = queued?.find((q) => q.ratio === r.ratio)
      if (!queueRow) continue
      const publicUrl = `/ad-variants/${user.id.slice(0, 8)}/${path.basename(r.path)}`
      const { error: updErr } = await supabase
        .from('ad_variants')
        .update({
          output_url: publicUrl,
          width: r.width,
          height: r.height,
          duration_sec: r.duration,
          file_size_bytes: r.file_size_bytes,
          status: 'ready',
        })
        .eq('id', queueRow.id)
      if (updErr) console.warn(`[ad-variants] update ${queueRow.id}: ${updErr.message}`)
      updates.push({ id: queueRow.id, ratio: r.ratio, url: publicUrl })
    }

    // Mark failed any ratios that didn't produce output
    const readyRatios = new Set(results.map((r) => r.ratio))
    for (const q of queued ?? []) {
      if (!readyRatios.has(q.ratio as typeof ratios[number])) {
        await supabase
          .from('ad_variants')
          .update({ status: 'failed', error_message: 'FFmpeg generation failed' })
          .eq('id', q.id)
      }
    }

    return NextResponse.json({ variants: updates }, { status: 201 })
  } catch (err) {
    console.error('[api/seller/ad-variants] POST', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/seller/ad-variants?product_id=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('product_id')

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let query = supabase
      .from('ad_variants')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (productId) query = query.eq('product_id', productId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ variants: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
