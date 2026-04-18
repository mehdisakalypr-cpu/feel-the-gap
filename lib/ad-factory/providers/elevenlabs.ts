/**
 * ElevenLabs TTS — multi-lang voice-over.
 * Stub mode si ELEVENLABS_API_KEY absent.
 */

import { loadProviderConfig } from '../types'

export interface TTSRequest {
  text: string
  voiceId?: string          // si non fourni : voix par défaut config
  lang: string              // 'fr', 'en', ...
  modelId?: string          // 'eleven_multilingual_v2' par défaut
}

export interface TTSResult {
  ok: boolean
  audio_buffer?: Buffer
  duration_s?: number
  stub?: boolean
  error?: string
}

export async function generateVoiceOver(req: TTSRequest): Promise<TTSResult> {
  const cfg = loadProviderConfig()
  if (!cfg.elevenlabs) {
    console.log('[elevenlabs] STUB MODE — ELEVENLABS_API_KEY absent. Text:', req.text.slice(0, 80))
    return { ok: true, stub: true, duration_s: estimateDurationSec(req.text) }
  }

  const voiceId = req.voiceId || cfg.elevenlabs.voiceId || '21m00Tcm4TlvDq8ikWAM' // Rachel par défaut
  const modelId = req.modelId || 'eleven_multilingual_v2'

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': cfg.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: req.text,
        model_id: modelId,
        voice_settings: { stability: 0.45, similarity_boost: 0.75 },
      }),
    })
    if (!res.ok) return { ok: false, error: `elevenlabs ${res.status}: ${await res.text()}` }
    const buf = Buffer.from(await res.arrayBuffer())
    return { ok: true, audio_buffer: buf, duration_s: estimateDurationSec(req.text) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

function estimateDurationSec(text: string): number {
  // ~150 mots/min en français narration
  const words = text.trim().split(/\s+/).length
  return Math.ceil((words / 150) * 60)
}
