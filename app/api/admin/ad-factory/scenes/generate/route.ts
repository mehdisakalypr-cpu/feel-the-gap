import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase-server'
import { generateScene } from '@/lib/ad-factory/providers/scene-gen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/admin/ad-factory/scenes/generate
 * Body: { name, prompt?, sourceImageUrl?, motionPrompt, aspectRatio?, durationSeconds?, category?, generateImageVariants? }
 *
 * Mode 1 (from-prompt) : prompt + generateImageVariants=true → 4 previews image (user picke ensuite)
 * Mode 2 (from-prompt direct) : prompt + motionPrompt → 1 image + animation
 * Mode 3 (from-image) : sourceImageUrl + motionPrompt → animation (OFA hero upgrader)
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(); if (gate) return gate
  const body = await req.json().catch(() => ({}))
  if (!body.motionPrompt && !body.generateImageVariants) {
    return NextResponse.json({ error: 'motionPrompt required (unless generateImageVariants=true for preview-only)' }, { status: 400 })
  }
  if (!body.prompt && !body.sourceImageUrl) {
    return NextResponse.json({ error: 'prompt OR sourceImageUrl required' }, { status: 400 })
  }

  const res = await generateScene({
    name: String(body.name ?? 'scene-' + Date.now()).slice(0, 80),
    prompt: body.prompt,
    sourceImageUrl: body.sourceImageUrl,
    motionPrompt: body.motionPrompt ?? 'subtle motion, ambient atmosphere',
    aspectRatio: body.aspectRatio,
    durationSeconds: body.durationSeconds,
    category: body.category,
    seasonal: body.seasonal,
    generateImageVariants: !!body.generateImageVariants,
  })

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
  const { ok: _skip, ...rest } = res
  return NextResponse.json({ ok: true, ...rest })
}
