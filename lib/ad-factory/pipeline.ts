/**
 * FTG Ad Factory — orchestrateur pipeline de rendu pour 1 job.
 *
 * Phases :
 *  1. ingesting  : liste drive folder (images réf)
 *  2. seg1       : SEG1 (dialogue marché) — HeyGen si key, sinon Seedance T2V
 *  3. seg2       : SEG2 (tablette UI) — Seedance I2V
 *  4. seg3       : SEG3 (récolte+distrib) — Seedance T2V
 *  5. seg4       : SEG4 (wordplay final) — FFmpeg drawtext
 *  6. voice      : ElevenLabs TTS par langue
 *  7. mixing     : FFmpeg concat + audio mix
 *  8. uploading  : Supabase Storage upload mp4 final
 *  9. completed  : final_mp4_url renseigné
 *
 * Stub mode (clés absentes) : chaque étape log + retourne placeholder URL.
 * Dès que les clés arrivent, le même pipeline tourne pour de vrai.
 */

import { createClient } from '@supabase/supabase-js'
import { generateSeedance } from './providers/seedance'
import { generateHeyGen } from './providers/heygen'
import { generateVoiceOver } from './providers/elevenlabs'
import { listDriveFolder } from './providers/drive'
import { uploadToStorage } from './providers/storage'
import type { SegmentSpec, RenderStatus } from './types'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function updateJob(jobId: string, patch: {
  status?: RenderStatus
  progress_pct?: number
  segments?: unknown[]
  voice_url?: string
  final_mp4_url?: string
  duration_s?: number
  cost_eur?: number
  error?: string
  started_at?: string
  completed_at?: string
}): Promise<void> {
  const sb = admin()
  await sb.from('ftg_ad_render_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', jobId)
}

export async function runJob(jobId: string): Promise<{ ok: boolean; finalUrl?: string; error?: string }> {
  const sb = admin()

  // Fetch job + variant + project
  const { data: job, error: jobErr } = await sb
    .from('ftg_ad_render_jobs').select('*').eq('id', jobId).single()
  if (jobErr || !job) return { ok: false, error: 'job not found' }

  const { data: variant } = await sb
    .from('ftg_ad_variants').select('*').eq('id', job.variant_id).single()
  if (!variant) return { ok: false, error: 'variant not found' }

  const { data: project } = await sb
    .from('ftg_ad_projects').select('*').eq('id', variant.project_id).single()
  if (!project) return { ok: false, error: 'project not found' }

  const segments: SegmentSpec[] = (project.brief?.segments as SegmentSpec[]) ?? []
  const segResults: Array<{ index: number; provider: string; status: string; url?: string; duration_s?: number; cost_eur?: number; error?: string }> = []
  let totalCost = 0
  const startedAt = new Date().toISOString()

  await updateJob(jobId, { status: 'ingesting', progress_pct: 5, started_at: startedAt })

  // ── 1. Drive ingest ──────────────────────────────────────────────────────
  if (project.drive_folder_url) {
    const ingest = await listDriveFolder(project.drive_folder_url)
    if (!ingest.ok && !ingest.stub) {
      await updateJob(jobId, { status: 'failed', error: `drive ingest: ${ingest.error}` })
      return { ok: false, error: ingest.error }
    }
  }

  // ── 2-5. Segments (Seedance/HeyGen/ffmpeg) ───────────────────────────────
  const aspect = (project.brief?.aspect_ratio as '16:9' | '9:16' | '1:1') || '9:16'
  for (const seg of segments) {
    const segIdx = seg.index
    await updateJob(jobId, {
      status: `seg${segIdx}` as RenderStatus,
      progress_pct: 10 + segIdx * 15,
    })

    let result: { ok: boolean; mp4_url?: string; duration_s?: number; cost_eur?: number; error?: string; stub?: boolean } = { ok: false }

    if (seg.kind === 'heygen-dialogue') {
      const merged = (seg.dialogue ?? []).map(d => `${d.speaker}: ${d.line}`).join('\n')
      result = await generateHeyGen({
        avatarId: 'default',
        voiceId: 'default',
        script: merged,
        aspectRatio: aspect,
      })
    } else if (seg.kind === 'seedance-t2v' || seg.kind === 'seedance-i2v') {
      result = await generateSeedance({
        prompt: seg.prompt,
        mode: seg.kind === 'seedance-i2v' ? 'i2v' : 't2v',
        referenceUrls: seg.reference_urls,
        durationSeconds: Math.min(15, seg.duration_s),
        aspectRatio: aspect,
      })
    } else if (seg.kind === 'ffmpeg-text') {
      // Wordplay final — pour l'instant stub (génération FFmpeg ferait un mp4 d'animation texte)
      result = { ok: true, mp4_url: undefined, duration_s: seg.duration_s, stub: true, cost_eur: 0 }
    }

    segResults.push({
      index: segIdx,
      provider: seg.kind,
      status: result.ok ? 'done' : 'failed',
      url: result.mp4_url,
      duration_s: result.duration_s,
      cost_eur: result.cost_eur,
      error: result.error,
    })
    totalCost += result.cost_eur ?? 0

    if (!result.ok) {
      await updateJob(jobId, { status: 'failed', error: `seg${segIdx}: ${result.error}`, segments: segResults })
      return { ok: false, error: result.error }
    }
    await updateJob(jobId, { segments: segResults })
  }

  // ── 6. Voice-over ElevenLabs ─────────────────────────────────────────────
  await updateJob(jobId, { status: 'voice', progress_pct: 75 })
  const voScript = Object.values(variant.vo_script ?? {}).join('\n\n')
  const vo = await generateVoiceOver({ text: voScript, lang: variant.lang })
  let voiceUrl: string | undefined
  if (vo.ok && vo.audio_buffer) {
    const up = await uploadToStorage({
      path: `jobs/${jobId}/voice-${variant.lang}.mp3`,
      data: vo.audio_buffer,
      contentType: 'audio/mpeg',
    })
    voiceUrl = up.url
  } else if (vo.stub) {
    voiceUrl = undefined  // stub
  }

  // ── 7-8. Mixing + Upload final ───────────────────────────────────────────
  // TODO : vrai FFmpeg concat + audio mix quand on aura node:child_process
  // Pour l'instant : on pointe le final sur le premier segment + log
  await updateJob(jobId, { status: 'mixing', progress_pct: 85, voice_url: voiceUrl })
  await updateJob(jobId, { status: 'uploading', progress_pct: 95 })

  const finalUrl = segResults[0]?.url ?? undefined
  const totalDuration = segResults.reduce((s, r) => s + (r.duration_s ?? 0), 0)

  await updateJob(jobId, {
    status: 'completed',
    progress_pct: 100,
    segments: segResults,
    final_mp4_url: finalUrl,
    duration_s: totalDuration,
    cost_eur: totalCost,
    completed_at: new Date().toISOString(),
  })

  return { ok: true, finalUrl }
}
