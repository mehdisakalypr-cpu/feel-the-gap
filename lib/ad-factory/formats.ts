/**
 * Format Factory — FFmpeg adapters multi-format depuis 1 master mp4.
 * Réutilisable cross-projects (OFA hero, FTG ads, Estate, Shift).
 *
 * Stub mode si ffmpeg binaire non trouvé : retourne URL master + log TODO.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { uploadToStorage } from './providers/storage'

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'
export type FormatOutput = { aspect: AspectRatio; resolution: string; url: string; fileSizeBytes?: number; durationS?: number }

const RES: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
}

async function ffmpegAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const p = spawn('ffmpeg', ['-version'])
    p.on('error', () => resolve(false))
    p.on('exit', code => resolve(code === 0))
  })
}

function runFfmpeg(args: string[]): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const p = spawn('ffmpeg', args)
    let stderr = ''
    p.stderr.on('data', d => { stderr += d.toString() })
    p.on('close', code => {
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, error: stderr.slice(-400) })
    })
    p.on('error', err => resolve({ ok: false, error: err.message }))
  })
}

/**
 * Convertit 1 master mp4 en N formats avec smart crop centré.
 * Le crop utilise le filtre FFmpeg `crop` + `scale` en cascade pour respecter la safe zone.
 */
export async function convertToFormats(
  masterUrl: string,
  targetAspects: AspectRatio[],
  jobId: string,
): Promise<FormatOutput[]> {
  const outputs: FormatOutput[] = []

  const ffOk = await ffmpegAvailable()
  if (!ffOk) {
    console.log('[formats] STUB MODE — ffmpeg not installed. Master URL:', masterUrl)
    // En stub, on renvoie juste le master pour chaque aspect (TODO : ffmpeg local)
    for (const aspect of targetAspects) {
      outputs.push({ aspect, resolution: `${RES[aspect].w}x${RES[aspect].h}`, url: masterUrl })
    }
    return outputs
  }

  // Download master to temp
  const tmp = `/tmp/adfac-${jobId}`
  await fs.mkdir(tmp, { recursive: true })
  const masterPath = path.join(tmp, 'master.mp4')
  const res = await fetch(masterUrl)
  if (!res.ok) throw new Error(`download master ${res.status}`)
  await fs.writeFile(masterPath, Buffer.from(await res.arrayBuffer()))

  for (const aspect of targetAspects) {
    const { w, h } = RES[aspect]
    const outPath = path.join(tmp, `out-${aspect.replace(':', 'x')}.mp4`)

    // Smart crop : scale jusqu'à couvrir la cible puis crop centré
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`

    const ff = await runFfmpeg([
      '-y', '-i', masterPath,
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outPath,
    ])
    if (!ff.ok) {
      console.error(`[formats] ffmpeg failed for ${aspect}:`, ff.error?.slice(-200))
      continue
    }

    const buf = await fs.readFile(outPath)
    const storagePath = `jobs/${jobId}/formats/${aspect.replace(':', 'x')}.mp4`
    const up = await uploadToStorage({ path: storagePath, data: buf, contentType: 'video/mp4' })
    if (up.ok && up.url) {
      outputs.push({ aspect, resolution: `${w}x${h}`, url: up.url, fileSizeBytes: buf.length })
    }
  }

  // Cleanup
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})

  return outputs
}

/**
 * Extrait une thumbnail poster JPG à 1s du master.
 */
export async function extractPoster(masterUrl: string, jobId: string): Promise<string | null> {
  const ffOk = await ffmpegAvailable()
  if (!ffOk) return null

  const tmp = `/tmp/adfac-${jobId}`
  await fs.mkdir(tmp, { recursive: true })
  const masterPath = path.join(tmp, 'master.mp4')
  const res = await fetch(masterUrl)
  if (!res.ok) return null
  await fs.writeFile(masterPath, Buffer.from(await res.arrayBuffer()))

  const outPath = path.join(tmp, 'poster.jpg')
  const ff = await runFfmpeg(['-y', '-i', masterPath, '-ss', '1', '-vframes', '1', '-q:v', '2', outPath])
  if (!ff.ok) return null

  const buf = await fs.readFile(outPath)
  const up = await uploadToStorage({ path: `jobs/${jobId}/formats/poster.jpg`, data: buf, contentType: 'image/jpeg' })
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
  return up.ok ? up.url ?? null : null
}
