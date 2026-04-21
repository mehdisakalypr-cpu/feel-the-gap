// @ts-nocheck
/**
 * method-scribe.ts — Production 3.0 v2 generator (Shaka 2026-04-21)
 *
 * Génère le contenu riche (process_steps, diagrams, comparison_table, graph_data,
 * pros_cons) pour les méthodes de production manquantes ou vides.
 *
 * Deux modes :
 *   a) Produit sans méthode → génère N=4-6 méthodes avec tout le contenu riche
 *   b) Produit avec méthodes existantes mais champs JSONB vides → enrichit
 *
 * Usage :
 *   npx tsx agents/method-scribe.ts --max-products=10 --concurrency=2 --lang=fr
 *   npx tsx agents/method-scribe.ts --product-slug=rice          # ciblé
 *   npx tsx agents/method-scribe.ts --enrich-empty-only          # saute produits complets
 *
 * Le script utilise la cascade LLM (Gemini → Groq → Mistral → Cerebras → OpenAI).
 * Idempotent : reruns safe, upsert par (product_slug, name).
 */
import { loadEnv } from '../lib/env'
import { createClient } from '@supabase/supabase-js'
import { initProviders, gen } from './providers'

loadEnv()
initProviders()

type CliArgs = {
  maxProducts: number
  concurrency: number
  lang: string
  productSlug?: string
  enrichEmptyOnly: boolean
}

function parseArgs(): CliArgs {
  const out: CliArgs = { maxProducts: 20, concurrency: 2, lang: 'fr', enrichEmptyOnly: false }
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=')
    if (k === 'max-products' && v) out.maxProducts = Number(v)
    if (k === 'concurrency' && v) out.concurrency = Number(v)
    if (k === 'lang' && v) out.lang = v
    if (k === 'product-slug' && v) out.productSlug = v
    if (k === 'enrich-empty-only') out.enrichEmptyOnly = true
  }
  return out
}

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

// ── Prompt & JSON schema ─────────────────────────────────────────────────

const PROMPT_TEMPLATE = (productName: string, productSlug: string, lang: string) => `Tu es un expert en procédés industriels et agricoles. Pour le produit **"${productName}"** (slug: ${productSlug}), décris de manière détaillée 4-6 méthodes de production distinctes, depuis l'artisanal jusqu'à l'industriel IA.

Langue de sortie : ${lang === 'fr' ? 'FRANÇAIS' : 'ENGLISH'}.

**Contraintes qualité** :
- Chaque méthode doit être RÉALISTE et distincte (pas de copies-collées)
- Les valeurs chiffrées doivent être cohérentes entre méthodes (capex, opex, rendement)
- Le tableau de comparaison doit OPPOSER les méthodes (valeurs différentes selon méthode)
- Les étapes doivent être SPÉCIFIQUES à la méthode (pas génériques)

**Format JSON strict** (pas de markdown, pas de commentaire) :
{
  "methods": [
    {
      "name": "Artisanal traditionnel",
      "popularity_rank": 1,
      "description_md": "80-120 mots décrivant la méthode, son contexte d'usage typique, qui la pratique.",
      "process_steps_json": [
        {"order": 1, "title": "Étape courte", "description_md": "60-100 mots pratiques: gestes, timing, repères, pièges", "duration": "2 heures / 3 jours / 2 semaines", "icon": "🌾"}
      ],
      "diagrams_json": [
        {
          "id": "flow-main",
          "title": "Flux principal du process",
          "type": "flow",
          "nodes": [{"id": "n1", "label": "Étape 1"}, {"id": "n2", "label": "Étape 2"}],
          "edges": [{"from": "n1", "to": "n2", "label": "2h"}]
        }
      ],
      "comparison_table_json": {
        "headers": ["Critère", "Cette méthode", "Autre méthode 1", "Autre méthode 2"],
        "rows": [
          ["Coût /kg (€)", "1.20", "0.80", "2.50"],
          ["Rendement (kg/ha ou /j)", "500", "800", "2000"],
          ["Capex (€)", "500", "5000", "50000"],
          ["Qualité /10", "9", "6", "7"],
          ["Main d'œuvre", "4 p/ha", "2 p/ha", "0.5 p/ha"]
        ]
      },
      "graph_data_json": {
        "type": "bar",
        "xKey": "category",
        "series": [{"name": "€/kg", "dataKey": "cost", "color": "#C9A84C"}],
        "data": [
          {"category": "Main d'œuvre", "cost": 0.70},
          {"category": "Matières", "cost": 0.30},
          {"category": "Énergie", "cost": 0.10},
          {"category": "Amortissement", "cost": 0.10}
        ]
      },
      "pros_cons_json": {
        "pros": ["Force 1 concrète", "Force 2", "Force 3"],
        "cons": ["Faiblesse 1 concrète", "Faiblesse 2"]
      }
    }
  ]
}

**Règles popularity_rank** : 1 = méthode la plus couramment pratiquée (souvent artisanale dans pays en dev). N = méthode la plus rare.

**Exemples de méthodes selon produit** :
- riz → Aquacole traditionnel, SRI (System of Rice Intensification), Mécanisé plein champ, Hydroponique serre, Vertical farming IA
- café → Cerise entière séchage soleil, Lavé artisanal, Honey process, Mécanisé voie humide, Robusta mécanisé plein champ
- textile → Tissage main, Métier semi-auto, Industriel navette, Jet d'air, Composite CNC
- cacao → Fermentation caisses bois, Fermentation bâches, Mécanisé industriel
- pomme de terre → Manuel bêche, Attelage tracteur, Mécanisé complet, Hydroponique serre

Génère **exactement 4-6 méthodes** diversifiées par niveau de mécanisation/échelle.`

// ── DB operations ─────────────────────────────────────────────────────────

/**
 * Products table uses `id` as primary key (ex: "0010_rice", "0010_cafe_arabica").
 * production_methods uses `product_slug` — les 7 existants ont des slugs courts
 * historiques (rice, cafe, cacao…). Pour la généralisation, on utilise `products.id`
 * comme `product_slug` (stable, unique, lié au HS code). Les 7 rows existants
 * restent indépendantes (référencent legacy slugs) et seront migrées plus tard.
 */
function productSlug(p: { id: string }): string {
  return p.id
}

async function fetchTargetProducts(sb, args: CliArgs) {
  if (args.productSlug) {
    const { data } = await sb
      .from('products')
      .select('id, name, name_fr, category')
      .or(`id.eq.${args.productSlug},id.ilike.%${args.productSlug}%`)
      .limit(5)
    return data ?? []
  }

  // Fetch all products + existing methods in parallel
  const [{ data: prods }, { data: methods }] = await Promise.all([
    sb.from('products').select('id, name, name_fr, category').order('id'),
    sb.from('production_methods').select('product_slug, process_steps_json, diagrams_json, comparison_table_json, pros_cons_json'),
  ])

  const bySlug: Record<string, { hasAny: boolean; allEmpty: boolean }> = {}
  for (const m of methods ?? []) {
    const slug = m.product_slug as string
    const hasRich =
      (Array.isArray(m.process_steps_json) && m.process_steps_json.length > 0) ||
      (Array.isArray(m.diagrams_json) && m.diagrams_json.length > 0) ||
      (m.comparison_table_json && Object.keys(m.comparison_table_json).length > 0)
    bySlug[slug] = bySlug[slug] ?? { hasAny: false, allEmpty: true }
    bySlug[slug].hasAny = true
    if (hasRich) bySlug[slug].allEmpty = false
  }

  const filtered = (prods ?? []).filter(p => {
    const slug = productSlug(p)
    const state = bySlug[slug]
    if (!state) return true  // aucune méthode → à générer
    if (state.allEmpty) return true  // méthodes existent mais vides → enrichir
    return false  // déjà riche (process_steps/diagrams/comparison non vides)
  })

  return filtered.slice(0, args.maxProducts)
}

function extractJson(raw: string): { methods?: any[] } {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  let end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM output')

  // Première tentative straight
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {}

  // Recovery : output truncated mid-array. On coupe au dernier "}" avant un "]" valide
  // et on clôture les structures.
  const candidate = cleaned.slice(start, end + 1)
  // Trouve le dernier objet complet dans "methods"
  const methodsStart = candidate.indexOf('"methods"')
  if (methodsStart !== -1) {
    const arrStart = candidate.indexOf('[', methodsStart)
    if (arrStart !== -1) {
      // Trouve dernière occurrence de "}," (séparateur entre méthodes) et coupe là
      const lastSep = candidate.lastIndexOf('},', candidate.length)
      if (lastSep > arrStart) {
        const repaired = candidate.slice(0, lastSep + 1) + ']}'
        try {
          return JSON.parse(repaired)
        } catch {}
      }
    }
  }
  throw new Error('JSON parse failed + recovery impossible')
}

async function upsertMethodsForProduct(sb, product, methods: any[]) {
  let upserted = 0
  const slug = productSlug(product)
  for (const m of methods) {
    if (!m.name || !m.description_md) continue
    const { error } = await sb.from('production_methods').upsert(
      {
        product_slug: slug,
        name: m.name,
        description_md: m.description_md,
        popularity_rank: m.popularity_rank ?? 99,
        process_steps_json: m.process_steps_json ?? [],
        diagrams_json: m.diagrams_json ?? [],
        comparison_table_json: m.comparison_table_json ?? {},
        graph_data_json: m.graph_data_json ?? {},
        pros_cons_json: m.pros_cons_json ?? { pros: [], cons: [] },
      },
      { onConflict: 'product_slug,name' },
    )
    if (!error) upserted++
    else console.error(`  ✗ upsert ${product.slug}/${m.name}:`, error.message)
  }
  return upserted
}

// ── Main loop ─────────────────────────────────────────────────────────────

async function processProduct(sb, product) {
  const name = product.name_fr || product.name
  const slug = productSlug(product)
  const prompt = PROMPT_TEMPLATE(name, slug, 'fr')
  console.log(`\n🧘 ${slug} (${name})`)
  try {
    const raw = await gen(prompt, 16000)  // large — JSON riche peut atteindre 20k+ tokens
    const parsed = extractJson(raw)
    const methods = parsed.methods ?? []
    if (!Array.isArray(methods) || methods.length === 0) {
      console.error(`  ✗ No methods in LLM output`)
      return 0
    }
    const n = await upsertMethodsForProduct(sb, product, methods)
    console.log(`  ✓ ${n}/${methods.length} methods upserted`)
    return n
  } catch (e) {
    console.error(`  ✗ fail:`, (e as Error).message)
    return 0
  }
}

async function main() {
  const args = parseArgs()
  const sb = db()
  const targets = await fetchTargetProducts(sb, args)
  console.log(`🧘 method-scribe : ${targets.length} products à enrichir (concurrency=${args.concurrency})`)

  if (targets.length === 0) {
    console.log('✓ Aucun produit à traiter.')
    return
  }

  // Concurrency via batches
  let totalMethods = 0
  for (let i = 0; i < targets.length; i += args.concurrency) {
    const batch = targets.slice(i, i + args.concurrency)
    const results = await Promise.all(batch.map(p => processProduct(sb, p)))
    totalMethods += results.reduce((a, b) => a + b, 0)
  }

  console.log(`\n✓ Terminé — ${totalMethods} méthodes sur ${targets.length} produits.`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
