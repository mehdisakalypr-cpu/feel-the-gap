/**
 * Image generation — cascade multi-provider 100% text-to-image.
 *
 * Cascade par défaut (priorité gratuit → qualité max) :
 *   1. Gemini 2.5 Flash Image ("nano-banana") — 4 clés rotation (GOOGLE_GENERATIVE_AI_API_KEY_{1..4})
 *   2. Cloudflare Flux (Workers AI, free 10k/day)
 *   3. Pollinations (totalement free, fallback)
 *   4. Replicate SDXL/Flux (payant, dernier recours)
 *
 * Retour : 4 variantes (1 par provider ou 4 seeds sur le primary), URL publique
 * après upload Supabase Storage.
 */

import { uploadToStorage } from './storage'
import { randomBytes } from 'node:crypto'

export interface ImageGenRequest {
  prompt: string
  negative?: string
  style?: 'photorealistic' | 'cinematic' | 'editorial' | 'studio' | 'natural-light'
  aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5'
  variants?: number               // par défaut 4
}

export interface ImageVariant {
  provider: string
  url: string
  seed?: string | number
}

export interface ImageGenResult {
  ok: boolean
  variants: ImageVariant[]
  error?: string
}

// ── Gemini 2.5 Flash Image (nano-banana) ─────────────────────────────────────
async function generateGemini(prompt: string, apiKey: string): Promise<{ ok: boolean; buf?: Buffer; error?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!res.ok) return { ok: false, error: `gemini ${res.status}: ${(await res.text()).slice(0, 200)}` }
    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      if (p.inlineData?.data) {
        return { ok: true, buf: Buffer.from(p.inlineData.data, 'base64') }
      }
    }
    return { ok: false, error: 'no image in gemini response' }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Cloudflare Flux Workers AI ───────────────────────────────────────────────
async function generateCfFlux(prompt: string): Promise<{ ok: boolean; buf?: Buffer; error?: string }> {
  const accountId = process.env.CF_ACCOUNT_ID
  const apiKey = process.env.CF_API_KEY
  if (!accountId || !apiKey) return { ok: false, error: 'CF credentials absent' }
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!res.ok) return { ok: false, error: `cf ${res.status}` }
    const data = await res.json()
    const b64 = data.result?.image
    if (!b64) return { ok: false, error: 'no image in cf response' }
    return { ok: true, buf: Buffer.from(b64, 'base64') }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Pollinations (fallback 100% free) ────────────────────────────────────────
async function generatePollinations(prompt: string, seed: number): Promise<{ ok: boolean; buf?: Buffer; error?: string }> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&nologo=true&seed=${seed}`
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `pollinations ${res.status}` }
    return { ok: true, buf: Buffer.from(await res.arrayBuffer()) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Prompt enrichi pour portraits avatar cohérents ───────────────────────────
function enrichPortraitPrompt(raw: string, style: string = 'photorealistic'): string {
  const styleHints: Record<string, string> = {
    photorealistic: 'Photorealistic portrait, studio lighting, 85mm lens, skin texture visible, sharp focus on face',
    cinematic: 'Cinematic portrait, natural light, shallow depth of field, 35mm film grain, warm golden hour',
    editorial: 'Editorial fashion portrait, soft rim light, high-end magazine quality',
    studio: 'Studio portrait, plain neutral background, 3-point lighting, professional headshot',
    'natural-light': 'Natural daylight portrait, authentic atmosphere, slight environmental context',
  }
  return `${raw}. ${styleHints[style] ?? styleHints.photorealistic}. Front-facing, neutral expression, full-body visible from chest up, consistent anchor features for video reference.`
}

// ── Main cascade ─────────────────────────────────────────────────────────────
export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const wantN = req.variants ?? 4
  const prompt = enrichPortraitPrompt(req.prompt, req.style)
  const variants: ImageVariant[] = []
  const errors: string[] = []

  const geminiKeys = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_2,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_3,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY_4,
  ].filter(Boolean) as string[]

  const uploadResult = async (buf: Buffer, provider: string): Promise<ImageVariant | null> => {
    const fname = `avatars/${Date.now()}-${randomBytes(4).toString('hex')}.png`
    const up = await uploadToStorage({ path: fname, data: buf, contentType: 'image/png' })
    if (up.ok && up.url) return { provider, url: up.url }
    errors.push(`${provider}/upload: ${up.error}`)
    return null
  }

  // 1. Try Gemini (4 keys rotation, one variant each)
  for (const key of geminiKeys) {
    if (variants.length >= wantN) break
    const r = await generateGemini(prompt, key)
    if (r.ok && r.buf) {
      const v = await uploadResult(r.buf, 'gemini-2.5-flash-image')
      if (v) variants.push(v)
    } else if (r.error) errors.push(`gemini: ${r.error}`)
  }

  // 2. Fallback CF Flux
  while (variants.length < wantN) {
    const r = await generateCfFlux(prompt)
    if (!r.ok || !r.buf) { errors.push(`cf: ${r.error}`); break }
    const v = await uploadResult(r.buf, 'cf-flux')
    if (v) variants.push(v)
  }

  // 3. Last-resort Pollinations (different seed each time)
  while (variants.length < wantN) {
    const seed = Math.floor(Math.random() * 1_000_000)
    const r = await generatePollinations(prompt, seed)
    if (!r.ok || !r.buf) { errors.push(`pollinations: ${r.error}`); break }
    const v = await uploadResult(r.buf, 'pollinations')
    if (v) { v.seed = seed; variants.push(v) }
  }

  if (variants.length === 0) {
    return { ok: false, variants: [], error: errors.join(' | ') || 'no provider succeeded' }
  }
  return { ok: true, variants }
}
