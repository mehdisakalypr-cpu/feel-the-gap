/**
 * HeyGen — lip-sync avatar (optionnel, meilleur qualité que Seedance pour dialogue long).
 * Stub mode si HEYGEN_API_KEY absent.
 */

import { loadProviderConfig } from '../types'

export interface HeyGenRequest {
  avatarId: string           // ID avatar HeyGen (stock ou custom)
  voiceId: string            // ID voix ElevenLabs ou HeyGen native
  script: string             // texte à prononcer
  aspectRatio: '16:9' | '9:16' | '1:1'
}

export interface HeyGenResult {
  ok: boolean
  mp4_url?: string
  duration_s?: number
  provider_job_id?: string
  stub?: boolean
  error?: string
}

export async function generateHeyGen(req: HeyGenRequest): Promise<HeyGenResult> {
  const cfg = loadProviderConfig()
  if (!cfg.heygen) {
    console.log('[heygen] STUB MODE — HEYGEN_API_KEY absent. Script:', req.script.slice(0, 80))
    return { ok: true, stub: true, duration_s: Math.ceil(req.script.split(/\s+/).length / 150 * 60), cost_eur: 0 } as HeyGenResult & { cost_eur: number }
  }

  try {
    const create = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'X-Api-Key': cfg.heygen.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: 'avatar', avatar_id: req.avatarId },
          voice: { type: 'text', input_text: req.script, voice_id: req.voiceId },
        }],
        dimension: req.aspectRatio === '9:16' ? { width: 720, height: 1280 } : { width: 1280, height: 720 },
      }),
    })
    if (!create.ok) return { ok: false, error: `heygen create ${create.status}` }
    const pred = await create.json()
    const videoId = pred.data?.video_id
    if (!videoId) return { ok: false, error: 'no video_id' }

    // Poll
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const st = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { 'X-Api-Key': cfg.heygen.apiKey },
      })
      const data = await st.json()
      if (data.data?.status === 'completed') {
        return { ok: true, mp4_url: data.data.video_url, duration_s: data.data.duration, provider_job_id: videoId }
      }
      if (data.data?.status === 'failed') return { ok: false, error: data.data.error || 'heygen failed' }
    }
    return { ok: false, error: 'timeout 5min', provider_job_id: videoId }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
