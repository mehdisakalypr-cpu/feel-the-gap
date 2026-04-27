/**
 * Lead Vault CLI runner
 *
 * Usage:
 *   npx tsx scripts/leads-vault/run.ts sirene --limit=1000 [--dry-run]
 *   npx tsx scripts/leads-vault/run.ts companies-house --limit=1000
 *   npx tsx scripts/leads-vault/run.ts osm --limit=500
 *   npx tsx scripts/leads-vault/run.ts verify --limit=500
 *   npx tsx scripts/leads-vault/run.ts sync [--project=ftg]
 *   npx tsx scripts/leads-vault/run.ts all
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import {
  runSireneIngest,
  runCompaniesHouseIngest,
  runHandelsregisterIngest,
  runMercantilEsIngest,
  runRegistroimpreseItIngest,
  runOpenCorporatesIngest,
  runEoriValidate,
  runOsmIngest,
  runCommonCrawlIngest,
  runMailscoutVerify,
  runProjectSync,
  runPersonsUkCh,
  runPersonsFrInpi,
  runPersonsNoBrreg,
  runPersonsFiPrh,
  runPersonsCzAres,
  runPersonsEeAriregister,
  runPersonsGithub,
  runPersonsWikidata,
  runPersonsSecEdgar,
  runDomainSearch,
  runOpenOwnershipIngest,
  runOpenSanctionsIngest,
  runIcijOffshoreIngest,
} from '../../lib/leads-core'

function parseArgs(argv: string[]): { command: string; opts: Record<string, string | boolean> } {
  const command = argv[2] ?? 'help'
  const opts: Record<string, string | boolean> = {}
  for (const arg of argv.slice(3)) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      opts[k] = v ?? true
    }
  }
  return { command, opts }
}

async function main(): Promise<void> {
  const { command, opts } = parseArgs(process.argv)
  const limit = opts.limit ? Number(opts.limit) : undefined
  const dryRun = !!opts['dry-run']
  const project = typeof opts.project === 'string' ? opts.project : undefined

  console.log(`▶ leads-vault: ${command} ${JSON.stringify({ limit, dryRun, project })}`)

  switch (command) {
    case 'sirene': {
      const r = await runSireneIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'companies-house':
    case 'ch': {
      const r = await runCompaniesHouseIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'osm': {
      const r = await runOsmIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'common-crawl':
    case 'cc': {
      const tlds = typeof opts.tlds === 'string' ? (opts.tlds as string).split(',') : undefined
      const crawl = typeof opts.crawl === 'string' ? (opts.crawl as string) : undefined
      const r = await runCommonCrawlIngest({ limit, dryRun, tlds, crawl })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'handelsregister':
    case 'hreg': {
      const r = await runHandelsregisterIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'mercantil':
    case 'mercantil-es': {
      const r = await runMercantilEsIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'registroimprese':
    case 'ri-it': {
      const r = await runRegistroimpreseItIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'opencorporates':
    case 'oc': {
      const jurisdictions = typeof opts.jurisdictions === 'string' ? (opts.jurisdictions as string).split(',') : undefined
      const r = await runOpenCorporatesIngest({ limit, dryRun, jurisdictions } as any)
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'eori': {
      const r = await runEoriValidate({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'verify': {
      const r = await runMailscoutVerify({ limit })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'sync': {
      const country = typeof opts.country === 'string' ? (opts.country as string) : undefined
      const r = await runProjectSync({ project, limit, country })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-uk':
    case 'persons-uk-ch': {
      const r = await runPersonsUkCh({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-fr':
    case 'persons-fr-inpi': {
      const r = await runPersonsFrInpi({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-no':
    case 'persons-no-brreg': {
      const r = await runPersonsNoBrreg({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-fi':
    case 'persons-fi-prh': {
      const r = await runPersonsFiPrh({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-cz':
    case 'persons-cz-ares': {
      const r = await runPersonsCzAres({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-ee':
    case 'persons-ee-ariregister': {
      const r = await runPersonsEeAriregister({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-github':
    case 'github': {
      const r = await runPersonsGithub({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-wikidata':
    case 'wikidata': {
      const r = await runPersonsWikidata({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'persons-sec':
    case 'sec-edgar': {
      const r = await runPersonsSecEdgar({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'domain-search': {
      const r = await runDomainSearch({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'openownership':
    case 'oo': {
      const r = await runOpenOwnershipIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'opensanctions':
    case 'peps': {
      const r = await runOpenSanctionsIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'icij':
    case 'icij-offshore': {
      const r = await runIcijOffshoreIngest({ limit, dryRun })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'all': {
      console.log('▶ Sirene...')
      console.log(JSON.stringify(await runSireneIngest({ limit }), null, 2))
      console.log('▶ Companies House...')
      console.log(JSON.stringify(await runCompaniesHouseIngest({ limit }), null, 2))
      console.log('▶ OSM...')
      console.log(JSON.stringify(await runOsmIngest({ limit }), null, 2))
      console.log('▶ Verify...')
      console.log(JSON.stringify(await runMailscoutVerify({ limit }), null, 2))
      console.log('▶ Sync...')
      console.log(JSON.stringify(await runProjectSync({ limit }), null, 2))
      break
    }
    default:
      console.log(`Unknown command: ${command}`)
      console.log(
        'Available: sirene, companies-house, handelsregister, mercantil, registroimprese, opencorporates, eori, osm, common-crawl, verify, sync, persons-uk, persons-fr, persons-no, persons-fi, persons-cz, persons-ee, persons-github, persons-wikidata, persons-sec, domain-search, openownership, opensanctions, icij, all',
      )
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('runner error', err)
  process.exit(1)
})
