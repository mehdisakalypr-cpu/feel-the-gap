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
  runGleifIngest,
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
  runPersonsLinkedinSerp,
  runEmailPermutator,
  runHibpCheck,
  runPhoneNumverify,
  runCommonCrawlMailto,
  runDirectoriesEu,
  runGmapsGosomEnrich,
  runSchemaJsonLdCrawl,
  runZefixChIngest,
  runKrsPlIngest,
  runKboBeIngest,
  runRnpcPtIngest,
  runCroIeIngest,
  runKvkNlIngest,
  runCvrDkIngest,
  runBolagsverketSeIngest,
  runOnrcRoIngest,
  runOrsrSkIngest,
  runRfbBrIngest,
  runAfricaTldsIngest,
  runMcaInIngest,
  runAsiaEmergingIngest,
} from '../../lib/leads-core'

type OptValue = string | boolean
type Opts = Record<string, OptValue>
type Ctx = { limit: number | undefined; dryRun: boolean; project: string | undefined; opts: Opts }
type Handler = (ctx: Ctx) => Promise<unknown>

function parseArgs(argv: string[]): { command: string; opts: Opts } {
  const command = argv[2] ?? 'help'
  const opts: Opts = {}
  for (const arg of argv.slice(3)) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=')
      opts[k] = v ?? true
    }
  }
  return { command, opts }
}

function getString(opts: Opts, key: string): string | undefined {
  const v = opts[key]
  return typeof v === 'string' ? v : undefined
}

function getNumber(opts: Opts, key: string): number | undefined {
  const v = opts[key]
  return typeof v === 'string' ? Number(v) : undefined
}

function getCsv(opts: Opts, key: string): string[] | undefined {
  const v = getString(opts, key)
  return v ? v.split(',') : undefined
}

/** Wraps a connector call with the standard `{ limit, dryRun }` signature and prints JSON. */
function basic(fn: (o: { limit?: number; dryRun?: boolean }) => Promise<unknown>): Handler {
  return async ({ limit, dryRun }) => fn({ limit, dryRun })
}

const handlers: Record<string, Handler> = {
  sirene: basic(runSireneIngest),
  'companies-house': basic(runCompaniesHouseIngest),
  ch: basic(runCompaniesHouseIngest),
  osm: basic(runOsmIngest),
  'common-crawl': async ({ limit, dryRun, opts }) =>
    runCommonCrawlIngest({ limit, dryRun, tlds: getCsv(opts, 'tlds'), crawl: getString(opts, 'crawl') }),
  cc: async ({ limit, dryRun, opts }) =>
    runCommonCrawlIngest({ limit, dryRun, tlds: getCsv(opts, 'tlds'), crawl: getString(opts, 'crawl') }),
  handelsregister: basic(runHandelsregisterIngest),
  hreg: basic(runHandelsregisterIngest),
  mercantil: basic(runMercantilEsIngest),
  'mercantil-es': basic(runMercantilEsIngest),
  registroimprese: basic(runRegistroimpreseItIngest),
  'ri-it': basic(runRegistroimpreseItIngest),
  gleif: async ({ limit, dryRun, opts }) =>
    runGleifIngest({ limit, dryRun, countries: getCsv(opts, 'countries'), maxPagesPerCountry: getNumber(opts, 'max-pages') }),
  opencorporates: async ({ limit, dryRun, opts }) =>
    runOpenCorporatesIngest({ limit, dryRun, jurisdictions: getCsv(opts, 'jurisdictions') } as any),
  oc: async ({ limit, dryRun, opts }) =>
    runOpenCorporatesIngest({ limit, dryRun, jurisdictions: getCsv(opts, 'jurisdictions') } as any),
  eori: basic(runEoriValidate),
  verify: async ({ limit }) => runMailscoutVerify({ limit }),
  sync: async ({ limit, project, opts }) =>
    runProjectSync({ project, limit, country: getString(opts, 'country') }),
  'persons-uk': basic(runPersonsUkCh),
  'persons-uk-ch': basic(runPersonsUkCh),
  'persons-fr': basic(runPersonsFrInpi),
  'persons-fr-inpi': basic(runPersonsFrInpi),
  'persons-no': basic(runPersonsNoBrreg),
  'persons-no-brreg': basic(runPersonsNoBrreg),
  'persons-fi': basic(runPersonsFiPrh),
  'persons-fi-prh': basic(runPersonsFiPrh),
  'persons-cz': basic(runPersonsCzAres),
  'persons-cz-ares': basic(runPersonsCzAres),
  'persons-ee': basic(runPersonsEeAriregister),
  'persons-ee-ariregister': basic(runPersonsEeAriregister),
  'persons-github': basic(runPersonsGithub),
  github: basic(runPersonsGithub),
  'persons-wikidata': basic(runPersonsWikidata),
  wikidata: basic(runPersonsWikidata),
  'persons-sec': basic(runPersonsSecEdgar),
  'sec-edgar': basic(runPersonsSecEdgar),
  'domain-search': basic(runDomainSearch),
  openownership: basic(runOpenOwnershipIngest),
  oo: basic(runOpenOwnershipIngest),
  opensanctions: basic(runOpenSanctionsIngest),
  peps: basic(runOpenSanctionsIngest),
  icij: basic(runIcijOffshoreIngest),
  'icij-offshore': basic(runIcijOffshoreIngest),
  'persons-linkedin': basic(runPersonsLinkedinSerp),
  linkedin: basic(runPersonsLinkedinSerp),
  'email-permutator': async ({ limit, dryRun, opts }) =>
    runEmailPermutator({ limit, dryRun, maxSmtpProbes: getNumber(opts, 'max-probes') }),
  permutator: async ({ limit, dryRun, opts }) =>
    runEmailPermutator({ limit, dryRun, maxSmtpProbes: getNumber(opts, 'max-probes') }),
  'hibp-check': basic(runHibpCheck),
  hibp: basic(runHibpCheck),
  'phone-numverify': basic(runPhoneNumverify),
  'phone-validate': basic(runPhoneNumverify),
  numverify: basic(runPhoneNumverify),
  'cc-mailto': async ({ limit, dryRun, opts }) =>
    runCommonCrawlMailto({ limit, dryRun, crawl: getString(opts, 'crawl'), patterns: getCsv(opts, 'patterns') }),
  'directories-eu': async ({ limit, dryRun, opts }) =>
    runDirectoriesEu({ limit, dryRun, enableKompass: !!opts['enable-kompass'] }),
  'dir-eu': async ({ limit, dryRun, opts }) =>
    runDirectoriesEu({ limit, dryRun, enableKompass: !!opts['enable-kompass'] }),
  'gmaps-gosom': basic(runGmapsGosomEnrich),
  gmaps: basic(runGmapsGosomEnrich),
  'schema-crawl': basic(runSchemaJsonLdCrawl),
  jsonld: basic(runSchemaJsonLdCrawl),
  'zefix-ch': async ({ limit, dryRun, opts }) =>
    runZefixChIngest({ limit, dryRun, cantons: getCsv(opts, 'cantons') }),
  zefix: async ({ limit, dryRun, opts }) =>
    runZefixChIngest({ limit, dryRun, cantons: getCsv(opts, 'cantons') }),
  'krs-pl': async ({ limit, dryRun, opts }) =>
    runKrsPlIngest({ limit, dryRun, start: getNumber(opts, 'start') }),
  pl: async ({ limit, dryRun, opts }) =>
    runKrsPlIngest({ limit, dryRun, start: getNumber(opts, 'start') }),
  'kbo-be': basic(runKboBeIngest),
  be: basic(runKboBeIngest),
  'rnpc-pt': basic(runRnpcPtIngest),
  pt: basic(runRnpcPtIngest),
  'cro-ie': basic(runCroIeIngest),
  ie: basic(runCroIeIngest),
  'kvk-nl': basic(runKvkNlIngest),
  nl: basic(runKvkNlIngest),
  'cvr-dk': basic(runCvrDkIngest),
  dk: basic(runCvrDkIngest),
  'bolagsverket-se': basic(runBolagsverketSeIngest),
  se: basic(runBolagsverketSeIngest),
  'onrc-ro': basic(runOnrcRoIngest),
  ro: basic(runOnrcRoIngest),
  'orsr-sk': basic(runOrsrSkIngest),
  sk: basic(runOrsrSkIngest),
  'rfb-br': async ({ limit, dryRun, opts }) =>
    runRfbBrIngest({ limit, dryRun, uf: getString(opts, 'uf') }),
  br: async ({ limit, dryRun, opts }) =>
    runRfbBrIngest({ limit, dryRun, uf: getString(opts, 'uf') }),
  africa: async ({ limit, dryRun, opts }) =>
    runAfricaTldsIngest({ limit, dryRun, mode: getString(opts, 'mode') as any }),
  'mca-in': basic(runMcaInIngest),
  in: basic(runMcaInIngest),
  'asia-emerging': async ({ limit, dryRun, opts }) =>
    runAsiaEmergingIngest({ limit, dryRun, country: getString(opts, 'country') }),
  id: async ({ limit, dryRun }) =>
    runAsiaEmergingIngest({ limit, dryRun, country: 'IDN' }),
  vn: async ({ limit, dryRun }) =>
    runAsiaEmergingIngest({ limit, dryRun, country: 'VNM' }),
  ph: async ({ limit, dryRun }) =>
    runAsiaEmergingIngest({ limit, dryRun, country: 'PHL' }),
  /** Special: chains sirene → companies-house → osm → verify → sync. dryRun is intentionally NOT forwarded. */
  all: async ({ limit }) => {
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
    return undefined
  },
}

const COMMAND_LIST =
  'sirene, companies-house, handelsregister, mercantil, registroimprese, opencorporates, eori, osm, common-crawl, cc-mailto, verify, hibp-check, sync, persons-uk, persons-fr, persons-no, persons-fi, persons-cz, persons-ee, persons-github, persons-wikidata, persons-sec, persons-linkedin, domain-search, openownership, opensanctions, icij, email-permutator, phone-numverify, directories-eu, gmaps-gosom, schema-crawl, zefix-ch, krs-pl, kbo-be, rnpc-pt, cro-ie, kvk-nl, cvr-dk, bolagsverket-se, onrc-ro, orsr-sk, rfb-br, africa, mca-in, asia-emerging, all'

async function main(): Promise<void> {
  const { command, opts } = parseArgs(process.argv)
  const limit = opts.limit ? Number(opts.limit) : undefined
  const dryRun = !!opts['dry-run']
  const project = getString(opts, 'project')

  console.log(`▶ leads-vault: ${command} ${JSON.stringify({ limit, dryRun, project })}`)

  const handler = handlers[command]
  if (!handler) {
    console.log(`Unknown command: ${command}`)
    console.log(`Available: ${COMMAND_LIST}`)
    process.exit(1)
  }

  const result = await handler({ limit, dryRun, project, opts })
  // `all` prints incrementally and returns undefined; skip the final dump in that case.
  if (result !== undefined) {
    console.log(JSON.stringify(result, null, 2))
  }
}

main().catch((err) => {
  console.error('runner error', err)
  process.exit(1)
})
