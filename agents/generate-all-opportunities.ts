// @ts-nocheck
/**
 * Feel The Gap — Bulk Opportunity Generator
 *
 * Génère 3-5 opportunités commerciales par pays (Gemini 2.0 Flash)
 * pour tous les pays sans opportunités en DB.
 *
 * Usage:
 *   npx tsx agents/generate-all-opportunities.ts              # tous les pays manquants
 *   npx tsx agents/generate-all-opportunities.ts --iso GIN,MAR # pays spécifiques
 *   npx tsx agents/generate-all-opportunities.ts --dry         # dry-run (affiche sans insérer)
 *
 * Reprend automatiquement depuis le dernier checkpoint.
 * Rate limit: 1 country/2s (Gemini free tier)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Key pool for ×4 throughput (4 free-tier Gemini keys, 20 rpm each = 80 rpm total)
const GEMINI_KEYS = [
  process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_2,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_3,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_4,
].filter(Boolean) as string[]
let keyIdx = 0
function nextGemini(model: string) {
  const key = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length]
  keyIdx++
  return createGoogleGenerativeAI({ apiKey: key })(model)
}
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { localizeUserPrompt } from '@/lib/ai/localized-gen'
import type { Locale } from '@/lib/i18n/locale'

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CHECKPOINT_FILE = path.join(process.cwd(), '.opportunity-checkpoint.json')
const DELAY_MS = 4000  // 4s between countries (Gemini rate limit)
const MAX_OPPS_PER_COUNTRY = 4
const GEMINI_MODEL = 'gemini-2.5-flash'  // renouvellement quota à minuit UTC

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isDry = args.includes('--dry')
const isoArg = args.find(a => a.startsWith('--iso=') || a === '--iso')
const maxArg = args.find(a => a.startsWith('--max=') || a === '--max')
let forcedIsos: string[] | null = null
let maxCountries: number = 999
if (isoArg) {
  const val = isoArg.startsWith('--iso=') ? isoArg.split('=')[1] : args[args.indexOf('--iso') + 1]
  forcedIsos = val ? val.split(',').map(s => s.trim().toUpperCase()) : null
}
if (maxArg) {
  const val = maxArg.startsWith('--max=') ? maxArg.split('=')[1] : args[args.indexOf('--max') + 1]
  maxCountries = parseInt(val ?? '10') || 10
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint(): Set<string> {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'))
      return new Set(data.done ?? [])
    }
  } catch { /* ignore */ }
  return new Set()
}

function saveCheckpoint(done: Set<string>) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ done: Array.from(done), ts: new Date().toISOString() }))
}

// ── Gemini prompt ─────────────────────────────────────────────────────────────

function buildPrompt(country: {
  id: string; name: string; region: string; sub_region: string
  gdp_usd: number | null; total_imports_usd: number | null
  top_import_text: string | null; renewable_pct: number | null
  energy_cost_index: number | null
}): string {
  const gdp = country.gdp_usd ? `$${(country.gdp_usd / 1e9).toFixed(1)}B` : 'unknown'
  const imports = country.total_imports_usd ? `$${(country.total_imports_usd / 1e9).toFixed(1)}B/yr` : 'unknown'

  return `You are a world-class trade economist and investment analyst. Generate ${MAX_OPPS_PER_COUNTRY} concrete, actionable trade/investment opportunities for ${country.name}.

Country profile:
- ISO3: ${country.id}
- Region: ${country.region} / ${country.sub_region}
- GDP: ${gdp}
- Total imports: ${imports}
- Top imports: ${country.top_import_text ?? 'unknown — infer from country knowledge'}
- Renewable energy: ${country.renewable_pct != null ? country.renewable_pct + '%' : 'unknown'}
- Energy cost index: ${country.energy_cost_index != null ? country.energy_cost_index + '/100 (lower = cheaper)' : 'unknown'}

For each opportunity, provide:
1. A specific product/sector (be concrete: "basmati rice", not "food")
2. Type: "local_production", "import_replacement", "direct_trade", or "export_opportunity"
3. Realistic financial estimates
4. A detailed summary with specific facts, market data, and actionable insights

Rules:
- Opportunities must be relevant to THIS specific country (geography, resources, demographics)
- Score honestly — not everything is 90+
- Mix types: ideally 2 local_production + 1 import_replacement + 1 direct_trade
- For developed countries: focus on high-value niches, green tech, services, specialized manufacturing
- For developing countries: focus on import substitution, agri-processing, minerals, renewable energy
- Avoid generic text. Be specific: mention real companies, ports, trade partners, commodity prices

Return ONLY valid JSON array (no markdown):
[
  {
    "product_name": "exact product name",
    "product_category": "agriculture|energy|materials|manufactured|services",
    "type": "local_production|import_replacement|direct_trade|export_opportunity",
    "gap_value_usd": 500000000,
    "opportunity_score": 78,
    "labor_cost_index": 25,
    "infrastructure_score": 6,
    "land_availability": "high|medium|low|not_applicable",
    "summary": "3-4 sentence detailed analysis with specific facts, market context, investment size, and realistic returns"
  }
]`
}

// ── Product ID normalizer ─────────────────────────────────────────────────────

function toProductId(name: string, category: string): string {
  const n = name.toLowerCase()
    .replace(/[àáâã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  const prefix = category === 'agriculture' ? '0010' :
                 category === 'energy' ? '0027' :
                 category === 'materials' ? '0072' :
                 category === 'manufactured' ? '0084' : '0099'
  return `${prefix}_${n}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌍 Feel The Gap — Bulk Opportunity Generator`)
  console.log(`   Mode: ${isDry ? 'DRY RUN' : 'LIVE INSERT'}`)
  if (forcedIsos) console.log(`   Forced ISOs: ${forcedIsos.join(', ')}`)
  console.log('')

  // Load all countries from DB
  const { data: allCountries, error: cErr } = await sb
    .from('countries')
    .select('id,name,region,sub_region,gdp_usd,total_imports_usd,top_import_text,renewable_pct,energy_cost_index')
    .order('total_imports_usd', { ascending: false })

  if (cErr || !allCountries) { console.error('Cannot load countries:', cErr); process.exit(1) }

  // Load existing opportunities country list
  const { data: existingOpps } = await sb.from('opportunities').select('country_iso')
  const doneCountries = new Set((existingOpps ?? []).map((o: {country_iso: string}) => o.country_iso))

  // Apply filters
  let targets = allCountries.filter((c: {id: string}) => {
    if (forcedIsos) return forcedIsos.includes(c.id)
    return !doneCountries.has(c.id)
  })

  // Load checkpoint (for resumed runs)
  const checkpoint = loadCheckpoint()
  if (!forcedIsos) targets = targets.filter((c: {id: string}) => !checkpoint.has(c.id))

  // Apply max batch size
  targets = targets.slice(0, maxCountries)

  console.log(`📋 ${targets.length} pays à traiter ce run (${doneCountries.size} en DB, ${checkpoint.size} checkpoint, max=${maxCountries})`)
  if (targets.length === 0) { console.log('✅ Tous les pays ont déjà des opportunités !'); return }

  let success = 0, errors = 0

  for (let i = 0; i < targets.length; i++) {
    const country = targets[i]
    const progress = `[${i + 1}/${targets.length}]`

    process.stdout.write(`${progress} ${country.name} (${country.id})... `)

    try {
      const locale: Locale = (country.lang as Locale) ?? 'fr'
      const prompt = localizeUserPrompt(buildPrompt(country), locale)
      // Retry with exponential backoff (rate limits)
      let text = ''
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const result = await generateText({
            model: nextGemini(GEMINI_MODEL),
            prompt,
            maxTokens: 2500,
          })
          text = result.text
          break
        } catch (retryErr: unknown) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr)
          if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
            const wait = attempt * 20000  // 20s, 40s, 60s, 80s
            process.stdout.write(`  [rate limit, attente ${wait/1000}s]... `)
            await new Promise(r => setTimeout(r, wait))
            if (attempt === 4) throw retryErr
          } else {
            throw retryErr
          }
        }
      }

      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
      const opps = JSON.parse(cleaned) as Array<{
        product_name: string; product_category: string; type: string
        gap_value_usd: number; opportunity_score: number
        labor_cost_index: number; infrastructure_score: number
        land_availability: string; summary: string
      }>

      if (!Array.isArray(opps) || opps.length === 0) throw new Error('Empty response')

      console.log(`✓ ${opps.length} opportunités`)

      if (!isDry) {
        const rows = opps.slice(0, MAX_OPPS_PER_COUNTRY).map(o => ({
          country_iso: country.id,
          product_id:  toProductId(o.product_name, o.product_category),
          type:        o.type,
          gap_value_usd:        Math.max(0, Math.round(o.gap_value_usd ?? 0)),
          opportunity_score:    Math.min(100, Math.max(0, Math.round(o.opportunity_score ?? 50))),
          labor_cost_index:     Math.min(100, Math.max(0, Math.round(o.labor_cost_index ?? 40))),
          infrastructure_score: Math.min(10,  Math.max(1, Math.round(o.infrastructure_score ?? 5))),
          land_availability:    ['high','medium','low','not_applicable'].includes(o.land_availability) ? o.land_availability : 'medium',
          summary:              o.summary?.slice(0, 1000) ?? '',
        }))

        const { error: insErr } = await sb.from('opportunities').insert(rows)
        if (insErr) {
          console.log(`  ⚠️  Insert error: ${insErr.message}`)
          errors++
        } else {
          success++
          checkpoint.add(country.id)
          saveCheckpoint(checkpoint)
        }
      } else {
        opps.forEach(o => console.log(`   → [${o.type}] ${o.product_name} (score: ${o.opportunity_score})`))
        success++
        checkpoint.add(country.id)
      }
    } catch (err: unknown) {
      console.log(`  ✗ ${err instanceof Error ? err.message : String(err)}`)
      errors++
    }

    // Rate limit delay (skip after last item)
    if (i < targets.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\n📊 Résultat: ${success} succès, ${errors} erreurs`)
  console.log(`✅ Terminé — ${isDry ? 'Dry run, rien inséré' : 'Opportunités insérées en DB'}`)

  // Clean checkpoint if all done
  if (!isDry && errors === 0) {
    try { fs.unlinkSync(CHECKPOINT_FILE) } catch { /* ignore */ }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
