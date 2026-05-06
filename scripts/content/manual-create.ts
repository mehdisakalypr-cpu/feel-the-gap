/**
 * Entry point for `.github/workflows/content-manual-create.yml`.
 * Reads inputs from env vars, runs the relevant pipeline, writes
 * artifacts to dist/manual/<RUN_ID>/.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateImage } from '../../lib/ad-factory/providers/image-gen'

const RUN_ID = process.env.RUN_ID ?? `local-${Date.now()}`
const MODE = process.env.MODE ?? 'regenerate'
const PROMPT = process.env.PROMPT ?? ''
const ASSET_URL = process.env.ASSET_URL ?? ''
const PERSONA = process.env.PERSONA ?? 'entrepreneur'
const TARGET_SAAS = process.env.TARGET_SAAS ?? 'ftg'
const VARIANTS = Math.max(1, Math.min(5, parseInt(process.env.VARIANTS ?? '3', 10)))

const OUT_DIR = join(process.cwd(), 'dist', 'manual', RUN_ID)

interface ArtifactManifest {
  run_id: string
  mode: string
  inputs: {
    prompt: string
    asset_url: string
    persona: string
    target_saas: string
    variants: number
  }
  artifacts: Array<{ path: string; provider: string; url?: string; type: string }>
  generated_at: string
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const manifest: ArtifactManifest = {
    run_id: RUN_ID,
    mode: MODE,
    inputs: {
      prompt: PROMPT,
      asset_url: ASSET_URL,
      persona: PERSONA,
      target_saas: TARGET_SAAS,
      variants: VARIANTS,
    },
    artifacts: [],
    generated_at: new Date().toISOString(),
  }

  const composed = composePromptForMode(MODE, PROMPT, PERSONA, TARGET_SAAS)
  console.log(`[manual-create] mode=${MODE} variants=${VARIANTS} saas=${TARGET_SAAS}`)
  console.log(`[manual-create] composed prompt: ${composed.slice(0, 160)}...`)

  switch (MODE) {
    case 'regenerate':
    case 'modify-prompt':
    case 'theme-variants': {
      const result = await generateImage({
        prompt: composed,
        style: 'photorealistic',
        aspectRatio: '9:16',
        variants: VARIANTS,
      })
      if (!result.ok) {
        console.error(`[manual-create] generateImage failed: ${result.error}`)
      }
      for (const v of result.variants) {
        manifest.artifacts.push({
          path: `${v.provider}-${v.url.split('/').pop()}`,
          provider: v.provider,
          url: v.url,
          type: 'image',
        })
      }
      break
    }
    case 'image-remix': {
      console.log('[manual-create] image-remix uses ASSET_URL as ref; pipeline TBD with InstantID/PuLID')
      manifest.artifacts.push({
        path: `placeholder-image-remix.txt`,
        provider: 'pending',
        type: 'placeholder',
      })
      break
    }
    case 'video-animate': {
      console.log('[manual-create] video-animate uses ASSET_URL → Pollinations video proxy')
      manifest.artifacts.push({
        path: `placeholder-video-animate.txt`,
        provider: 'pending',
        type: 'placeholder',
      })
      break
    }
    default:
      console.error(`[manual-create] unknown mode ${MODE}`)
  }

  const manifestPath = join(OUT_DIR, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`[manual-create] wrote ${manifestPath} with ${manifest.artifacts.length} artifacts`)
}

function composePromptForMode(mode: string, raw: string, persona: string, saas: string): string {
  const personaHints: Record<string, string> = {
    entrepreneur: 'A 34yo French entrepreneur, narrow oval face, defined jawline, hazel green eyes, short side-parted dark brown hair, light beard stubble',
    influenceur: 'A 28yo charismatic influencer, expressive face, warm brown eyes, styled wavy hair, confident smile',
    investisseur: 'A 45yo investor in tailored suit, salt-and-pepper hair, rectangular glasses, calm assertive look',
    financeur: 'A 50yo banker in dark navy suit, neatly combed grey hair, professional warm expression',
  }
  const saasHints: Record<string, string> = {
    ftg: 'in front of a world map with trade flow lines',
    ofa: 'in a modern startup office showing site mockups on screens',
    estate: 'in an upscale boutique hotel lobby',
    aici: 'in a tech operations center with monitoring dashboards',
    aiplb: 'in a legal/compliance office with documents and screens',
    ancf: 'in a clean modern fintech workspace',
    hub: 'in a sleek SaaS portfolio cockpit',
  }
  const personaPart = personaHints[persona] ?? `A ${persona} persona`
  const saasPart = saasHints[saas] ?? ''
  return `${personaPart} ${saasPart}. ${raw}. Cinematic 9:16 vertical, natural daylight, subtle brand cohesion. Mode: ${mode}.`
}

main().catch(err => {
  console.error('[manual-create] fatal:', err)
  process.exit(1)
})
