// @ts-nocheck
/**
 * ONE FOR ALL — Hyperscale Agent
 *
 * "Le pouvoir se transmet et se multiplie à chaque génération !" — All Might
 *
 * Pipeline massif :
 *   1. SCOUT — Génère 1,000 leads par batch (50 pays × 20 commerces)
 *   2. BUILD — Génère le contenu site pour chaque lead
 *   3. PITCH — Prépare les templates de pitch
 *
 * Tout en un seul agent, optimisé pour le volume.
 * Objectif : 100,000 commerces identifiés, 100,000 sites générés.
 *
 * Usage :
 *   npx tsx agents/one-for-all-hyperscale.ts                    # full pipeline
 *   npx tsx agents/one-for-all-hyperscale.ts --scout-only       # scout seulement
 *   npx tsx agents/one-for-all-hyperscale.ts --build-only       # build seulement
 *   npx tsx agents/one-for-all-hyperscale.ts --batch=1          # batch 1 (10 pays)
 *   npx tsx agents/one-for-all-hyperscale.ts --count=5000       # target leads
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
  const p: Provider[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) p.push({ name: 'Gemini', model: google('gemini-2.5-flash'), exhausted: false })
  if (process.env.GROQ_API_KEY) { const g = createGroq({ apiKey: process.env.GROQ_API_KEY }); p.push({ name: 'Groq', model: g('llama-3.3-70b-versatile'), exhausted: false }) }
  if (!p.length) throw new Error('No AI API keys')
  return p
}

let providers: Provider[] = []
let idx = 0
async function gen(prompt: string, tokens = 8192): Promise<string> {
  const tried = new Set<string>()
  while (tried.size < providers.length) {
    const p = providers[idx]; tried.add(p.name)
    try { const { text } = await generateText({ model: p.model, prompt, maxTokens: tokens, temperature: 0.8 }); return text }
    catch (err: any) { if (err.message?.toLowerCase().match(/429|quota|rate/)) { p.exhausted = true; idx = (idx + 1) % providers.length; continue }; throw err }
  }
  throw new Error('All providers exhausted')
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

// ── 80 pays × catégories ─────────────────────────────────────────────────────
const COUNTRIES: Array<{ iso: string; name: string; cats: string[] }> = [
  // West Africa
  { iso: 'NGA', name: 'Nigeria', cats: ['agriculture', 'retail', 'restaurant', 'artisan', 'services', 'tech'] },
  { iso: 'GHA', name: 'Ghana', cats: ['agriculture', 'artisan', 'retail', 'food', 'services'] },
  { iso: 'CIV', name: "Côte d'Ivoire", cats: ['agriculture', 'artisan', 'cosmetics', 'food', 'retail'] },
  { iso: 'SEN', name: 'Senegal', cats: ['agriculture', 'artisan', 'restaurant', 'fashion', 'tourism'] },
  { iso: 'BFA', name: 'Burkina Faso', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'MLI', name: 'Mali', cats: ['agriculture', 'artisan', 'textile'] },
  { iso: 'BEN', name: 'Benin', cats: ['agriculture', 'retail', 'artisan'] },
  { iso: 'GIN', name: 'Guinea', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'TGO', name: 'Togo', cats: ['agriculture', 'retail', 'artisan'] },
  { iso: 'NER', name: 'Niger', cats: ['agriculture', 'artisan'] },
  // East Africa
  { iso: 'KEN', name: 'Kenya', cats: ['agriculture', 'tech', 'tourism', 'retail', 'services', 'food'] },
  { iso: 'TZA', name: 'Tanzania', cats: ['agriculture', 'tourism', 'artisan', 'food'] },
  { iso: 'ETH', name: 'Ethiopia', cats: ['agriculture', 'artisan', 'food', 'services'] },
  { iso: 'UGA', name: 'Uganda', cats: ['agriculture', 'artisan', 'food', 'services'] },
  { iso: 'RWA', name: 'Rwanda', cats: ['agriculture', 'tech', 'artisan', 'tourism'] },
  { iso: 'MOZ', name: 'Mozambique', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'MDG', name: 'Madagascar', cats: ['agriculture', 'artisan', 'cosmetics', 'food'] },
  // North Africa
  { iso: 'MAR', name: 'Morocco', cats: ['artisan', 'agriculture', 'cosmetics', 'textile', 'tourism', 'food'] },
  { iso: 'TUN', name: 'Tunisia', cats: ['artisan', 'agriculture', 'food', 'services', 'tech'] },
  { iso: 'EGY', name: 'Egypt', cats: ['artisan', 'agriculture', 'retail', 'food', 'tourism'] },
  { iso: 'DZA', name: 'Algeria', cats: ['agriculture', 'retail', 'food', 'services'] },
  // South Asia
  { iso: 'IND', name: 'India', cats: ['textile', 'artisan', 'agriculture', 'tech', 'cosmetics', 'food', 'services'] },
  { iso: 'BGD', name: 'Bangladesh', cats: ['textile', 'agriculture', 'artisan', 'food'] },
  { iso: 'PAK', name: 'Pakistan', cats: ['textile', 'agriculture', 'artisan', 'food', 'services'] },
  { iso: 'LKA', name: 'Sri Lanka', cats: ['agriculture', 'artisan', 'cosmetics', 'tourism'] },
  { iso: 'NPL', name: 'Nepal', cats: ['agriculture', 'artisan', 'tourism'] },
  // Southeast Asia
  { iso: 'IDN', name: 'Indonesia', cats: ['agriculture', 'artisan', 'food', 'textile', 'cosmetics', 'tourism'] },
  { iso: 'VNM', name: 'Vietnam', cats: ['agriculture', 'food', 'textile', 'artisan', 'tech'] },
  { iso: 'PHL', name: 'Philippines', cats: ['agriculture', 'artisan', 'food', 'services', 'retail'] },
  { iso: 'THA', name: 'Thailand', cats: ['agriculture', 'food', 'artisan', 'cosmetics', 'tourism'] },
  { iso: 'KHM', name: 'Cambodia', cats: ['agriculture', 'artisan', 'textile', 'food'] },
  { iso: 'MYS', name: 'Malaysia', cats: ['agriculture', 'food', 'tech', 'retail'] },
  { iso: 'MMR', name: 'Myanmar', cats: ['agriculture', 'artisan', 'food'] },
  // Latin America
  { iso: 'BRA', name: 'Brazil', cats: ['agriculture', 'food', 'artisan', 'cosmetics', 'fashion', 'tech'] },
  { iso: 'COL', name: 'Colombia', cats: ['agriculture', 'food', 'artisan', 'cosmetics', 'services'] },
  { iso: 'MEX', name: 'Mexico', cats: ['agriculture', 'food', 'artisan', 'retail', 'tourism'] },
  { iso: 'PER', name: 'Peru', cats: ['agriculture', 'artisan', 'food', 'textile', 'tourism'] },
  { iso: 'ECU', name: 'Ecuador', cats: ['agriculture', 'food', 'artisan'] },
  { iso: 'GTM', name: 'Guatemala', cats: ['agriculture', 'artisan', 'textile', 'food'] },
  { iso: 'HND', name: 'Honduras', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'BOL', name: 'Bolivia', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'PRY', name: 'Paraguay', cats: ['agriculture', 'food', 'retail'] },
  { iso: 'CRI', name: 'Costa Rica', cats: ['agriculture', 'tourism', 'food', 'tech'] },
  // Middle East / Central Asia
  { iso: 'TUR', name: 'Turkey', cats: ['artisan', 'food', 'textile', 'agriculture', 'cosmetics', 'retail'] },
  { iso: 'JOR', name: 'Jordan', cats: ['artisan', 'food', 'services'] },
  { iso: 'LBN', name: 'Lebanon', cats: ['food', 'artisan', 'services'] },
  { iso: 'UZB', name: 'Uzbekistan', cats: ['agriculture', 'textile', 'artisan'] },
  { iso: 'GEO', name: 'Georgia', cats: ['agriculture', 'food', 'tourism'] },
  // Southern Africa
  { iso: 'ZAF', name: 'South Africa', cats: ['agriculture', 'retail', 'food', 'artisan', 'tech', 'services'] },
  { iso: 'ZMB', name: 'Zambia', cats: ['agriculture', 'artisan', 'food'] },
  { iso: 'ZWE', name: 'Zimbabwe', cats: ['agriculture', 'artisan', 'food'] },
]

const TEMPLATES = ['standard', 'restaurant', 'artisan', 'agriculture', 'ecommerce', 'services']
const COLORS: Record<string, { p: string; s: string }> = {
  agriculture: { p: '#2D6A4F', s: '#D8F3DC' }, artisan: { p: '#C9A84C', s: '#FEF3C7' },
  restaurant: { p: '#DC2626', s: '#FEE2E2' }, retail: { p: '#2563EB', s: '#DBEAFE' },
  services: { p: '#7C3AED', s: '#EDE9FE' }, textile: { p: '#DB2777', s: '#FCE7F3' },
  food: { p: '#EA580C', s: '#FED7AA' }, cosmetics: { p: '#EC4899', s: '#FCE7F3' },
  tourism: { p: '#0891B2', s: '#CFFAFE' }, tech: { p: '#059669', s: '#D1FAE5' },
  fashion: { p: '#8B5CF6', s: '#EDE9FE' },
}

// ── SCOUT: Generate 50 leads per country in one LLM call ──────────────────────
async function scoutBatch(country: { iso: string; name: string; cats: string[] }, count: number): Promise<any[]> {
  const prompt = `Generate ${count} realistic small businesses in ${country.name} (${country.iso}) that DON'T have a website.

Categories: ${country.cats.join(', ')}
Mix urban and rural. Use real city names. Each must have unique name.

Return ONLY valid JSON array:
[{"n":"Business Name","c":"${country.iso}","city":"City","cat":"category","sub":"subcategory","p":["product1","product2","product3"],"s":75,"d":"One sentence description"}]

Keys: n=name, c=country, cat=category, sub=subcategory, p=products, s=score 0-100, d=description.
Generate EXACTLY ${count} entries.`

  const raw = await gen(prompt, 8192)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch { return [] }
}

// ── BUILD: Generate site content for a lead ──────────────────────────────────
async function buildSite(lead: any): Promise<any> {
  const prompt = `Create website content for: ${lead.business_name} in ${lead.city}, ${lead.country_iso}. Category: ${lead.category}. Products: ${(lead.products||[]).join(', ')}.

Return ONLY valid JSON:
{"t":"Tagline","h":"Hero title","hs":"Hero subtitle 2 sentences","a":"About text 150 words","pr":[{"n":"Product","d":"Description","p":"$10"}],"mt":"SEO title","md":"SEO description 155 chars","k":["keyword1","keyword2"]}`

  const raw = await gen(prompt, 2048)
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : cleaned)
  } catch { return null }
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
async function main() {
  providers = buildProviders()
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  ONE FOR ALL — Hyperscale Agent')
  console.log('  "Le pouvoir se transmet et se multiplie !" — All Might')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const scoutOnly = args.includes('--scout-only')
  const buildOnly = args.includes('--build-only')
  const batchNum = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '0')
  const targetCount = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] ?? '2000')
  const leadsPerCountry = 50

  // Select countries for this batch
  let targets = COUNTRIES
  if (batchNum > 0) {
    const start = (batchNum - 1) * 10
    targets = COUNTRIES.slice(start, start + 10)
    console.log(`  Batch ${batchNum}: ${targets.length} countries\n`)
  }

  // ── PHASE 1: SCOUT ─────────────────────────────────────────────────────────
  if (!buildOnly) {
    console.log('══ PHASE 1: SCOUTING ══\n')
    let totalScouted = 0

    for (const country of targets) {
      if (totalScouted >= targetCount) break
      const batchSize = Math.min(leadsPerCountry, targetCount - totalScouted)

      console.log(`  [${country.iso}] ${country.name} — scouting ${batchSize}...`)
      try {
        const leads = await scoutBatch(country, batchSize)
        let inserted = 0

        for (const l of leads) {
          const name = l.n ?? l.business_name ?? 'Unknown'
          const slug = slugify(`${name}-${country.iso}`)
          const { error } = await sb.from('commerce_leads').upsert({
            business_name: name, slug, country_iso: country.iso,
            city: l.city ?? '', category: l.cat ?? country.cats[0],
            subcategory: l.sub ?? '', products: l.p ?? [],
            source: 'ai_generated', potential_score: Math.min(100, l.s ?? 50),
            has_website: false, website_quality: 'none', status: 'identified',
            notes: l.d ?? '',
          }, { onConflict: 'slug' })
          if (!error) { inserted++; totalScouted++ }
        }

        console.log(`    ✓ +${inserted} leads (total: ${totalScouted})`)
      } catch (err: any) {
        console.error(`    ✗ ${err.message?.slice(0, 60)}`)
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    console.log(`\n  SCOUTED: ${totalScouted} leads\n`)
  }

  // ── PHASE 2: BUILD SITES ───────────────────────────────────────────────────
  if (!scoutOnly) {
    console.log('══ PHASE 2: BUILDING SITES ══\n')

    const { data: leads } = await sb.from('commerce_leads')
      .select('*').eq('status', 'identified')
      .order('potential_score', { ascending: false }).limit(500)

    let totalBuilt = 0
    for (const lead of (leads ?? [])) {
      try {
        const content = await buildSite(lead)
        if (!content) continue

        const colors = COLORS[lead.category] ?? COLORS.retail
        await sb.from('generated_sites').upsert({
          lead_id: lead.id, slug: lead.slug, business_name: lead.business_name,
          tagline: content.t ?? '', description: content.a ?? '', lang: 'en',
          hero_title: content.h ?? '', hero_subtitle: content.hs ?? '',
          about_text: content.a ?? '',
          products_json: content.pr ?? [], contact_info: { city: lead.city, country: lead.country_iso },
          meta_title: content.mt ?? '', meta_description: content.md ?? '',
          keywords: content.k ?? [], color_primary: colors.p, color_secondary: colors.s,
          template: lead.category === 'restaurant' ? 'restaurant' : lead.category === 'artisan' ? 'artisan' : 'standard',
          status: 'published', published_at: new Date().toISOString(),
        }, { onConflict: 'slug' })

        await sb.from('commerce_leads').update({
          status: 'site_generated',
          generated_site_url: `https://feel-the-gap.com/shop/${lead.slug}`,
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id)

        totalBuilt++
        if (totalBuilt % 25 === 0) console.log(`    Built ${totalBuilt} sites...`)
      } catch (err: any) {
        // continue on error
      }
      await new Promise(r => setTimeout(r, 800))
    }
    console.log(`\n  BUILT: ${totalBuilt} sites\n`)
  }

  // Final counts
  const { count: leadsCount } = await sb.from('commerce_leads').select('*', { count: 'exact', head: true })
  const { count: sitesCount } = await sb.from('generated_sites').select('*', { count: 'exact', head: true })

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ONE FOR ALL REPORT`)
  console.log(`  Commerce Leads: ${leadsCount}`)
  console.log(`  Generated Sites: ${sitesCount}`)
  console.log(`  Target: 100,000`)
  console.log('═══════════════════════════════════════════════════════════════')
}

if (process.argv[1]?.endsWith('one-for-all-hyperscale.ts')) {
  main().catch(console.error)
}
