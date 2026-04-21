import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { publishToPlatform, type Platform } from '@/lib/ad-factory/distribution/platforms'
import { convertToFormats, extractPoster } from '@/lib/ad-factory/formats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * GET /api/admin/ad-factory/distribute?variant_id=...
 * Renvoie les outputs (formats) existants + publications programmées.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const variantId = new URL(req.url).searchParams.get('variant_id')
  if (!variantId) return NextResponse.json({ error: 'variant_id required' }, { status: 400 })

  const sb = admin()
  const [out, pubs] = await Promise.all([
    sb.from('ftg_ad_outputs').select('*').eq('variant_id', variantId),
    sb.from('ftg_ad_publications').select('*').order('created_at', { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    ok: true,
    outputs: out.data ?? [],
    publications: pubs.data ?? [],
  })
}

/**
 * POST /api/admin/ad-factory/distribute
 * Body : { variant_id, generateFormats?: boolean, publish?: { platforms: Platform[], caption, hashtags?, scheduledFor? } }
 *
 * 1. Si generateFormats=true → FFmpeg convert en 4 formats + poster
 * 2. Si publish fourni → POST stubbed sur chaque plateforme + track ftg_ad_publications
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const body = await req.json().catch(() => ({}))
  const variantId = body.variant_id
  if (!variantId) return NextResponse.json({ error: 'variant_id required' }, { status: 400 })

  const sb = admin()

  // Récupère le master mp4 du dernier job completed pour ce variant
  const { data: job } = await sb
    .from('ftg_ad_render_jobs')
    .select('id, final_mp4_url')
    .eq('variant_id', variantId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job?.final_mp4_url) {
    return NextResponse.json({ error: 'no completed render for this variant — run a job first' }, { status: 400 })
  }

  const response: { outputs?: unknown[]; publications?: unknown[] } = {}

  // 1. Format Factory
  if (body.generateFormats) {
    const aspects = Array.isArray(body.aspects) ? body.aspects : ['16:9', '9:16', '1:1', '4:5']
    const outputs = await convertToFormats(job.final_mp4_url, aspects, job.id)
    const poster = await extractPoster(job.final_mp4_url, job.id)

    const rows: Array<Record<string, unknown>> = outputs.map(o => ({
      variant_id: variantId,
      aspect_ratio: o.aspect,
      resolution: o.resolution,
      url: o.url,
      file_size_bytes: o.fileSizeBytes ?? null,
      duration_s: o.durationS ?? null,
      format_kind: 'mp4',
    }))
    if (poster) {
      rows.push({
        variant_id: variantId,
        aspect_ratio: 'poster',
        resolution: '1920x1080',
        url: poster,
        file_size_bytes: null,
        duration_s: null,
        format_kind: 'jpg',
      })
    }
    if (rows.length > 0) {
      await sb.from('ftg_ad_outputs').insert(rows)
      response.outputs = rows
    }
  }

  // 2. Publications
  if (body.publish?.platforms?.length > 0) {
    const platforms: Platform[] = body.publish.platforms
    const caption: string = body.publish.caption ?? ''
    const hashtags: string[] = body.publish.hashtags ?? []
    const scheduledFor: string | undefined = body.publish.scheduledFor

    // On prend le format 9:16 par défaut (ou le premier dispo) pour platforms verticales
    const { data: outputs } = await sb.from('ftg_ad_outputs').select('*').eq('variant_id', variantId)
    const pick = (pref: string) => outputs?.find(o => o.aspect_ratio === pref)?.url ?? outputs?.[0]?.url

    const pubRows: Record<string, unknown>[] = []
    for (const plat of platforms) {
      const useUrl = (plat === 'youtube' || plat === 'linkedin' || plat === 'twitter') ? pick('16:9') : pick('9:16')
      const r = await publishToPlatform({
        platform: plat,
        videoUrl: useUrl ?? job.final_mp4_url,
        caption, hashtags, scheduledFor,
        targetSiteId: body.publish.targetSiteId,
      })
      pubRows.push({
        output_id: null,  // on pourrait lier à l'output précis
        platform: plat,
        platform_post_id: r.platformPostId ?? null,
        status: r.ok ? (r.stub ? 'stub-scheduled' : (scheduledFor ? 'scheduled' : 'published')) : 'failed',
        caption, hashtags,
        scheduled_for: scheduledFor ?? null,
        published_at: r.ok && !scheduledFor ? new Date().toISOString() : null,
        error: r.error ?? null,
      })
    }
    if (pubRows.length > 0) {
      await sb.from('ftg_ad_publications').insert(pubRows)
      response.publications = pubRows
    }
  }

  return NextResponse.json({ ok: true, ...response })
}
