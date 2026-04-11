// @ts-nocheck
/**
 * Feel The Gap — Status Check (Minato Entry Point)
 *
 * Script à lancer SYSTÉMATIQUEMENT au début de chaque session Claude
 * pour connaître l'état exact du projet et éviter tout doublon.
 *
 * Vérifie :
 *  1. Toutes les tables DB avec counts exacts
 *  2. État des migrations Supabase
 *  3. État du build Next.js
 *  4. État pm2
 *  5. Crons configurés
 *  6. Git status (travail non commité)
 *
 * Usage :
 *   npx tsx agents/status-check.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

const TABLES = [
  // Core
  { name: 'countries', target: 200, label: 'Pays' },
  { name: 'products_catalog', target: 10000, label: 'Produits catalogue' },
  { name: 'opportunities', target: 10000, label: 'Opportunités' },
  { name: 'reports', target: 200, label: 'Rapports pays' },
  { name: 'business_plans', target: 200, label: 'Business plans' },
  // Research agents
  { name: 'youtube_insights', target: 500, label: 'YouTube insights' },
  { name: 'production_cost_benchmarks', target: 5000, label: 'Benchmarks coûts' },
  { name: 'logistics_corridors', target: 2000, label: 'Corridors logistiques' },
  { name: 'country_regulations', target: 500, label: 'Réglementations' },
  // Scale agents
  { name: 'seo_pages', target: 300000, label: 'Pages SEO' },
  { name: 'social_posts', target: 5000, label: 'Posts social' },
  { name: 'ai_influencer_personas', target: 300, label: 'Personas IA' },
  { name: 'deal_flows', target: 500, label: 'Deal flows' },
  { name: 'email_templates', target: 150, label: 'Templates email' },
  { name: 'market_trends', target: 500, label: 'Market trends' },
  // Performance
  { name: 'daily_performance', target: 30, label: 'Perf quotidienne' },
  { name: 'auto_optimizer_log', target: 100, label: 'Logs optimizer' },
  { name: 'lever_intensity', target: 8, label: 'Leviers intensité' },
  { name: 'performance_targets', target: 8, label: 'Targets perf' },
  // Users & revenue
  { name: 'profiles', target: 1000, label: 'Profils utilisateurs' },
  { name: 'credit_transactions', target: 100, label: 'Transactions crédits' },
  // Funding
  { name: 'funding_requests', target: 100, label: 'Demandes financement' },
]

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  FEEL THE GAP — STATUS CHECK (Minato Entry Point)          ║')
  console.log('║  Vérification systématique avant toute action               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // 1. DB Table counts
  console.log('═══ 1. DATABASE TABLES ═══\n')
  console.log('  Table                        │ Count   │ Target  │ %     │ Status')
  console.log('  ─────────────────────────────┼─────────┼─────────┼───────┼────────')

  let totalCount = 0
  let totalTarget = 0
  const missing: string[] = []

  for (const t of TABLES) {
    const { count, error } = await sb.from(t.name).select('*', { count: 'exact', head: true })
    const c = count ?? 0
    const pct = t.target > 0 ? Math.round((c / t.target) * 100) : 0
    const status = error ? '⚠ MISSING' : pct >= 100 ? '✅ DONE' : pct >= 50 ? '🔶 WIP' : pct > 0 ? '🔹 STARTED' : '⭕ EMPTY'

    if (error) missing.push(t.name)

    const nameStr = `${t.label} (${t.name})`.padEnd(29)
    const countStr = String(c).padStart(7)
    const targetStr = String(t.target).padStart(7)
    const pctStr = `${pct}%`.padStart(5)

    console.log(`  ${nameStr} │ ${countStr} │ ${targetStr} │ ${pctStr} │ ${status}`)

    totalCount += c
    totalTarget += t.target
  }

  console.log('  ─────────────────────────────┼─────────┼─────────┼───────┼────────')
  console.log(`  ${'TOTAL'.padEnd(29)} │ ${String(totalCount).padStart(7)} │ ${String(totalTarget).padStart(7)} │ ${Math.round((totalCount / totalTarget) * 100)}%`.padEnd(5) + `   │`)

  if (missing.length > 0) {
    console.log(`\n  ⚠ Tables manquantes: ${missing.join(', ')}`)
  }

  // 2. Agent files check
  console.log('\n═══ 2. AGENTS ═══\n')
  const agentDir = path.join(process.cwd(), 'agents')
  const agentFiles = fs.readdirSync(agentDir).filter(f => f.endsWith('.ts') && !f.startsWith('_'))
  console.log(`  ${agentFiles.length} agents trouvés:`)
  for (const f of agentFiles.sort()) {
    console.log(`    ✓ ${f}`)
  }

  // 3. Crons
  console.log('\n═══ 3. CRONS (vercel.json) ═══\n')
  try {
    const vj = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'))
    for (const c of (vj.crons ?? [])) {
      console.log(`  ⏰ ${c.path.padEnd(30)} ${c.schedule}`)
    }
  } catch { console.log('  ⚠ vercel.json non lisible') }

  // 4. Migrations count
  console.log('\n═══ 4. MIGRATIONS ═══\n')
  const migDir = path.join(process.cwd(), 'supabase', 'migrations')
  if (fs.existsSync(migDir)) {
    const migs = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort()
    console.log(`  ${migs.length} migrations`)
    console.log(`  Dernière: ${migs[migs.length - 1]}`)
  }

  // 5. Summary & next actions
  console.log('\n═══ 5. RÉSUMÉ & PROCHAINES ACTIONS ═══\n')

  const priorities: string[] = []
  for (const t of TABLES) {
    const { count, error } = await sb.from(t.name).select('*', { count: 'exact', head: true })
    if (error) continue
    const c = count ?? 0
    const pct = t.target > 0 ? Math.round((c / t.target) * 100) : 0
    if (pct < 50 && t.target > 10) {
      priorities.push(`${t.label}: ${c}/${t.target} (${pct}%) — PRIORITY`)
    }
  }

  if (priorities.length > 0) {
    console.log('  Tables à enrichir en priorité:')
    for (const p of priorities) console.log(`    → ${p}`)
  } else {
    console.log('  ✅ Toutes les tables sont au-dessus de 50% de leur cible')
  }

  console.log('\n══════════════════════════════════════════════════════════════')
}

if (process.argv[1]?.endsWith('status-check.ts')) {
  main().catch(console.error)
}
