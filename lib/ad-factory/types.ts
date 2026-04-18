/**
 * FTG Ad Factory — types partagés
 */

export type SegmentKind = 'seedance-t2v' | 'seedance-i2v' | 'heygen-dialogue' | 'ffmpeg-text'

export interface SegmentSpec {
  index: number
  kind: SegmentKind
  duration_s: number
  prompt: string           // prompt Seedance ou texte pour ffmpeg
  reference_urls?: string[] // @image1, @image2 pour I2V
  dialogue?: Array<{ speaker: string; line: string; timing?: string }>
}

export interface BriefSchema {
  segments: SegmentSpec[]
  total_duration_s: number
  aspect_ratio: '16:9' | '9:16' | '1:1'
}

export interface Variant {
  id: string
  project_id: string
  lang: 'fr' | 'en' | 'de' | 'es' | 'ar' | 'pt' | 'zh' | 'ja' | 'it' | 'sw'
  vo_script: Record<string, string>   // {seg1: "...", seg2: "...", ...}
  hero_name?: string
  product?: string
  country_iso?: string
}

export interface RenderJob {
  id: string
  variant_id: string
  status: RenderStatus
  progress_pct: number
  segments: SegmentResult[]
  voice_url?: string
  final_mp4_url?: string
  duration_s?: number
  cost_eur?: number
  error?: string
}

export type RenderStatus =
  | 'queued' | 'ingesting' | 'seg1' | 'seg2' | 'seg3' | 'seg4'
  | 'voice' | 'mixing' | 'uploading' | 'completed' | 'failed'

export interface SegmentResult {
  index: number
  provider: SegmentKind
  status: 'pending' | 'running' | 'done' | 'failed'
  url?: string
  duration_s?: number
  cost_eur?: number
  error?: string
}

export interface ProviderConfig {
  seedance?: { apiKey: string; baseUrl: string; provider: 'replicate' | 'fal' | 'byteplus' }
  elevenlabs?: { apiKey: string; voiceId?: string }
  heygen?: { apiKey: string }
  googleDrive?: { serviceAccountJson?: string }
  storage: { bucket: string }
}

export function loadProviderConfig(): ProviderConfig {
  return {
    seedance: process.env.SEEDANCE_API_KEY ? {
      apiKey: process.env.SEEDANCE_API_KEY,
      baseUrl: process.env.SEEDANCE_BASE_URL || 'https://api.replicate.com/v1',
      provider: (process.env.SEEDANCE_PROVIDER as any) || 'replicate',
    } : undefined,
    elevenlabs: process.env.ELEVENLABS_API_KEY ? {
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID,
    } : undefined,
    heygen: process.env.HEYGEN_API_KEY ? { apiKey: process.env.HEYGEN_API_KEY } : undefined,
    googleDrive: process.env.GOOGLE_DRIVE_SA_JSON ? {
      serviceAccountJson: process.env.GOOGLE_DRIVE_SA_JSON,
    } : undefined,
    storage: { bucket: process.env.AD_FACTORY_BUCKET || 'ad-factory' },
  }
}
