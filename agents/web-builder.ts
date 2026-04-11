// @ts-nocheck
/**
 * Feel The Gap — Web Builder Agent (Nami Mode — Site Generator)
 *
 * "Je vais leur construire un site tellement beau qu'ils ne pourront
 *  pas refuser de rejoindre mon réseau !" — Nami
 *
 * Prend les commerce_leads avec status='identified' et génère un site
 * vitrine complet pour chacun. Le site est stocké dans generated_sites
 * et servable via /shop/[slug].
 *
 * Framework SUK Level 3 :
 *   - Génère le contenu (hero, about, products, contact, testimonials)
 *   - Choisit le template adapté à la catégorie
 *   - Optimise pour le SEO local
 *   - Met à jour le lead status → 'site_generated'
 *
 * Usage :
 *   npx tsx agents/web-builder.ts                    # process all identified leads
 *   npx tsx agents/web-builder.ts --country=NGA      # specific country
 *   npx tsx agents/web-builder.ts --limit=100        # limit
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

let providers: Provider[] = []
let idx = 0

async function gen(prompt: string): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]
    tried.add(p.name)
    try {
      const { text } = await generateText({ model: p.model, prompt, maxTokens: 4096, temperature: 0.7 })
      return text
    } catch (err: any) {
      const msg = err.message?.toLowerCase() ?? ''
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
        p.exhausted = true; idx = (idx + 1) % providers.length; continue
      }
      throw err
    }
  }
  throw new Error('All providers exhausted')
}

const TEMPLATE_COLORS: Record<string, { primary: string; secondary: string }> = {
  agriculture: { primary: '#2D6A4F', secondary: '#D8F3DC' },
  artisan:     { primary: '#C9A84C', secondary: '#FEF3C7' },
  restaurant:  { primary: '#DC2626', secondary: '#FEE2E2' },
  retail:      { primary: '#2563EB', secondary: '#DBEAFE' },
  services:    { primary: '#7C3AED', secondary: '#EDE9FE' },
  textile:     { primary: '#DB2777', secondary: '#FCE7F3' },
  food:        { primary: '#EA580C', secondary: '#FED7AA' },
  cosmetics:   { primary: '#EC4899', secondary: '#FCE7F3' },
  tourism:     { primary: '#0891B2', secondary: '#CFFAFE' },
}

async function buildSiteContent(lead: any): Promise<any> {
  const prompt = `Create website content for this business. Write in English.

Business: ${lead.business_name}
Location: ${lead.city}, ${lead.country_iso}
Category: ${lead.category} / ${lead.subcategory ?? ''}
Products: ${(lead.products ?? []).join(', ')}
Description: ${lead.notes ?? 'Local business'}

Generate COMPLETE website content. Return ONLY valid JSON:
{
  "tagline": "Catchy tagline (max 60 chars)",
  "hero_title": "Compelling hero headline",
  "hero_subtitle": "2 sentences explaining what makes this business special",
  "about_text": "3-4 paragraphs about the business, its story, values, and what makes it unique (200-300 words)",
  "products": [
    {"name": "Product 1", "description": "2 sentences", "price_hint": "$10-15"},
    {"name": "Product 2", "description": "2 sentences", "price_hint": "$20-25"},
    {"name": "Product 3", "description": "2 sentences", "price_hint": "$5-8"}
  ],
  "testimonials": [
    {"name": "Customer Name", "text": "Realistic testimonial quote", "role": "Regular customer"},
    {"name": "Customer Name 2", "text": "Another testimonial", "role": "Business partner"}
  ],
  "meta_title": "SEO title (max 60 chars)",
  "meta_description": "SEO description (max 155 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "cta_text": "Call to action button text"
}

Make it feel PROFESSIONAL and AUTHENTIC. The business owner should be impressed.`

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

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Web Builder (Nami Site Generator)')
  console.log('  "Un site tellement beau qu\'ils ne pourront pas refuser"')
  console.log('═══════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const countryFilter = args.find(a => a.startsWith('--country='))?.split('=')[1] ?? null
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '200')

  // Get identified leads without sites
  let query = sb
    .from('commerce_leads')
    .select('*')
    .eq('status', 'identified')
    .order('potential_score', { ascending: false })
    .limit(limit)

  if (countryFilter) query = query.eq('country_iso', countryFilter)

  const { data: leads } = await query
  if (!leads?.length) { console.log('  No leads to process'); return }

  console.log(`  Leads to process: ${leads.length}\n`)

  let totalBuilt = 0

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    console.log(`  [${i + 1}/${leads.length}] ${lead.business_name} (${lead.country_iso})...`)

    try {
      const content = await buildSiteContent(lead)
      if (!content) { console.log('    ✗ Failed to generate content'); continue }

      const colors = TEMPLATE_COLORS[lead.category] ?? TEMPLATE_COLORS.retail
      const siteSlug = lead.slug

      // Insert generated site
      const { error: siteError } = await sb.from('generated_sites').upsert({
        lead_id: lead.id,
        slug: siteSlug,
        business_name: lead.business_name,
        tagline: content.tagline,
        description: content.about_text,
        lang: 'en',
        hero_title: content.hero_title,
        hero_subtitle: content.hero_subtitle,
        about_text: content.about_text,
        products_json: content.products ?? [],
        contact_info: { city: lead.city, country: lead.country_iso, phone: lead.phone },
        testimonials: content.testimonials ?? [],
        meta_title: content.meta_title,
        meta_description: content.meta_description,
        keywords: content.keywords ?? [],
        color_primary: colors.primary,
        color_secondary: colors.secondary,
        template: lead.category === 'restaurant' ? 'restaurant' : lead.category === 'artisan' ? 'artisan' : lead.category === 'agriculture' ? 'agriculture' : 'standard',
        status: 'published',
        published_at: new Date().toISOString(),
      }, { onConflict: 'slug' })

      if (siteError) {
        console.log(`    ✗ Site: ${siteError.message?.slice(0, 60)}`)
        continue
      }

      // Update lead status
      const siteUrl = `https://feel-the-gap.com/shop/${siteSlug}`
      await sb.from('commerce_leads').update({
        status: 'site_generated',
        generated_site_url: siteUrl,
        generated_site_data: content,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id)

      totalBuilt++
      console.log(`    ✓ Site built: /shop/${siteSlug}`)

    } catch (err: any) {
      console.error(`    ✗ ${err.message?.slice(0, 60)}`)
    }

    await new Promise(r => setTimeout(r, 1200))
  }

  // Update daily metrics
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await sb.from('commerce_pipeline_metrics').select('sites_generated').eq('date', today).maybeSingle()
  await sb.from('commerce_pipeline_metrics').upsert({
    date: today,
    sites_generated: (existing?.sites_generated ?? 0) + totalBuilt,
  }, { onConflict: 'date' })

  await sb.from('auto_optimizer_log').insert({
    agent_name: 'web-builder-nami',
    action_type: 'sites_built',
    after_state: { sites: totalBuilt },
    reason: `Nami built ${totalBuilt} sites for commerce leads`,
    impact_estimate: `${totalBuilt} pitchable sites ready`,
    executed: true,
  })

  console.log(`\n═══ Built ${totalBuilt} sites ═══`)
}

if (process.argv[1]?.endsWith('web-builder.ts')) {
  main().catch(console.error)
}
