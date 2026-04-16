/**
 * crop-curriculum-builder.ts
 *
 * For every crop_tutorial_modes row with 0 steps, generates 12 steps + 5 quiz
 * questions via Gemini 2.5 Flash (fallback Groq llama-3.3-70b).
 *
 * Usage:  npx tsx agents/crop-curriculum-builder.ts
 *
 * Idempotent: safe to re-run, skips modes that already have steps.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { z } from 'zod'

const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').split(',').filter(Boolean)
let keyIdx = 0
function nextGeminiKey() {
  const k = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length]
  keyIdx++
  return k
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const StepSchema = z.object({
  title: z.string().describe('Titre court du step (5-10 mots)'),
  text_md: z.string().describe('Contenu complet markdown, 200-400 mots, gestes pratiques + timing'),
  duration_minutes: z.number().int().min(3).max(30),
  video_keywords: z.string().describe('Mots-clés YouTube pour trouver une démo (FR ou EN)'),
})

const QuizSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).length(4),
  correct_idx: z.number().int().min(0).max(3),
  explanation: z.string(),
})

const CurriculumSchema = z.object({
  yield_kg_ha: z.number().describe('Rendement typique kg/ha (fourchette basse)'),
  cost_eur_ha: z.number().describe('Coût de production €/ha'),
  roi_pct: z.number().describe('ROI % après 1 cycle'),
  water_need_m3_ha: z.number().describe('Besoin en eau m³/ha'),
  description_md: z.string().describe('Intro 100 mots du mode (terrain/serre) pour ce crop'),
  steps: z.array(StepSchema).length(12).describe('12 steps chronologiques, du sol à la récolte'),
  quizzes: z.array(QuizSchema).length(5),
})

function extractJson(raw: string): unknown {
  // Strip code fences and trailing text
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function generate(crop: string, mode: 'terrain' | 'serre') {
  const prompt = `Tu es un ingénieur agronome expert. Génère un curriculum pédagogique COMPLET pour la culture du ${crop} en mode ${mode === 'terrain' ? 'plein champ naturel (non-irrigué prioritaire, sol)' : 'serre (hydroponique ou en terre protégée)'}.

CONTRAINTES :
- 12 steps chronologiques du préparatif à la récolte
- Chaque step : titre + texte markdown 200-400 mots + durée + mots-clés vidéo YouTube
- 5 questions de quiz avec 4 choix chacune (pour valider compréhension)
- Contexte : agriculteur débutant en Afrique de l'Ouest ou intermédiaire, climat tropical/soudanien
- Ton pratique, pas théorique : gestes, timing, repères visuels, erreurs fréquentes
- Inclure données chiffrées : rendement, coût, ROI, eau

Réponds UNIQUEMENT en JSON valide, strictement conforme à ce schéma (aucun texte hors JSON) :
{
  "yield_kg_ha": number,
  "cost_eur_ha": number,
  "roi_pct": number,
  "water_need_m3_ha": number,
  "description_md": "string (100 mots, intro du mode)",
  "steps": [
    { "title": "string", "text_md": "string 200-400 mots", "duration_minutes": number, "video_keywords": "string" }
    // exactement 12 entrées
  ],
  "quizzes": [
    { "question": "string", "choices": ["s","s","s","s"], "correct_idx": 0-3, "explanation": "string" }
    // exactement 5 entrées
  ]
}`

  const models = [
    () => generateText({ model: google('gemini-2.5-flash'), prompt, temperature: 0.7 }),
    () => generateText({ model: groq('llama-3.3-70b-versatile'), prompt, temperature: 0.7 }),
    () => generateText({ model: groq('openai/gpt-oss-20b'), prompt, temperature: 0.7 }),
  ]
  let lastErr: Error | null = null
  for (const attempt of models) {
    try {
      const { text } = await attempt()
      const parsed = extractJson(text) as z.infer<typeof CurriculumSchema>
      return CurriculumSchema.parse(parsed)
    } catch (err) {
      lastErr = err as Error
      console.warn(`  retry (${(err as Error).message.slice(0, 80)})`)
      // Rotate Gemini key if quota error
      if (lastErr.message.includes('quota') && GEMINI_KEYS.length > 1) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = nextGeminiKey()
      }
    }
  }
  throw lastErr ?? new Error('All models failed')
}

async function main() {
  // Fetch modes without steps
  const { data: modes, error } = await sb
    .from('crop_tutorial_modes')
    .select('id, mode, tutorial_id, crop_tutorials!inner(slug, crop_name_fr)')
  if (error) throw error
  if (!modes?.length) { console.log('No modes found'); return }

  let built = 0
  let skipped = 0
  const DELAY_MS = Number(process.env.CURRICULUM_DELAY_MS || 30000) // 30s between calls = < 20 rpm Gemini free
  for (const m of modes as unknown as Array<{ id: string; mode: 'terrain' | 'serre'; crop_tutorials: { slug: string; crop_name_fr: string } }>) {
    // Skip if steps already exist
    const { count } = await sb
      .from('crop_tutorial_steps')
      .select('*', { count: 'exact', head: true })
      .eq('mode_id', m.id)
    if ((count ?? 0) > 0) { skipped++; continue }

    const crop = m.crop_tutorials.crop_name_fr
    console.log(`→ Building ${crop} / ${m.mode}`)
    try {
      const curriculum = await generate(crop, m.mode)

      // Update mode with metrics + description
      await sb.from('crop_tutorial_modes').update({
        yield_kg_ha: curriculum.yield_kg_ha,
        cost_eur_ha: curriculum.cost_eur_ha,
        roi_pct: curriculum.roi_pct,
        water_need_m3_ha: curriculum.water_need_m3_ha,
        description_md: curriculum.description_md,
      }).eq('id', m.id)

      // Insert steps
      const stepRows = curriculum.steps.map((s, i) => ({
        mode_id: m.id,
        step_order: i + 1,
        title: s.title,
        text_md: s.text_md,
        duration_minutes: s.duration_minutes,
        video_url: null, // enriched later via YouTube search agent
      }))
      await sb.from('crop_tutorial_steps').insert(stepRows)

      // Insert quizzes
      const quizRows = curriculum.quizzes.map((q, i) => ({
        mode_id: m.id,
        question: q.question,
        choices: q.choices,
        correct_idx: q.correct_idx,
        explanation: q.explanation,
        display_order: i,
      }))
      await sb.from('crop_tutorial_quizzes').insert(quizRows)

      built++
      console.log(`  ✅ ${crop}/${m.mode} — ${curriculum.steps.length} steps + ${curriculum.quizzes.length} quiz`)
    } catch (err) {
      console.error(`  ❌ ${crop}/${m.mode} — ${(err as Error).message}`)
    }
    // Rate-limit friendly delay between modes
    await new Promise((r) => setTimeout(r, DELAY_MS))
  }
  console.log(`\n${built} modes built, ${skipped} already had steps.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
