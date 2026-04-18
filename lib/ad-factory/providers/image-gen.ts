/**
 * Image generation — cascade multi-provider 100% text-to-image.
 *
 * Cascade par défaut (priorité gratuit → qualité max) :
 *   1. Gemini 2.5 Flash Image ("nano-banana") — jusqu'à 4 clés en parallèle
 *   2. Cloudflare Flux (Workers AI, free 10k/day)
 *   3. Pollinations (totalement free, fallback)
 */

import { uploadToStorage } from './storage'
import { randomBytes } from 'node:crypto'

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'

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
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!res.ok) {
      const bodyTxt = (await res.text()).slice(0, 300)
      return { ok: false, error: `gemini ${GEMINI_MODEL} ${res.status}: ${bodyTxt}` }
    }
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

  // 1. Gemini — jusqu'à N clés en parallèle (une variante par clé)
  if (geminiKeys.length > 0) {
    const n = Math.min(wantN, geminiKeys.length)
    const genResults = await Promise.all(geminiKeys.slice(0, n).map(k => generateGemini(prompt, k)))
    const uploads = await Promise.all(
      genResults.map(r => (r.ok && r.buf) ? uploadResult(r.buf, `gemini:${GEMINI_MODEL}`) : null)
    )
    for (let i = 0; i < genResults.length; i++) {
      const r = genResults[i]
      const v = uploads[i]
      if (v) variants.push(v)
      else if (r.error) errors.push(r.error)
    }
  }

  // 2. Fallback CF Flux (en parallèle pour combler)
  if (variants.length < wantN && process.env.CF_ACCOUNT_ID && process.env.CF_API_KEY) {
    const need = wantN - variants.length
    const cfResults = await Promise.all(Array.from({ length: need }, () => generateCfFlux(prompt)))
    const uploads = await Promise.all(
      cfResults.map(r => (r.ok && r.buf) ? uploadResult(r.buf, 'cf-flux') : null)
    )
    for (let i = 0; i < cfResults.length; i++) {
      const v = uploads[i]
      if (v) variants.push(v)
      else if (cfResults[i].error) errors.push(`cf: ${cfResults[i].error}`)
    }
  }

  // 3. Last-resort Pollinations (parallèle, seeds différents)
  if (variants.length < wantN) {
    const need = wantN - variants.length
    const seeds = Array.from({ length: need }, () => Math.floor(Math.random() * 1_000_000))
    const pResults = await Promise.all(seeds.map(s => generatePollinations(prompt, s)))
    const uploads = await Promise.all(
      pResults.map(r => (r.ok && r.buf) ? uploadResult(r.buf, 'pollinations') : null)
    )
    for (let i = 0; i < pResults.length; i++) {
      const v = uploads[i]
      if (v) { v.seed = seeds[i]; variants.push(v) }
      else if (pResults[i].error) errors.push(`pollinations: ${pResults[i].error}`)
    }
  }

  if (variants.length === 0) {
    return { ok: false, variants: [], error: errors.join(' | ') || 'no provider succeeded' }
  }
  return { ok: true, variants }
}
