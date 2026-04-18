import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/ad-factory/providers/image-gen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST /api/admin/ad-factory/avatars/generate
 * Body: { prompt, style?, variants? }
 * → renvoie 4 URLs previews. User picke ensuite et POST /avatars pour sauver.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const prompt = String(body.prompt ?? '').trim()
  if (prompt.length < 10) return NextResponse.json({ error: 'prompt too short' }, { status: 400 })

  const res = await generateImage({
    prompt,
    style: body.style,
    variants: Math.min(Math.max(1, Number(body.variants ?? 4)), 8),
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })

  return NextResponse.json({ ok: true, variants: res.variants })
}
