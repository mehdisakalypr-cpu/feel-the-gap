// @ts-nocheck
/**
 * Feel The Gap — Commerce Pitcher Agent (Nami Mode — L'Art de la Négociation)
 *
 * "Personne ne résiste à une offre bien présentée !" — Nami
 *
 * Génère des emails/messages de pitch personnalisés pour les commerce_leads
 * dont le site a été généré (status='site_generated').
 *
 * Le pitch montre au commerçant :
 *   1. Son site web déjà créé (lien direct)
 *   2. Ce que FTG peut lui apporter (investisseurs, clients, affiliation)
 *   3. C'est 100% gratuit pour lui
 *
 * Génère aussi les pitch_templates en 15 langues.
 *
 * Usage :
 *   npx tsx agents/commerce-pitcher.ts                     # generate all pitches
 *   npx tsx agents/commerce-pitcher.ts --templates-only     # generate templates only
 *   npx tsx agents/commerce-pitcher.ts --country=NGA        # pitch for specific country
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

interface Provider { name: string; model: LanguageModelV1; exhausted: boolean }

function buildProviders(): Provider[] {
  const providers: Provider[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) providers.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    providers.push({ name: 'Groq', model: groq('llama-3.3-70b-versatile'), exhausted: false })
  }
  if (!providers.length) throw new Error('No AI API keys')
  return providers
}

let providers: Provider[] = []
let idx = 0

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]; tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 2048, temperature: 0.7 })
      return text
    } catch (err: any) {
      if (err.message?.toLowerCase().match(/429|quota|rate/)) { p.exhausted = true; idx = (idx + 1) % providers.length; continue }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

const LANGS = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it']
const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  zh: 'Chinese', de: 'German', tr: 'Turkish', ja: 'Japanese', ko: 'Korean',
  hi: 'Hindi', ru: 'Russian', id: 'Indonesian', sw: 'Swahili', it: 'Italian',
}

// Country → primary language mapping
const COUNTRY_LANG: Record<string, string> = {
  NGA: 'en', GHA: 'en', KEN: 'en', TZA: 'sw', ETH: 'en', UGA: 'en', RWA: 'fr',
  CIV: 'fr', SEN: 'fr', BFA: 'fr', MLI: 'fr', BEN: 'fr', GIN: 'fr', MOZ: 'pt',
  MAR: 'fr', TUN: 'fr', EGY: 'ar', DZA: 'ar',
  IND: 'en', BGD: 'en', PAK: 'en', LKA: 'en', NPL: 'en',
  IDN: 'id', VNM: 'en', PHL: 'en', THA: 'en', KHM: 'en', MYS: 'en',
  BRA: 'pt', COL: 'es', MEX: 'es', PER: 'es', ECU: 'es', GTM: 'es', HND: 'es',
  TUR: 'tr', JOR: 'ar', LBN: 'ar',
}

async function generateTemplates(sb: any) {
  console.log('\n── Generating Pitch Templates (15 languages) ──\n')

  for (const lang of LANGS) {
    const prompt = `Write a pitch EMAIL in ${LANG_NAMES[lang]} for a small business owner who doesn't have a website.

Context: We (Feel The Gap) have already created a FREE website for their business. We want them to:
1. See the website we built for them
2. Join our platform (free for them)
3. Get access to international investors and clients

The tone should be: warm, professional, exciting but not pushy. Show VALUE first.

Return ONLY valid JSON:
{
  "subject": "Email subject line in ${LANG_NAMES[lang]} (max 60 chars)",
  "body": "Full email body in ${LANG_NAMES[lang]} with {{business_name}}, {{site_url}}, {{city}}, {{products}} placeholders. 150-250 words. Include clear CTA.",
  "cta_text": "CTA button text in ${LANG_NAMES[lang]}"
}`

    try {
      const raw = await gen(prompt)
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      const tpl = JSON.parse(match ? match[0] : cleaned)

      await sb.from('pitch_templates').upsert({
        lang,
        channel: 'email',
        target: 'no_website',
        subject: tpl.subject,
        body: tpl.body,
        cta_text: tpl.cta_text,
        status: 'active',
      }, { onConflict: 'lang,channel,target' })

      console.log(`  ✓ ${lang} — ${tpl.subject?.slice(0, 50)}`)
    } catch (err: any) {
      console.error(`  ✗ ${lang}: ${err.message?.slice(0, 60)}`)
    }

    await new Promise(r => setTimeout(r, 800))
  }
}

async function pitchLeads(sb: any, countryFilter: string | null, shard: number, shards: number, limit: number) {
  console.log('\n── Pitching Commerce Leads ──\n')
  const { belongsToShard } = await import('./lib/shard')

  // Oversample so shard slice still meets limit.
  let q = sb
    .from('commerce_leads')
    .select('*')
    .eq('status', 'site_generated')
    .order('potential_score', { ascending: false })
    .limit(limit * shards)
  if (countryFilter) q = q.eq('country_iso', countryFilter)
  const { data: leadsRaw } = await q
  const leads = (leadsRaw ?? [])
    .filter((l: any) => belongsToShard(String(l.id), shard, shards))
    .slice(0, limit)

  if (!leads?.length) { console.log('  No leads ready for pitching'); return }

  // Get templates
  const { data: templates } = await sb.from('pitch_templates').select('*').eq('channel', 'email').eq('target', 'no_website')
  const tplMap: Record<string, any> = {}
  for (const t of (templates ?? [])) tplMap[t.lang] = t

  let pitched = 0

  for (const lead of leads) {
    const lang = COUNTRY_LANG[lead.country_iso] ?? 'en'
    const tpl = tplMap[lang] ?? tplMap['en']
    if (!tpl) continue

    // Personalize the pitch
    const personalizedBody = (tpl.body ?? '')
      .replace(/\{\{business_name\}\}/g, lead.business_name)
      .replace(/\{\{site_url\}\}/g, lead.generated_site_url ?? `https://feel-the-gap.com/shop/${lead.slug}`)
      .replace(/\{\{city\}\}/g, lead.city ?? '')
      .replace(/\{\{products\}\}/g, (lead.products ?? []).join(', '))

    // Update lead as pitched (in production, this would send the actual email)
    await sb.from('commerce_leads').update({
      status: 'pitched',
      pitch_sent_at: new Date().toISOString(),
      pitch_template: lang,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id)

    pitched++
    console.log(`  ✓ [${pitched}] ${lead.business_name} (${lead.country_iso}) — ${lang}`)
  }

  // Update metrics
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await sb.from('commerce_pipeline_metrics').select('pitches_sent').eq('date', today).maybeSingle()
  await sb.from('commerce_pipeline_metrics').upsert({
    date: today,
    pitches_sent: (existing?.pitches_sent ?? 0) + pitched,
  }, { onConflict: 'date' })

  console.log(`\n═══ Pitched ${pitched} leads ═══`)
}

async function main() {
  providers = buildProviders()

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Commerce Pitcher (Nami Negotiation Mode)')
  console.log('  "Personne ne résiste à une offre bien présentée !"')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const templatesOnly = args.includes('--templates-only')
  const countryFilter = args.find(a => a.startsWith('--country='))?.split('=')[1] ?? null
  const limitArgRaw = args.find(a => a.startsWith('--limit='))?.split('=')[1]

  // CC simulator target + shard partition.
  const { loadActiveTarget, needForAgent } = await import('./lib/agent-targets')
  const { parseShardArgs } = await import('./lib/shard')
  const { shard, shards } = parseShardArgs()
  const activeTarget = limitArgRaw ? null : await loadActiveTarget('ftg')
  const dbTarget = needForAgent(activeTarget, 'commerce-pitcher') ?? needForAgent(activeTarget, 'email-nurture')
  const globalLimit = limitArgRaw ? parseInt(limitArgRaw) : (dbTarget ?? 200)
  const shardLimit = Math.max(1, Math.ceil(globalLimit / shards))
  if (activeTarget || shards > 1) console.log(`[PITCHER] shard=${shard}/${shards} limit=${shardLimit} (global=${globalLimit})`)

  // Always ensure templates exist
  await generateTemplates(sb)

  if (!templatesOnly) {
    await pitchLeads(sb, countryFilter, shard, shards, shardLimit)
  }
}

if (process.argv[1]?.endsWith('commerce-pitcher.ts')) {
  main().catch(console.error)
}
