// @ts-nocheck
/**
 * Feel The Gap — Video Scripts Generator
 *
 * Génère des scripts vidéo courtes (30-60s) pour chaque bénéfice par persona.
 * Chaque vidéo explique UN bénéfice clé en 30 secondes maximum.
 *
 * Format : Hook (5s) → Problème (10s) → Solution FTG (10s) → Preuve (5s) → CTA (5s)
 *
 * Usage :
 *   npx tsx agents/video-scripts-generator.ts                    # all personas × all benefits
 *   npx tsx agents/video-scripts-generator.ts --persona=entrepreneur
 *   npx tsx agents/video-scripts-generator.ts --lang=fr,en,es
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
}

const BENEFITS = {
  entrepreneur: [
    { id: 'find-markets', title: 'Find where to sell', hook: 'You have a product. But WHERE should you sell it?' },
    { id: 'ai-plans', title: 'AI business plans', hook: 'What if you could get a complete business plan in 30 seconds?' },
    { id: 'products-tension', title: '10,000 products in tension', hook: 'These products are imported at scale — the demand is PROVEN.' },
    { id: 'opportunity-farming', title: 'Opportunity Farming', hook: 'Describe your product. AI finds your customers worldwide.' },
    { id: 'market-studies', title: 'Country market studies', hook: '115 countries analyzed. Which one is YOUR goldmine?' },
  ],
  influenceur: [
    { id: 'products-promote', title: '10K products to promote', hook: 'Artisanal, terroir, cooperatives — products with SOUL.' },
    { id: 'high-commission', title: '70% commission', hook: 'Most platforms give you 5-10%. We give you 70%.' },
    { id: 'tracked-links', title: 'Tracked affiliate links', hook: 'Every click, every sale — you see it in real-time.' },
    { id: 'auto-payouts', title: 'Automatic payouts', hook: 'Sell on Monday. Get paid the following Monday. Automatically.' },
  ],
  financeur: [
    { id: 'vetted-deals', title: '500+ vetted deal flows', hook: 'Stop searching. Start evaluating.' },
    { id: 'sectors', title: '15 sectors covered', hook: 'Agrifood, fintech, energy, health — every sector that matters.' },
    { id: 'risk-ai', title: 'AI risk assessment', hook: 'Market data + production costs + logistics = risk score in seconds.' },
    { id: 'deal-rooms', title: 'Direct deal rooms', hook: 'Connect with entrepreneurs. Escrow ready. Close faster.' },
  ],
  investisseur: [
    { id: 'investment-opps', title: '500+ investment opportunities', hook: 'Seed to growth. €100K to €5M. Your next 10x.' },
    { id: 'emerging-markets', title: '30+ emerging markets', hook: 'Africa. LATAM. Southeast Asia. The future is here.' },
    { id: 'impact', title: 'Impact metrics', hook: 'Jobs created. Carbon saved. SDG alignment. Impact that counts.' },
    { id: 'portfolio', title: 'Portfolio construction', hook: 'Filter by sector, geography, stage, risk. Build your thesis.' },
  ],
}

async function generateScript(persona: string, benefit: typeof BENEFITS['entrepreneur'][0], lang: string): Promise<any> {
  const model = google('gemini-2.5-flash')

  const prompt = `You are a world-class video script writer for short-form content (Reels, Shorts, TikTok).

Write a 30-second video script for Feel The Gap (global trade intelligence SaaS platform).

Persona: ${persona}
Benefit: ${benefit.title}
Hook: "${benefit.hook}"
Language: Write ENTIRELY in ${LANG_NAMES[lang]}

Script format (EXACTLY 30 seconds when read aloud):

SCENE 1 — HOOK (0-5s):
[Visual direction] + [Text on screen] + [Voiceover]
Must stop the scroll. Provocative question or shocking stat.

SCENE 2 — PROBLEM (5-15s):
[Visual direction] + [Text on screen] + [Voiceover]
Paint the pain. Make them feel it.

SCENE 3 — SOLUTION (15-22s):
[Visual direction] + [Text on screen] + [Voiceover]
Show Feel The Gap solving this problem. Screen recording style.

SCENE 4 — PROOF (22-27s):
[Visual direction] + [Text on screen] + [Voiceover]
One powerful stat or testimonial.

SCENE 5 — CTA (27-30s):
[Visual direction] + [Text on screen] + [Voiceover]
"feelthegap.com — free to start"

Output VALID JSON only:
{
  "title": "Video title (${LANG_NAMES[lang]})",
  "hook": "The scroll-stopping first line",
  "scenes": [
    { "scene": 1, "duration": "0-5s", "visual": "...", "text_overlay": "...", "voiceover": "..." },
    { "scene": 2, "duration": "5-15s", "visual": "...", "text_overlay": "...", "voiceover": "..." },
    { "scene": 3, "duration": "15-22s", "visual": "...", "text_overlay": "...", "voiceover": "..." },
    { "scene": 4, "duration": "22-27s", "visual": "...", "text_overlay": "...", "voiceover": "..." },
    { "scene": 5, "duration": "27-30s", "visual": "...", "text_overlay": "...", "voiceover": "..." }
  ],
  "music_mood": "upbeat/dramatic/inspiring",
  "total_duration": "30s",
  "platforms": ["instagram_reels", "youtube_shorts", "tiktok"]
}

ALL text must be in ${LANG_NAMES[lang]}. Make it PUNCHY and EMOTIONAL.`

  const { text } = await generateText({ model, prompt, maxTokens: 2048, temperature: 0.8 })

  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch {
    return null
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Video Scripts Generator')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const personaFilter = args.find(a => a.startsWith('--persona='))?.split('=')[1] ?? null
  const langFilter = args.find(a => a.startsWith('--lang='))?.split('=')[1]?.split(',') ?? ['en', 'fr', 'es']

  const personas = personaFilter
    ? { [personaFilter]: (BENEFITS as any)[personaFilter] }
    : BENEFITS

  let total = 0

  for (const [persona, benefits] of Object.entries(personas)) {
    for (const benefit of benefits as any[]) {
      for (const lang of langFilter) {
        try {
          const script = await generateScript(persona, benefit, lang)
          if (!script) { console.error(`  ✗ ${persona}/${benefit.id}/${lang}: parse failed`); continue }

          // Store locally (video_scripts table may not exist)
          const dir = path.join(process.cwd(), 'data', 'video-scripts')
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(
            path.join(dir, `${persona}-${benefit.id}-${lang}.json`),
            JSON.stringify(script, null, 2)
          )

          total++
          console.log(`  ✓ [${total}] ${persona}/${benefit.id}/${lang}: "${script.hook?.slice(0, 50)}..."`)

          await new Promise(r => setTimeout(r, 1000))
        } catch (err: any) {
          console.error(`  ✗ ${persona}/${benefit.id}/${lang}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n═══ Generated ${total} video scripts ═══`)
}

if (process.argv[1]?.endsWith('video-scripts-generator.ts')) {
  main().catch(console.error)
}
