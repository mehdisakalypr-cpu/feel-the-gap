/**
 * Scene generator — image de fond (scène) + animation optionnelle.
 *
 * 2 modes :
 *  - from-prompt : texte → image (nano-banana cascade) → (optionnel) animation Seedance I2V
 *  - from-image  : URL image existante (site client OFA ou Drive) → animation Seedance I2V
 *
 * Bibliothèque centralisée ftg_ad_scenes réutilisable cross-projets
 * (OFA hero upgrader, FTG ad factory, Estate hotel showcase).
 */

import { generateImage } from './image-gen'
import { generateSeedance } from './seedance'
import { uploadToStorage, downloadUrl } from './storage'
import { randomBytes } from 'node:crypto'

export interface SceneRequest {
  name: string
  prompt?: string                       // pour from-prompt
  sourceImageUrl?: string               // pour from-image
  motionPrompt: string                  // ce qu'on demande à Seedance (ex: "subtle breeze, leaves swaying")
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5'
  durationSeconds?: number              // clip 5-15s
  category?: string                     // restaurant, hotel, plantation, market...
  seasonal?: 'spring' | 'summer' | 'fall' | 'winter'
  generateImageVariants?: boolean       // si true et from-prompt, retourne 4 previews image AVANT animation
}

export interface SceneResult {
  ok: boolean
  imageUrl?: string
  imageVariants?: Array<{ provider: string; url: string }>
  animatedMp4Url?: string
  duration_s?: number
  cost_eur?: number
  error?: string
}

export async function generateScene(req: SceneRequest): Promise<SceneResult> {
  let imageUrl = req.sourceImageUrl
  let imageVariants: Array<{ provider: string; url: string }> | undefined
  let totalCost = 0

  // 1. Image de base
  if (!imageUrl && req.prompt) {
    const imgRes = await generateImage({
      prompt: req.prompt,
      variants: req.generateImageVariants ? 4 : 1,
      style: 'cinematic',
    })
    if (!imgRes.ok || imgRes.variants.length === 0) {
      return { ok: false, error: `image gen: ${imgRes.error ?? 'no variants'}` }
    }
    imageUrl = imgRes.variants[0].url
    if (req.generateImageVariants) {
      imageVariants = imgRes.variants
      // Returns early : user picke d'abord une preview via UI, puis on appellera generateScene à nouveau avec sourceImageUrl
      return { ok: true, imageVariants, imageUrl }
    }
    totalCost += 0.002
  }

  if (!imageUrl) return { ok: false, error: 'neither sourceImageUrl nor prompt provided' }

  // 2. Si re-ingestion nécessaire (source Drive ou externe), re-upload to our storage pour stabilité URL
  if (!imageUrl.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '___never___')) {
    try {
      const buf = await downloadUrl(imageUrl)
      const path = `scenes/source-${Date.now()}-${randomBytes(4).toString('hex')}.png`
      const up = await uploadToStorage({ path, data: buf, contentType: 'image/png' })
      if (up.ok && up.url) imageUrl = up.url
    } catch (err) {
      console.warn('[scene-gen] re-upload failed, using original URL:', err)
    }
  }

  // 3. Animation Seedance I2V
  const duration = Math.min(15, req.durationSeconds ?? 8)
  const aspect = req.aspectRatio ?? '9:16'
  const seedance = await generateSeedance({
    prompt: req.motionPrompt,
    mode: 'i2v',
    referenceUrls: [imageUrl],
    durationSeconds: duration,
    aspectRatio: aspect,
  })

  if (!seedance.ok) return { ok: false, imageUrl, error: `seedance: ${seedance.error}` }
  totalCost += seedance.cost_eur ?? 0

  return {
    ok: true,
    imageUrl,
    animatedMp4Url: seedance.mp4_url,
    duration_s: duration,
    cost_eur: totalCost,
  }
}

/**
 * Variation saisonnière d'une scène existante.
 * Utilise Gemini edit mode (image + instruction) → nouvelle image saisonnière
 * → Seedance I2V anime. Parent scene_id tracké pour lineage.
 */
export async function generateSeasonalVariant(args: {
  parentSceneImageUrl: string
  season: 'spring' | 'summer' | 'fall' | 'winter'
  motionPrompt: string
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5'
  durationSeconds?: number
}): Promise<SceneResult> {
  const seasonHints: Record<string, string> = {
    spring: 'Same scene but springtime — cherry blossoms, fresh greens, soft morning light, gentle rain moisture',
    summer: 'Same scene but high summer — golden sunlight, dry heat, vibrant saturated colors, lazy shadows',
    fall: 'Same scene but autumn — orange/red foliage, soft diffuse light, cool atmosphere, few fallen leaves',
    winter: 'Same scene but winter — snow dusting OR cold overcast light depending on climate, muted palette',
  }

  return generateScene({
    name: `seasonal-${args.season}`,
    sourceImageUrl: args.parentSceneImageUrl,    // Gemini edit mode accepté en passant l'image
    prompt: seasonHints[args.season],             // mais on pourrait aussi skipper si edit mode non dispo
    motionPrompt: args.motionPrompt,
    aspectRatio: args.aspectRatio,
    durationSeconds: args.durationSeconds,
    seasonal: args.season,
  })
}
