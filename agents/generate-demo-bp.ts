// @ts-nocheck
/**
 * FTG — Demo BP Generator
 *
 * Pré-génère un "Demo Business Plan" teaser par opportunité :
 *   - Structure complète (15 sections)
 *   - 2 sections rendues en clair (Résumé exécutif + Marché)
 *   - 13 sections avec preview 1re ligne uniquement + lock overlay
 *
 * Stockage : public.demo_bps.
 * Conso LLM : 1 demo ≈ 3-5 Gemini calls (rotation 4 clés = 80 rpm).
 *
 * Usage:
 *   npx tsx agents/generate-demo-bp.ts              # tous opps manquants
 *   npx tsx agents/generate-demo-bp.ts --max=100    # batch limit
 *   npx tsx agents/generate-demo-bp.ts --iso=CIV    # 1 pays
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 0) continue
    const k = t.slice(0, idx).trim()
    const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

const GEMINI_KEYS = [
  process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_2,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_3,
  process.env.GOOGLE_GENERATIVE_AI_API_KEY_4,
].filter(Boolean) as string[]
let keyIdx = 0
function nextGemini(m: string) {
  const k = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length]
  keyIdx++
  return createGoogleGenerativeAI({ apiKey: k })(m)
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const SECTION_SLUGS = [
  'executive_summary',
  'market_analysis',
  'competitive_landscape',
  'target_customers',
  'value_proposition',
  'pricing_strategy',
  'distribution_channels',
  'operations_plan',
  'supply_chain',
  'marketing_plan',
  'team_structure',
  'financial_projections',
  'funding_requirements',
  'risk_analysis',
  'roadmap_milestones',
]
const PREVIEW_SLUGS = new Set(['executive_summary', 'market_analysis'])

async function generateDemo(opp: any): Promise<{
  preview_sections: Record<string, string>
  locked_sections: Record<string, string>
  rendered_markdown: string
}> {
  const country = opp.country_iso
  const product = opp.product_name
  const gap = opp.gap_value_usd

  const preview: Record<string, string> = {}
  const locked: Record<string, string> = {}

  // 2 sections en clair (preview)
  const previewPrompt = `Tu es un consultant export senior. Rédige 2 sections détaillées (800 mots chacune) d'un business plan pour l'opportunité:
- Produit: ${product}
- Pays cible: ${country}
- Gap import/export: $${gap.toLocaleString()} USD
- Type: ${opp.type}

Section 1 — RÉSUMÉ EXÉCUTIF (markdown, bullet points, chiffres concrets)
Section 2 — ANALYSE DE MARCHÉ (taille, croissance, acteurs clés, tendances)

Format: retourne JSON strict {"executive_summary": "...", "market_analysis": "..."}`

  try {
    const { text } = await generateText({ model: nextGemini('gemini-2.5-flash'), prompt: previewPrompt, maxTokens: 4000 })
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    preview.executive_summary = parsed.executive_summary || '(erreur génération)'
    preview.market_analysis = parsed.market_analysis || '(erreur génération)'
  } catch (e: any) {
    preview.executive_summary = `# Résumé exécutif — ${product} / ${country}\n\nOpportunité identifiée sur ce produit dans ce marché. Gap estimé: $${gap.toLocaleString()}. Contenu détaillé disponible dans la version complète.`
    preview.market_analysis = `# Analyse de marché\n\nÉtude complète disponible dans la version payante.`
  }

  // 13 sections lock — 1re ligne teaser chacune
  const lockPrompt = `Pour chaque section d'un BP ${product}/${country}, rédige UNIQUEMENT la 1re phrase d'accroche (teaser, 1 ligne, donne envie) en JSON strict:
{
  "competitive_landscape": "…",
  "target_customers": "…",
  "value_proposition": "…",
  "pricing_strategy": "…",
  "distribution_channels": "…",
  "operations_plan": "…",
  "supply_chain": "…",
  "marketing_plan": "…",
  "team_structure": "…",
  "financial_projections": "…",
  "funding_requirements": "…",
  "risk_analysis": "…",
  "roadmap_milestones": "…"
}`
  try {
    const { text } = await generateText({ model: nextGemini('gemini-2.5-flash'), prompt: lockPrompt, maxTokens: 2000 })
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    Object.assign(locked, JSON.parse(cleaned))
  } catch {
    for (const s of SECTION_SLUGS.filter((x) => !PREVIEW_SLUGS.has(x))) {
      locked[s] = `Contenu complet disponible en version payante.`
    }
  }

  // Rendered markdown (preview sections en clair + locked avec placeholder)
  const md: string[] = []
  for (const slug of SECTION_SLUGS) {
    const title = slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    if (PREVIEW_SLUGS.has(slug)) {
      md.push(`## ${title}\n\n${preview[slug]}\n`)
    } else {
      md.push(`## ${title} 🔒\n\n> ${locked[slug] ?? 'Section réservée aux abonnés.'}\n\n*[Débloquer la section complète →]*\n`)
    }
  }

  return {
    preview_sections: preview,
    locked_sections: locked,
    rendered_markdown: md.join('\n'),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const maxArg = args.find((a) => a.startsWith('--max='))
  const isoArg = args.find((a) => a.startsWith('--iso='))
  const max = maxArg ? parseInt(maxArg.split('=')[1]) : 100
  const iso = isoArg ? isoArg.split('=')[1] : null

  // Fetch opps sans demo
  let q = sb
    .from('opportunities')
    .select('id, country_iso, product_name, type, gap_value_usd')
    .order('opportunity_score', { ascending: false })
    .limit(max)
  if (iso) q = q.eq('country_iso', iso)

  const { data: opps, error } = await q
  if (error) throw error

  const { data: existing } = await sb.from('demo_bps').select('opportunity_id')
  const existingSet = new Set((existing || []).map((r: any) => r.opportunity_id))
  const todo = (opps || []).filter((o: any) => !existingSet.has(o.id))

  console.log(`[demo-bp] ${todo.length} opps à générer (${opps?.length} fetched, ${existingSet.size} déjà faites)`)

  let done = 0
  for (const opp of todo) {
    try {
      const demo = await generateDemo(opp)
      const { error: insertErr } = await sb.from('demo_bps').insert({
        opportunity_id: opp.id,
        preview_sections: demo.preview_sections,
        locked_sections: demo.locked_sections,
        rendered_markdown: demo.rendered_markdown,
      })
      if (insertErr) {
        console.error(`  ✗ ${opp.country_iso}/${opp.product_name}: ${insertErr.message}`)
        continue
      }
      done++
      if (done % 10 === 0) console.log(`  [${done}/${todo.length}] ${opp.country_iso}/${opp.product_name}`)
      await new Promise((r) => setTimeout(r, 800)) // throttle light, rotation gère le vrai rate-limit
    } catch (e: any) {
      console.error(`  ✗ ${opp.country_iso}/${opp.product_name}: ${e.message}`)
    }
  }

  console.log(`[demo-bp] done: ${done} demos generated`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
