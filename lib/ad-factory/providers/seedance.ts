/**
 * Seedance provider — supports Replicate, fal.ai, BytePlus.
 * Stub mode si SEEDANCE_API_KEY absent (renvoie placeholder + TODO en log).
 */

import { loadProviderConfig } from '../types'

export interface SeedanceRequest {
  prompt: string
  mode: 't2v' | 'i2v'
  referenceUrls?: string[]   // @image1, @image2 pour I2V
  durationSeconds: number    // max 15
  aspectRatio: '16:9' | '9:16' | '1:1'
}

export interface SeedanceResult {
  ok: boolean
  mp4_url?: string
  duration_s?: number
  provider_job_id?: string
  cost_eur?: number
  stub?: boolean
  error?: string
}

const PLACEHOLDER_MP4 = 'https://feel-the-gap.vercel.app/placeholder/seedance-preview.mp4'

export async function generateSeedance(req: SeedanceRequest): Promise<SeedanceResult> {
  const cfg = loadProviderConfig()
  if (!cfg.seedance) {
    console.log('[seedance] STUB MODE — SEEDANCE_API_KEY absent. Prompt:', req.prompt.slice(0, 100))
    return { ok: true, stub: true, mp4_url: PLACEHOLDER_MP4, duration_s: req.durationSeconds, cost_eur: 0 }
  }

  const { apiKey, baseUrl, provider } = cfg.seedance

  // Replicate — modèle bytedance/seedance (à ajuster selon version officielle déployée)
  if (provider === 'replicate') {
    try {
      const create = await fetch(`${baseUrl}/predictions`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: process.env.SEEDANCE_MODEL_VERSION || 'bytedance/seedance-2:latest',
          input: {
            prompt: req.prompt,
            duration: req.durationSeconds,
            aspect_ratio: req.aspectRatio,
            ...(req.mode === 'i2v' && req.referenceUrls ? { reference_image: req.referenceUrls[0] } : {}),
          },
        }),
      })
      if (!create.ok) return { ok: false, error: `replicate ${create.status}: ${await create.text()}` }
      const pred = await create.json()
      const predictionId = pred.id

      // Poll
      for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 4000))
        const st = await fetch(`${baseUrl}/predictions/${predictionId}`, {
          headers: { 'Authorization': `Token ${apiKey}` },
        })
        const stData = await st.json()
        if (stData.status === 'succeeded') {
          const url = Array.isArray(stData.output) ? stData.output[0] : stData.output
          return { ok: true, mp4_url: url, duration_s: req.durationSeconds, provider_job_id: predictionId, cost_eur: 0.15 }
        }
        if (stData.status === 'failed' || stData.status === 'canceled') {
          return { ok: false, error: stData.error || 'seedance failed', provider_job_id: predictionId }
        }
      }
      return { ok: false, error: 'timeout 6min', provider_job_id: predictionId }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // fal.ai
  if (provider === 'fal') {
    try {
      const res = await fetch(`${baseUrl}/fal-ai/seedance-v2`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: req.prompt,
          duration: req.durationSeconds,
          aspect_ratio: req.aspectRatio,
          image_url: req.referenceUrls?.[0],
        }),
      })
      if (!res.ok) return { ok: false, error: `fal ${res.status}` }
      const data = await res.json()
      return { ok: true, mp4_url: data.video?.url, duration_s: req.durationSeconds, cost_eur: 0.12 }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  // BytePlus (officiel ByteDance) — à adapter selon doc Seedance
  return { ok: false, error: `provider ${provider} not yet wired — fallback to Replicate or fal` }
}
