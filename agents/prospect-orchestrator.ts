/**
 * prospect-orchestrator — runs all 4 directory scouts for a given
 * opportunity (country × sector × product). Meant to be fired per active
 * opportunity from a cron so prospection DBs grow without manual ops.
 *
 * Usage:
 *   npx tsx agents/prospect-orchestrator.ts --country=CI --sector=agriculture --product=cajou
 *   npx tsx agents/prospect-orchestrator.ts --country=SN --sector=agriculture --product=arachide --apply
 *   npx tsx agents/prospect-orchestrator.ts --all   # iterates all active opportunities (impl TBD)
 */
import { spawn } from 'node:child_process'

type Args = { country?: string; sector?: string; product?: string; apply?: boolean; max?: number }
const args: Args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v === undefined ? true : v]
})) as any

if (!args.country || !args.sector) {
  console.error('usage: tsx prospect-orchestrator.ts --country=CI --sector=agriculture [--product=cajou] [--apply] [--max=30]')
  process.exit(1)
}

const MAX = args.max ?? 30
const APPLY = args.apply ? '--apply' : ''

async function run(script: string, flags: string[]): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn('npx', ['--yes', 'tsx', script, ...flags.filter(Boolean)], { stdio: 'inherit' })
    p.on('close', code => resolve(code ?? 0))
  })
}

;(async () => {
  console.log(`\n━━━━━━ PROSPECT ORCHESTRATOR ━━━━━━`)
  console.log(`country=${args.country} sector=${args.sector} product=${args.product ?? '-'} apply=${!!args.apply} max=${MAX}`)

  // 1. Local buyers (priority — route vers le succès débouchés)
  if (args.product) {
    console.log(`\n1/4 local-buyers`)
    await run('agents/local-buyers-scout.ts', [`--country=${args.country}`, `--product=${args.product}`, `--max=${MAX}`, APPLY])
  } else { console.log(`\n1/4 local-buyers — skipped (no product)`) }

  // 2. Exporters
  if (args.product) {
    console.log(`\n2/4 exporters`)
    await run('agents/exporters-scout.ts', [`--country=${args.country}`, `--product=${args.product}`, `--max=${MAX}`, APPLY])
  } else { console.log(`\n2/4 exporters — skipped (no product)`) }

  // 3. Investors (sector-based, region= country ISO)
  console.log(`\n3/4 investors`)
  await run('agents/investors-scout.ts', [`--sector=${args.sector}`, `--region=${args.country}`, `--max=${MAX}`, APPLY])

  // 4. Entrepreneurs
  console.log(`\n4/4 entrepreneurs`)
  await run('agents/entrepreneurs-scout.ts', [`--country=${args.country}`, `--sector=${args.sector}`, ...(args.product ? [`--product=${args.product}`] : []), `--max=${MAX}`, APPLY])

  console.log(`\n✓ done.`)
})().catch(e => { console.error(e); process.exit(1) })
