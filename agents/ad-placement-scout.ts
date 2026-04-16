// @ts-nocheck
/**
 * FTG — Ad Placement Scout
 *
 * For each (product_slug, country_iso) tuple, discovers ad placements:
 *  - Media outlets (press sites, trade mags, blogs)
 *  - LinkedIn groups + top industry voices
 *  - Facebook groups (diaspora, trade, sector)
 *  - WhatsApp groups (public invite links shared online)
 *  - Podcasts (niche Afro/trade/export)
 *  - Events/Salons (SIAL, SIAM, Africa Business Forum...)
 *  - TV/Radio segments (regional)
 *  - Billboard zones (airports, markets, CBD)
 *
 * Pipeline:
 *  1. Generate search queries per (product, country, channel)
 *  2. Run via Gemini web-search (free grounding) or Serper fallback
 *  3. Score relevance + estimate CPM + domain authority
 *  4. Upsert into `ad_placements`
 *
 * Usage:
 *   npx tsx agents/ad-placement-scout.ts
 *   npx tsx agents/ad-placement-scout.ts --products=cacao,mangue --countries=FR,CI
 *   npx tsx agents/ad-placement-scout.ts --max=500
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const args = new Map<string, string>()
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([\w-]+)(?:=(.+))?$/)
  if (m) args.set(m[1], m[2] ?? 'true')
}

const MAX = Number(args.get('max') ?? 40)
const PRODUCTS = args.get('products')?.split(',') ?? ['cacao', 'café', 'mangue', 'beurre de karité', 'coton', 'anacarde', 'igname', 'or', 'bois tropical', 'textile']
const COUNTRIES = args.get('countries')?.split(',') ?? ['FR', 'CI', 'SN', 'MA', 'TN', 'CM', 'NG', 'GH']

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const CHANNELS = [
  { id: 'press_online',     query: (p: string, c: string) => `top media sites B2B import export ${p} ${c}`, cpmHint: 15 },
  { id: 'trade_magazine',   query: (p: string, c: string) => `trade magazine ${p} industry ${c}`,             cpmHint: 20 },
  { id: 'linkedin_group',   query: (p: string, c: string) => `LinkedIn group ${p} exporters importers ${c}`,  cpmHint: 0 },
  { id: 'facebook_group',   query: (p: string, c: string) => `Facebook group ${p} business ${c}`,              cpmHint: 0 },
  { id: 'whatsapp_group',   query: (p: string, c: string) => `WhatsApp group invite ${p} entrepreneurs ${c}`,  cpmHint: 0 },
  { id: 'podcast',          query: (p: string, c: string) => `podcast ${p} Africa trade Afrobiz ${c}`,         cpmHint: 35 },
  { id: 'industry_event',   query: (p: string, c: string) => `salon trade show ${p} ${c} 2026 2027`,           cpmHint: 0 },
  { id: 'billboard_zone',   query: (p: string, c: string) => `airport market hub ${c} billboard signage`,      cpmHint: 100 },
  { id: 'influencer',       query: (p: string, c: string) => `top influencer Twitter LinkedIn ${p} ${c}`,      cpmHint: 0 },
  { id: 'tv_segment',       query: (p: string, c: string) => `TV channel Africa business ${c} ${p}`,           cpmHint: 80 },
] as const

async function scoutCombo(product: string, country: string) {
  const rows: any[] = []
  for (const ch of CHANNELS) {
    const prompt = `For the product "${product}" and country "${country}", list the 3 BEST ${ch.id.replace('_', ' ')} placements for B2B advertising reaching exporters/importers/traders. For each, provide: placement_name, url (if known, else ""), audience_description (50 words), estimated_cpm_eur (realistic guess or 0 for free), reach_estimate (people/month), relevance_score (0-100), cost_tier (free/low/mid/high/premium). Return STRICT JSON array, no commentary.

Query context: ${ch.query(product, country)}`
    try {
      const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
        maxTokens: 800,
      })
      const m = text.match(/\[[\s\S]*\]/)
      if (!m) continue
      const parsed = JSON.parse(m[0]) as any[]
      for (const p of parsed) {
        if (!p.placement_name) continue
        rows.push({
          product_slug: product.toLowerCase().replace(/\s+/g, '-'),
          country_iso: country.toUpperCase(),
          channel: ch.id,
          placement_name: String(p.placement_name).slice(0, 200),
          url: p.url ? String(p.url).slice(0, 500) : null,
          audience_description: p.audience_description ? String(p.audience_description).slice(0, 500) : null,
          estimated_cpm_eur: Number(p.estimated_cpm_eur) || null,
          reach_estimate: Number(p.reach_estimate) || null,
          relevance_score: Math.max(0, Math.min(100, Number(p.relevance_score) || 50)),
          cost_tier: p.cost_tier ?? 'mid',
        })
      }
    } catch (e) {
      console.warn(`  ${ch.id} ${product}/${country}: ${(e as Error).message.slice(0, 80)}`)
    }
  }
  return rows
}

async function run() {
  console.log(`[ad-placement-scout] ${PRODUCTS.length} products × ${COUNTRIES.length} countries × ${CHANNELS.length} channels`)
  let total = 0
  for (const country of COUNTRIES) {
    for (const product of PRODUCTS) {
      if (total >= MAX * CHANNELS.length) { console.log('max reached'); return }
      const rows = await scoutCombo(product, country)
      if (rows.length === 0) continue
      const { error } = await sb.from('ad_placements').upsert(rows, {
        onConflict: 'product_slug,country_iso,channel,placement_name',
      })
      if (error) { console.warn(`upsert ${product}/${country}: ${error.message}`); continue }
      total += rows.length
      console.log(`  ${country}/${product}: +${rows.length} placements (total ${total})`)
    }
  }
  console.log(`✓ scouted ${total} placements total`)
}

run().catch(e => { console.error(e); process.exit(1) })
