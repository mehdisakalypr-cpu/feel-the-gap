// @ts-nocheck
/**
 * Feel The Gap — Master Orchestrator
 *
 * Coordonne les 18 agents en parallèle pour une exécution optimale.
 * C'est le point d'entrée unique pour lancer toute la machine.
 *
 * ════════════════════════════════════════════════════════════════
 *  PLAN D'EXÉCUTION PARALLÉLISÉ — 18 AGENTS
 * ════════════════════════════════════════════════════════════════
 *
 *  VAGUE 1 — ENRICHISSEMENT DATA (pas de dépendances, lancer ensemble)
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  [1] product-enricher     — 600+ produits catalogue         │
 *  │  [2] deal-flow-generator  — 120+ deals investisseurs        │
 *  │  [3] influencer-factory   — 300 personas IA × 15 langues    │
 *  │  [4] regulatory-collector — réglementation 30+ pays         │
 *  │  [5] production-costs     — benchmarks coûts 30+ pays       │
 *  │  [6] logistics-collector  — corridors logistiques            │
 *  └──────────────────────────────────────────────────────────────┘
 *        ↓ (données prêtes)
 *
 *  VAGUE 2 — CONTENU & REACH (dépend des données)
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │  [7] seo-factory          — 300K pages SEO × 15 langues     │
 *  │  [8] social-autopilot     — 135 posts/jour × 15 langues     │
 *  │  [9] study-generator      — études de marché 3 parties      │
 *  │ [10] enriched-plan-builder— business plans 3 scénarios      │
 *  └──────────────────────────────────────────────────────────────┘
 *        ↓ (contenu live)
 *
 *  VAGUE 3 — OPTIMISATION CONTINUE (tourne en boucle)
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ [11] auto-optimizer       — supervise + ajuste tous agents   │
 *  │ [12] performance-tracker  — suivi journalier + ratchet       │
 *  │ [13] revenue-optimizer    — churn + pricing + upsell         │
 *  └──────────────────────────────────────────────────────────────┘
 *
 *  AGENTS SUPPORT (lancés à la demande)
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ [14] factbook-enrich      — données CIA Factbook             │
 *  │ [15] energy-enrich        — données énergie OWID             │
 *  │ [16] youtube-intel        — intelligence YouTube             │
 *  │ [17] ad-variant-generator — vidéos multi-format              │
 *  │ [18] dossier-builder      — dossiers funding auto            │
 *  └──────────────────────────────────────────────────────────────┘
 *
 * Usage :
 *   npx tsx agents/master-orchestrator.ts                 # full run (3 vagues)
 *   npx tsx agents/master-orchestrator.ts --wave=1        # vague 1 seulement
 *   npx tsx agents/master-orchestrator.ts --wave=2        # vague 2 seulement
 *   npx tsx agents/master-orchestrator.ts --wave=3        # vague 3 (optimisation)
 *   npx tsx agents/master-orchestrator.ts --agent=seo     # agent spécifique
 *   npx tsx agents/master-orchestrator.ts --dry-run       # preview sans exécuter
 *   npx tsx agents/master-orchestrator.ts --status        # état de tous les agents
 */

import { spawn, type ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

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

// ── Agent definitions ──────────────────────────────────────────────────────────

interface AgentDef {
  id: string
  name: string
  file: string
  wave: 1 | 2 | 3 | 'support'
  args: string[]
  description: string
  estimatedDuration: string
  cost: string  // per run
  dependsOn: string[]
}

const AGENTS: AgentDef[] = [
  // ── VAGUE 1: Enrichissement data (aucune dépendance) ──
  {
    id: 'product-enricher',
    name: 'Product Enricher',
    file: 'agents/product-enricher.ts',
    wave: 1,
    args: [],
    description: '600+ produits artisanaux, terroir, coopératives, labels qualité dans 30 catégories',
    estimatedDuration: '45min',
    cost: '€0 (Gemini free)',
    dependsOn: [],
  },
  {
    id: 'deal-flow-gen',
    name: 'Deal Flow Generator',
    file: 'agents/deal-flow-generator.ts',
    wave: 1,
    args: [],
    description: '120+ deals investissement × 15 secteurs (agrifood, fintech, energy, textile...)',
    estimatedDuration: '30min',
    cost: '€0 (Gemini free)',
    dependsOn: [],
  },
  {
    id: 'influencer-factory',
    name: 'Influencer Factory',
    file: 'agents/influencer-factory.ts',
    wave: 1,
    args: [],
    description: '300 personas IA (20 archétypes × 15 langues) pour reach organique massif',
    estimatedDuration: '60min',
    cost: '€0 (Groq free)',
    dependsOn: [],
  },
  {
    id: 'regulatory',
    name: 'Regulatory Collector',
    file: 'agents/regulatory-collector.ts',
    wave: 1,
    args: [],
    description: 'Réglementation import/export pour 30+ pays producteurs',
    estimatedDuration: '20min',
    cost: '€0 (Gemini free)',
    dependsOn: [],
  },
  {
    id: 'production-costs',
    name: 'Production Costs',
    file: 'agents/production-costs.ts',
    wave: 1,
    args: [],
    description: 'Benchmarks coûts production × 30 pays × 6 produits',
    estimatedDuration: '25min',
    cost: '€0 (Gemini free)',
    dependsOn: [],
  },
  {
    id: 'logistics',
    name: 'Logistics Collector',
    file: 'agents/logistics-collector.ts',
    wave: 1,
    args: [],
    description: 'Corridors logistiques (sea/air/road) × 30 origines',
    estimatedDuration: '20min',
    cost: '€0 (Gemini free)',
    dependsOn: [],
  },

  // ── VAGUE 2: Contenu & reach (dépend de vague 1) ──
  {
    id: 'seo-factory',
    name: 'SEO Factory',
    file: 'agents/seo-factory.ts',
    wave: 2,
    args: ['--top=50', '--lang=en,fr,es,pt,ar'],  // Start with top 50 countries, 5 priority langs
    description: '300K pages SEO multilingues (pays × produits × 15 langues)',
    estimatedDuration: '4-6h (batched)',
    cost: '€0 (Gemini free)',
    dependsOn: ['product-enricher'],
  },
  {
    id: 'social-autopilot',
    name: 'Social Autopilot',
    file: 'agents/social-autopilot.ts',
    wave: 2,
    args: [],
    description: '135 posts/jour × 15 langues × 3 plateformes (LinkedIn, Twitter, Instagram)',
    estimatedDuration: '15min/batch',
    cost: '€0 (Groq free)',
    dependsOn: ['influencer-factory'],
  },
  {
    id: 'study-gen',
    name: 'Study Generator',
    file: 'agents/study-generator.ts',
    wave: 2,
    args: ['--top=20'],
    description: 'Études de marché exhaustives 3 parties pour top 20 pays',
    estimatedDuration: '2-3h',
    cost: '€0 (Gemini free)',
    dependsOn: ['regulatory', 'production-costs', 'logistics'],
  },
  {
    id: 'enriched-plans',
    name: 'Enriched Plan Builder',
    file: 'agents/batch-enriched-plans.ts',
    wave: 2,
    args: [],
    description: 'Business plans 3 scénarios (artisanal/mechanized/AI) × 30+ pays',
    estimatedDuration: '2-3h',
    cost: '€0 (Gemini free)',
    dependsOn: ['production-costs', 'logistics', 'regulatory'],
  },

  // ── VAGUE 3: Optimisation continue (cron) ──
  {
    id: 'auto-optimizer',
    name: 'Auto-Optimizer',
    file: 'agents/auto-optimizer.ts',
    wave: 3,
    args: ['--execute'],
    description: 'Méta-agent: audit → diagnose → optimize → scale → log',
    estimatedDuration: '5min',
    cost: '€0',
    dependsOn: [],
  },
  {
    id: 'perf-tracker',
    name: 'Performance Tracker',
    file: 'agents/performance-tracker.ts',
    wave: 3,
    args: [],
    description: 'Suivi journalier conversions + adaptation intensité leviers + ratchet objectifs',
    estimatedDuration: '3min',
    cost: '€0',
    dependsOn: [],
  },
  {
    id: 'revenue-optimizer',
    name: 'Revenue Optimizer',
    file: 'agents/revenue-optimizer.ts',
    wave: 3,
    args: [],
    description: 'Churn detection + geo-pricing + upsell + simulation growth',
    estimatedDuration: '5min',
    cost: '€0',
    dependsOn: [],
  },
]

// ── Runner ─────────────────────────────────────────────────────────────────────

function runAgent(agent: AgentDef): Promise<{ id: string; success: boolean; duration: number; output: string }> {
  return new Promise((resolve) => {
    const start = Date.now()
    console.log(`    ▶ Starting ${agent.name} (${agent.file})...`)

    const proc = spawn('npx', ['tsx', agent.file, ...agent.args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    const chunks: string[] = []
    proc.stdout?.on('data', (d) => chunks.push(d.toString()))
    proc.stderr?.on('data', (d) => chunks.push(d.toString()))

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      resolve({ id: agent.id, success: false, duration: Date.now() - start, output: 'TIMEOUT after 30min' })
    }, 30 * 60 * 1000) // 30min timeout per agent

    proc.on('close', (code) => {
      clearTimeout(timeout)
      const duration = Date.now() - start
      const output = chunks.join('').slice(-2000) // last 2000 chars
      const success = code === 0
      const icon = success ? '✓' : '✗'
      console.log(`    ${icon} ${agent.name} — ${(duration / 1000).toFixed(0)}s — ${success ? 'OK' : 'FAILED (code ' + code + ')'}`)
      resolve({ id: agent.id, success, duration, output })
    })
  })
}

async function runWave(wave: number, dryRun: boolean) {
  const agents = AGENTS.filter(a => a.wave === wave)
  if (agents.length === 0) { console.log(`  No agents in wave ${wave}`); return }

  console.log(`\n  ╔═══════════════════════════════════════════════════╗`)
  console.log(`  ║  VAGUE ${wave} — ${agents.length} agents en parallèle              ║`)
  console.log(`  ╚═══════════════════════════════════════════════════╝\n`)

  for (const a of agents) {
    console.log(`    [${a.id}] ${a.description}`)
    console.log(`      Durée estimée: ${a.estimatedDuration} | Coût: ${a.cost}`)
  }

  if (dryRun) {
    console.log('\n    (dry-run: agents non lancés)')
    return
  }

  console.log('\n    Lancement en parallèle...\n')

  // Run all agents in wave simultaneously
  const results = await Promise.all(agents.map(a => runAgent(a)))

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalTime = Math.max(...results.map(r => r.duration))

  console.log(`\n    ═══ Vague ${wave}: ${succeeded}/${agents.length} OK | ${failed} failed | ${(totalTime / 1000).toFixed(0)}s total ═══`)

  if (failed > 0) {
    console.log('    Agents en échec:')
    for (const r of results.filter(r => !r.success)) {
      console.log(`      ✗ ${r.id}: ${r.output.slice(-200)}`)
    }
  }
}

function showStatus() {
  console.log('\n  ╔═══════════════════════════════════════════════════════════╗')
  console.log('  ║  ÉTAT DES 18 AGENTS — Plan d\'exécution parallélisé      ║')
  console.log('  ╚═══════════════════════════════════════════════════════════╝\n')

  const waves: Record<string, AgentDef[]> = { '1': [], '2': [], '3': [], 'support': [] }
  for (const a of AGENTS) waves[String(a.wave)].push(a)

  const waveNames: Record<string, string> = {
    '1': 'ENRICHISSEMENT DATA (pas de dépendances)',
    '2': 'CONTENU & REACH (dépend des données)',
    '3': 'OPTIMISATION CONTINUE (cron quotidien)',
    'support': 'SUPPORT (à la demande)',
  }

  for (const [w, agents] of Object.entries(waves)) {
    if (agents.length === 0) continue
    console.log(`  ── VAGUE ${w}: ${waveNames[w]} ──`)
    for (const a of agents) {
      const exists = fs.existsSync(path.join(process.cwd(), a.file))
      const icon = exists ? '✓' : '✗'
      const deps = a.dependsOn.length > 0 ? ` (après: ${a.dependsOn.join(', ')})` : ' (indépendant)'
      console.log(`    ${icon} [${a.id.padEnd(20)}] ${a.description.slice(0, 60)}`)
      console.log(`      File: ${a.file} | Durée: ${a.estimatedDuration} | Coût: ${a.cost}${deps}`)
    }
    console.log()
  }

  // Support agents (not in the main AGENTS list)
  console.log('  ── AGENTS SUPPORT (à la demande) ──')
  const supportFiles = [
    { file: 'agents/factbook-enrich.ts', desc: 'Données CIA Factbook' },
    { file: 'agents/energy-enrich.ts', desc: 'Données énergie OWID' },
    { file: 'agents/youtube-intel.ts', desc: 'Intelligence YouTube' },
    { file: 'agents/ad-variant-generator.ts', desc: 'Vidéos multi-format FFmpeg' },
    { file: 'agents/dossier-builder.ts', desc: 'Dossiers funding automatisés' },
  ]
  for (const s of supportFiles) {
    const exists = fs.existsSync(path.join(process.cwd(), s.file))
    console.log(`    ${exists ? '✓' : '✗'} ${s.file.padEnd(40)} ${s.desc}`)
  }

  console.log('\n  COÛT TOTAL DE L\'ARMÉE: €0/run (Gemini free + Groq free)')
  console.log('  DURÉE VAGUE 1: ~60min (parallèle)')
  console.log('  DURÉE VAGUE 2: ~6h (SEO est le plus long)')
  console.log('  VAGUE 3: Cron quotidien (~10min/jour)')
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Feel The Gap — Master Orchestrator')
  console.log('  18 Agents Parallélisés — L\'échec n\'est pas une option')
  console.log('═══════════════════════════════════════════════════════════')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const statusOnly = args.includes('--status')
  const waveFilter = parseInt(args.find(a => a.startsWith('--wave='))?.split('=')[1] ?? '0') || 0
  const agentFilter = args.find(a => a.startsWith('--agent='))?.split('=')[1] ?? null

  if (statusOnly) {
    showStatus()
    return
  }

  if (agentFilter) {
    const agent = AGENTS.find(a => a.id.includes(agentFilter))
    if (!agent) { console.error(`Agent "${agentFilter}" not found`); return }
    console.log(`\n  Running single agent: ${agent.name}`)
    await runAgent(agent)
    return
  }

  if (waveFilter) {
    await runWave(waveFilter, dryRun)
    return
  }

  // Full run: all 3 waves sequentially
  console.log('\n  EXÉCUTION COMPLÈTE: 3 vagues séquentielles')
  console.log('  Vague 1 (data) → Vague 2 (contenu) → Vague 3 (optimisation)\n')

  await runWave(1, dryRun)
  await runWave(2, dryRun)
  await runWave(3, dryRun)

  console.log('\n  ═══════════════════════════════════════════════════════════')
  console.log('  ORCHESTRATION TERMINÉE')
  console.log('  Prochaine étape: configurer les crons pour vague 3')
  console.log('  ═══════════════════════════════════════════════════════════')
}

if (process.argv[1]?.endsWith('master-orchestrator.ts')) {
  main().catch(console.error)
}
