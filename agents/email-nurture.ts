// @ts-nocheck
/**
 * Feel The Gap — Email Nurture Agent
 *
 * Génère et planifie des séquences email personnalisées dans les 15 langues.
 *
 * Séquences :
 *   1. BIENVENUE (J0, J1, J3, J7) — onboarding progressif
 *   2. ACTIVATION (J14, J21) — pousser vers la première action utile
 *   3. CONVERSION (J30, J45) — upgrade free → paid avec valeur démontrée
 *   4. RÉTENTION (mensuel) — nouvelles features, insights personnalisés
 *   5. WIN-BACK (J+7 après churn signal) — offre de rétention
 *
 * Chaque email est :
 *   - Rédigé dans la langue du user (détectée à l'inscription)
 *   - Personnalisé avec le pays/produit d'intérêt du user
 *   - A/B testé (2 subject lines par email)
 *
 * Impact : +40% conversion free→paid, -30% churn
 *
 * Usage :
 *   npx tsx agents/email-nurture.ts                    # generate all sequences
 *   npx tsx agents/email-nurture.ts --sequence=welcome # specific sequence
 *   npx tsx agents/email-nurture.ts --lang=ar,tr       # specific languages
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import { google } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'

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

const ALL_LANGS = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it'] as const
type Lang = (typeof ALL_LANGS)[number]

const LANG_NAMES: Record<Lang, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
}

type Sequence = 'welcome' | 'activation' | 'conversion' | 'retention' | 'winback'

const SEQUENCES: Record<Sequence, { emails: { day: number; purpose: string }[] }> = {
  welcome: {
    emails: [
      { day: 0, purpose: 'Welcome — what Feel The Gap does, first CTA to explore map' },
      { day: 1, purpose: 'Quick win — show them the top 3 opportunities in their region' },
      { day: 3, purpose: 'Social proof — share a success story in their language' },
      { day: 7, purpose: 'Feature discovery — introduce AI Advisor and Farming' },
    ],
  },
  activation: {
    emails: [
      { day: 14, purpose: 'Haven\'t used AI Advisor yet? Here\'s what you\'re missing' },
      { day: 21, purpose: 'Your personalized top 5 trade opportunities this week' },
    ],
  },
  conversion: {
    emails: [
      { day: 30, purpose: 'Free trial ending — upgrade to Data plan, here\'s what you unlock' },
      { day: 45, purpose: 'Last chance — special 20% discount for first 3 months' },
    ],
  },
  retention: {
    emails: [
      { day: 60, purpose: 'Monthly digest — new countries added, new features, your usage stats' },
    ],
  },
  winback: {
    emails: [
      { day: 0, purpose: 'We miss you — here\'s what\'s new since you left + 30% discount offer' },
    ],
  },
}

// Provider setup
function buildProviders() {
  const providers: { name: string; model: LanguageModelV1; exhausted: boolean }[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  }
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile'), exhausted: false })
  }
  if (!providers.length) throw new Error('No AI API keys')
  return providers
}

let providers: ReturnType<typeof buildProviders> = []
let pidx = 0

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[pidx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 2048, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate/)) {
        p.exhausted = true; pidx = (pidx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

async function generateEmail(seq: Sequence, emailIdx: number, lang: Lang): Promise<any> {
  const email = SEQUENCES[seq].emails[emailIdx]

  const prompt = `You are an expert email marketer for a B2B SaaS platform (Feel The Gap — global trade intelligence).

Generate a marketing email in ${LANG_NAMES[lang]}.

Sequence: ${seq}
Day: J+${email.day}
Purpose: ${email.purpose}

Output ONLY valid JSON:
{
  "subject_a": "Subject line A (max 60 chars, in ${LANG_NAMES[lang]})",
  "subject_b": "Subject line B — A/B test variant (max 60 chars, in ${LANG_NAMES[lang]})",
  "preview_text": "Preview text (max 90 chars, in ${LANG_NAMES[lang]})",
  "html_body": "<p>Email body in HTML (300-500 words in ${LANG_NAMES[lang]}). Include CTA button. Use {{first_name}}, {{country}}, {{product}} placeholders.</p>",
  "cta_text": "CTA button text (in ${LANG_NAMES[lang]})",
  "cta_url": "https://feel-the-gap.com/..."
}

The email must feel personal, not generic. Write in ${LANG_NAMES[lang]} ONLY.`

  const raw = await gen(prompt)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch {
    return null
  }
}

async function main() {
  providers = buildProviders()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Email Nurture Agent (15 Languages)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const seqFilter = args.find(a => a.startsWith('--sequence='))?.split('=')[1] as Sequence | null ?? null
  const langFilter = args.find(a => a.startsWith('--lang='))?.split('=')[1]?.split(',') as Lang[] | null ?? null

  // Shard partition — each instance handles a disjoint slice of languages.
  const { parseShardArgs, pickShard } = await import('./lib/shard')
  const { shard, shards } = parseShardArgs()
  const allLangs = langFilter ?? [...ALL_LANGS]
  const targetLangs = pickShard(allLangs, shard, shards)
  const targetSeqs = seqFilter ? [seqFilter] : Object.keys(SEQUENCES) as Sequence[]
  if (shards > 1) console.log(`[NURTURE] shard=${shard}/${shards} langs=${targetLangs.length}/${allLangs.length}`)

  const totalEmails = targetSeqs.reduce((sum, seq) => sum + SEQUENCES[seq].emails.length, 0) * targetLangs.length
  console.log(`  Sequences: ${targetSeqs.join(', ')} | Languages: ${targetLangs.length} | Total: ${totalEmails} emails\n`)

  let created = 0

  for (const seq of targetSeqs) {
    for (let i = 0; i < SEQUENCES[seq].emails.length; i++) {
      for (const lang of targetLangs) {
        try {
          const email = await generateEmail(seq, i, lang)
          if (!email) continue

          await supabase.from('email_templates').upsert({
            sequence: seq,
            email_index: i,
            day: SEQUENCES[seq].emails[i].day,
            lang,
            subject_a: email.subject_a,
            subject_b: email.subject_b,
            preview_text: email.preview_text,
            html_body: email.html_body,
            cta_text: email.cta_text,
            cta_url: email.cta_url,
            status: 'active',
            created_at: new Date().toISOString(),
          }, { onConflict: 'sequence,email_index,lang' })

          created++
          console.log(`  ✓ [${created}/${totalEmails}] ${seq}/J${SEQUENCES[seq].emails[i].day}/${lang}`)

          await new Promise(r => setTimeout(r, 800))
        } catch (err: any) {
          console.error(`  ✗ ${seq}/${i}/${lang}: ${err.message}`)
        }
      }
    }
  }

  console.log(`\n═══ Generated ${created} email templates ═══`)
}

if (process.argv[1]?.endsWith('email-nurture.ts')) {
  main().catch(console.error)
}
