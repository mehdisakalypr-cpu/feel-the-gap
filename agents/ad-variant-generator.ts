// @ts-nocheck
/**
 * Feel The Gap — Ad Variant Generator
 *
 * Prend une vidéo source (URL ou fichier local) et produit automatiquement
 * les variantes multi-format pour les réseaux sociaux, via FFmpeg.
 *
 * Ratios cibles :
 *   - 9:16  → Instagram Reels / Stories, TikTok, YouTube Shorts
 *   - 1:1   → Instagram Feed
 *   - 16:9  → YouTube classique, LinkedIn, Twitter
 *   - 4:5   → Instagram Feed (variante portrait)
 *
 * Stratégie : crop intelligent centré (blur background si upscale nécessaire),
 * préserve l'audio, output H.264 + AAC compatible toutes plateformes.
 *
 * Usage CLI :
 *   npx tsx agents/ad-variant-generator.ts --input /tmp/source.mp4 --outdir /tmp/out
 *   npx tsx agents/ad-variant-generator.ts --variant-id <uuid>   # mode worker Supabase
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawn } from 'child_process'

// ─── Ratio configs ──────────────────────────────────────────────────────────

export type AdRatio = '9:16' | '1:1' | '16:9' | '4:5'

interface RatioSpec {
  ratio: AdRatio
  width: number
  height: number
  label: string
}

export const RATIO_SPECS: Record<AdRatio, RatioSpec> = {
  '9:16': { ratio: '9:16', width: 1080, height: 1920, label: 'Reels / Stories / Shorts / TikTok' },
  '1:1':  { ratio: '1:1',  width: 1080, height: 1080, label: 'Instagram Feed' },
  '16:9': { ratio: '16:9', width: 1920, height: 1080, label: 'YouTube / LinkedIn / Twitter' },
  '4:5':  { ratio: '4:5',  width: 1080, height: 1350, label: 'Instagram Feed (portrait)' },
}

// ─── FFmpeg helpers ─────────────────────────────────────────────────────────

/**
 * Runs ffmpeg with the given args, collecting stderr for error reporting.
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const err: string[] = []
    ff.stderr.on('data', (chunk) => err.push(chunk.toString()))
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${err.join('').slice(-800)}`))
    })
  })
}

/**
 * Probes a video for width/height/duration via ffprobe.
 */
export async function probeVideo(filePath: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      filePath,
    ]
    const ff = spawn('ffprobe', args)
    let out = ''
    ff.stdout.on('data', (d) => { out += d.toString() })
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}`))
      try {
        const parsed = JSON.parse(out)
        resolve({
          width: parsed.streams[0].width,
          height: parsed.streams[0].height,
          duration: Number(parsed.format.duration),
        })
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${(e as Error).message}`))
      }
    })
  })
}

/**
 * Generates a single ratio variant of a source video.
 *
 * Technique : compute target w/h, use scale+crop filter to preserve aspect with
 * intelligent center-crop. For extreme ratio changes (e.g. 16:9 → 9:16), we
 * add a blurred background of the source behind the centered foreground.
 *
 * Filter pipeline :
 *   [0:v]split=2[bg][fg]
 *   [bg]scale=W:H:force_original_aspect_ratio=increase,crop=W:H,boxblur=20[bg]
 *   [fg]scale=W:H:force_original_aspect_ratio=decrease[fg]
 *   [bg][fg]overlay=(W-w)/2:(H-h)/2[out]
 */
export async function generateVariant(
  input: string,
  output: string,
  ratio: AdRatio,
): Promise<void> {
  const spec = RATIO_SPECS[ratio]
  const w = spec.width
  const h = spec.height

  const filter = [
    `[0:v]split=2[bg][fg]`,
    `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=25[bg]`,
    `[fg]scale='min(${w},iw)':'min(${h},ih)':force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`,
  ].join(';')

  const args = [
    '-y',
    '-i', input,
    '-filter_complex', filter,
    '-map', '[v]',
    '-map', '0:a?',             // map audio if present
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'main',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    output,
  ]

  await runFfmpeg(args)
}

// ─── High-level API ─────────────────────────────────────────────────────────

/**
 * Downloads a remote video to a temp file if needed, then generates all
 * specified variants. Returns an array of { ratio, path, width, height, duration, size }.
 */
export async function generateAllVariants(
  source: string,
  outdir: string,
  ratios: AdRatio[] = ['9:16', '1:1', '16:9', '4:5'],
): Promise<Array<{
  ratio: AdRatio
  path: string
  width: number
  height: number
  duration: number
  file_size_bytes: number
}>> {
  await fs.promises.mkdir(outdir, { recursive: true })

  // Resolve input: either local file or URL to download
  let inputPath = source
  if (/^https?:\/\//.test(source)) {
    inputPath = path.join(os.tmpdir(), `ftg-source-${Date.now()}.mp4`)
    console.log(`[ad-variant] downloading ${source} → ${inputPath}`)
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await fs.promises.writeFile(inputPath, buf)
  }

  const sourceInfo = await probeVideo(inputPath)
  console.log(`[ad-variant] source: ${sourceInfo.width}×${sourceInfo.height}, ${sourceInfo.duration.toFixed(1)}s`)

  const results: Array<{
    ratio: AdRatio
    path: string
    width: number
    height: number
    duration: number
    file_size_bytes: number
  }> = []

  for (const ratio of ratios) {
    const spec = RATIO_SPECS[ratio]
    const outPath = path.join(outdir, `${spec.ratio.replace(':', 'x')}.mp4`)
    console.log(`[ad-variant] ${ratio} (${spec.width}×${spec.height}) → ${outPath}`)
    const t0 = Date.now()
    try {
      await generateVariant(inputPath, outPath, ratio)
      const stat = await fs.promises.stat(outPath)
      results.push({
        ratio,
        path: outPath,
        width: spec.width,
        height: spec.height,
        duration: sourceInfo.duration,
        file_size_bytes: stat.size,
      })
      console.log(`  ✓ ${((Date.now() - t0) / 1000).toFixed(1)}s, ${(stat.size / 1024 / 1024).toFixed(1)} MB`)
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`)
    }
  }

  return results
}

// ─── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }

  const input = getArg('--input')
  const outdir = getArg('--outdir') ?? path.join(os.tmpdir(), 'ftg-ad-variants')

  if (!input) {
    console.error('Usage: npx tsx agents/ad-variant-generator.ts --input <video> [--outdir <dir>]')
    process.exit(1)
  }

  console.log(`[ad-variant-generator] input=${input} outdir=${outdir}`)
  const results = await generateAllVariants(input, outdir)
  console.log(`\n━━━ Generated ${results.length} variants ━━━`)
  for (const r of results) {
    console.log(`  ${r.ratio}: ${r.path}`)
  }
}

if (process.argv[1]?.endsWith('ad-variant-generator.ts')) {
  main().catch((err) => {
    console.error('[ad-variant-generator] Fatal:', err)
    process.exit(1)
  })
}
