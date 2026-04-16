// @ts-nocheck
/**
 * FTG — Upgrade entrepreneur_demos with archetype + ROI + localized hero.
 *
 * Iterates existing demos and fills:
 *   - archetype / archetype_icon / archetype_tagline  (based on market_data richness)
 *   - roi_monthly_eur / roi_payback_months          (from business_plan or sector defaults)
 *   - match_buyers_count                              (local_buyers in same country × sector)
 *   - match_investors_count                           (deal_flows/investors matching sector)
 *   - hero_message_en/ar/pt/es                        (Gemini localization)
 *
 * Usage: npx tsx agents/upgrade-demos.ts            # all demos, ai fallback
 *        npx tsx agents/upgrade-demos.ts --max=50   # batch size
 *        npx tsx agents/upgrade-demos.ts --no-ai    # skip localization (fast)
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
const MAX = Number(args.get('max') ?? 500)
const NO_AI = args.get('no-ai') === 'true'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Sector → conservative monthly revenue (EUR) + payback in months.
// Values anchored on FTG production_cost_benchmarks + median deal size.
const SECTOR_ROI: Record<string, { monthly: number; payback: number }> = {
  agriculture:  { monthly: 4200,  payback: 8 },
  textile:      { monthly: 6800,  payback: 6 },
  food:         { monthly: 5500,  payback: 7 },
  craft:        { monthly: 2400,  payback: 10 },
  joaillerie:   { monthly: 9200,  payback: 5 },
  cosmetique:   { monthly: 5100,  payback: 7 },
  electronique: { monthly: 8500,  payback: 9 },
  services:     { monthly: 3100,  payback: 6 },
  default:      { monthly: 4000,  payback: 8 },
}

function sectorRoi(sector: string | null | undefined) {
  if (!sector) return SECTOR_ROI.default
  const s = sector.toLowerCase()
  for (const key of Object.keys(SECTOR_ROI)) {
    if (s.includes(key)) return SECTOR_ROI[key]
  }
  return SECTOR_ROI.default
}

// Archetype from richness: business_plan + market_data + opportunities + investors present.
function computeArchetype(demo: Record<string, unknown>) {
  let score = 0
  if (demo.hero_message) score += 10
  if (demo.market_data && Object.keys(demo.market_data as object).length > 0) score += 20
  if (demo.business_plan) score += 30
  if (demo.opportunities && Array.isArray(demo.opportunities) && (demo.opportunities as unknown[]).length > 0) score += 20
  if (demo.investors && Array.isArray(demo.investors) && (demo.investors as unknown[]).length > 0) score += 20
  if (score >= 90) return { archetype: 'Le Pionnier', icon: '⚔️', tagline: 'Tu as tracé ta voie — le plan est prêt.' }
  if (score >= 60) return { archetype: 'L\'Éclaireur', icon: '🔭', tagline: 'Tu as analysé le terrain.' }
  if (score >= 30) return { archetype: 'L\'Aventurier', icon: '🧭', tagline: 'Tu as effleuré l\'opportunité.' }
  return { archetype: 'Nouveau venu', icon: '🌱', tagline: 'Commence ton parcours sur cette opportunité.' }
}

async function localizeHero(fr: string): Promise<{ en: string; ar: string; pt: string; es: string }> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY || NO_AI) {
    return { en: fr, ar: fr, pt: fr, es: fr }
  }
  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `Translate this B2B pitch hero message into English (en), Arabic (ar), Portuguese (pt), Spanish (es). Keep same impact + emotion. Return STRICT JSON: {"en":"...","ar":"...","pt":"...","es":"..."}. No explanation.

French source: "${fr}"`,
      maxTokens: 500,
    })
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      const parsed = JSON.parse(m[0])
      return {
        en: parsed.en ?? fr,
        ar: parsed.ar ?? fr,
        pt: parsed.pt ?? fr,
        es: parsed.es ?? fr,
      }
    }
  } catch (e) {
    console.warn(`[localize] failed: ${(e as Error).message}`)
  }
  return { en: fr, ar: fr, pt: fr, es: fr }
}

async function matchCounts(countryIso: string | null, sector: string | null) {
  if (!countryIso) return { buyers: 0, investors: 0 }
  const [buyersR, investorsR] = await Promise.all([
    sb.from('local_buyers')
      .select('*', { count: 'exact', head: true })
      .eq('country_iso', countryIso.toUpperCase())
      .limit(1),
    sb.from('deal_flows')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .limit(1),
  ])
  return {
    buyers: buyersR.count ?? 0,
    investors: investorsR.count ?? 0,
  }
}

async function run() {
  console.log(`[upgrade-demos] max=${MAX} no-ai=${NO_AI}`)
  const { data: demos, error } = await sb
    .from('entrepreneur_demos')
    .select('id, full_name, country_iso, sector, hero_message, business_plan, market_data, opportunities, investors, archetype')
    .is('archetype', null)
    .limit(MAX)
  if (error) { console.error(error.message); return }
  if (!demos?.length) { console.log('No demos to upgrade.'); return }

  let done = 0
  for (const demo of demos) {
    const { archetype, icon, tagline } = computeArchetype(demo)
    const roi = sectorRoi(demo.sector as string)
    const { buyers, investors } = await matchCounts(demo.country_iso as string, demo.sector as string)
    const loc = await localizeHero((demo.hero_message as string) ?? '')
    const { error: upErr } = await sb.from('entrepreneur_demos')
      .update({
        archetype,
        archetype_icon: icon,
        archetype_tagline: tagline,
        roi_monthly_eur: roi.monthly,
        roi_payback_months: roi.payback,
        match_buyers_count: buyers,
        match_investors_count: investors,
        hero_message_en: loc.en,
        hero_message_ar: loc.ar,
        hero_message_pt: loc.pt,
        hero_message_es: loc.es,
        updated_at: new Date().toISOString(),
      })
      .eq('id', demo.id)
    if (upErr) { console.warn(`${demo.full_name}: ${upErr.message}`); continue }
    done++
    if (done % 10 === 0) console.log(`  ${done}/${demos.length} · ${archetype} · buyers=${buyers} · roi=${roi.monthly}€/mo`)
  }
  console.log(`✓ upgraded ${done}/${demos.length} demos`)
}

run().catch(e => { console.error(e); process.exit(1) })
