/**
 * EE Äriregister bulk JSON ingest
 *
 * Source : https://avaandmed.ariregister.rik.ee/sites/default/files/avaandmed/
 *          ettevotja_rekvisiidid__kasusaajad.json.zip   (~27MB → ~325MB JSON, UBO records)
 *          ettevotja_rekvisiidid__kaardile_kantud_isikud.json.zip   (~45MB, registered officers)
 * License: CC BY 4.0 (Estonian government open data)
 * Strategy: stream-parse via `jq -c '.[]'` subprocess to avoid loading 300MB+ JSON in heap.
 *           For each company record: upsert lv_companies on crn, then insert lv_persons.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { mkdir, rm, stat } from 'fs/promises'
import { vaultClient } from '../../lib/leads-core/client'
import type { LvCompanyInsert, LvPersonInsert } from '../../lib/leads-core/types'

const BASE_URL = 'https://avaandmed.ariregister.rik.ee/sites/default/files/avaandmed'
const CACHE_DIR = '/root/leads-vault/cache/ee-bulk'
const BATCH_SIZE = 200

type Mode = 'kasusaajad' | 'kaardile_kantud_isikud'

type CompanyRecord = {
  ariregistri_kood: number
  nimi: string
  kasusaajad?: UboPerson[]
  isikud?: OfficerPerson[]
}

type UboPerson = {
  kirje_id?: number
  algus_kpv?: string
  lopp_kpv?: string | null
  eesnimi?: string
  nimi?: string
  isikukood?: string | null
  isikukood_hash?: string
  kontrolli_teostamise_viis_tekstina?: string
}

type OfficerPerson = {
  kirje_id?: number
  algus_kpv?: string
  lopp_kpv?: string | null
  eesnimi?: string
  nimi?: string
  isikukood?: string | null
  isiku_tyyp_tekstina?: string
  rolli_tekstina?: string
}

function execShell(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit' })
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exit ${code}`))))
  })
}

async function ensureFile(mode: Mode): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })
  const zip = `${CACHE_DIR}/${mode}.json.zip`
  const json = `${CACHE_DIR}/ettevotja_rekvisiidid__${mode}.json`
  try {
    await stat(json)
    console.log(`▶ using cached ${json}`)
    return json
  } catch { /* not cached */ }
  console.log(`▶ downloading ${mode}.json.zip`)
  await execShell('curl', ['-sSL', '-o', zip, `${BASE_URL}/ettevotja_rekvisiidid__${mode}.json.zip`])
  console.log(`▶ unzipping`)
  await execShell('unzip', ['-o', zip, '-d', CACHE_DIR])
  await rm(zip).catch(() => {})
  return json
}

function streamRecords(file: string, onRecord: (rec: CompanyRecord) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('jq', ['-c', '.[]', file])
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })
    let queue: Promise<void> = Promise.resolve()
    rl.on('line', (line) => {
      queue = queue.then(async () => {
        try {
          const rec = JSON.parse(line) as CompanyRecord
          await onRecord(rec)
        } catch (e) {
          console.error('parse err:', (e as Error).message)
        }
      })
    })
    rl.on('close', () => queue.then(() => resolve()).catch(reject))
    proc.stderr.on('data', (d) => process.stderr.write(d))
    proc.on('error', reject)
  })
}

function mapUboRole(method: string | undefined): { label: string; seniority: 'c-level' | 'director'; score: number } {
  const m = (method ?? '').toLowerCase()
  if (m.includes('otsene')) return { label: 'Beneficial Owner (direct)', seniority: 'c-level', score: 88 }
  if (m.includes('kaudne')) return { label: 'Beneficial Owner (indirect)', seniority: 'c-level', score: 80 }
  return { label: 'Beneficial Owner', seniority: 'director', score: 70 }
}

function mapOfficerRole(role: string | undefined): { label: string; seniority: 'c-level' | 'director' | 'individual'; score: number } | null {
  const r = (role ?? '').toLowerCase()
  if (!r) return null
  if (r.includes('juhataja') || r.includes('juhatuse')) return { label: role || 'Juhatuse liige', seniority: 'c-level', score: 92 }
  if (r.includes('nõukogu')) return { label: role || 'Nõukogu liige', seniority: 'director', score: 65 }
  if (r.includes('prokurist')) return { label: 'Prokurist', seniority: 'director', score: 75 }
  if (r.includes('likvid')) return null
  return { label: role || 'Officer', seniority: 'individual', score: 30 }
}

async function main(): Promise<void> {
  const mode = (process.argv[2] || 'kasusaajad') as Mode
  if (mode !== 'kasusaajad' && mode !== 'kaardile_kantud_isikud') {
    console.error(`usage: tsx seed-ee-bulk.ts <kasusaajad|kaardile_kantud_isikud>`)
    process.exit(1)
  }

  const t0 = Date.now()
  const file = await ensureFile(mode)

  const client = vaultClient()
  let processed = 0
  let companiesUpserted = 0
  let personsInserted = 0
  let skipped = 0
  const personBatch: LvPersonInsert[] = []
  const companyCache = new Map<string, string>() // crn → company_id

  const flushPersons = async () => {
    if (personBatch.length === 0) return
    const { error } = await client.from('lv_persons').insert(personBatch)
    if (error && !error.message.includes('duplicate')) {
      console.error('persons insert err:', error.message)
    } else {
      personsInserted += personBatch.length
    }
    personBatch.length = 0
  }

  const upsertCompany = async (crn: string, name: string): Promise<string | null> => {
    const cached = companyCache.get(crn)
    if (cached) return cached
    const { data: existing } = await client
      .from('lv_companies')
      .select('id')
      .eq('crn', crn)
      .eq('country_iso', 'EST')
      .maybeSingle()
    if (existing) {
      const id = (existing as { id: string }).id
      companyCache.set(crn, id)
      return id
    }
    const insert: LvCompanyInsert = {
      crn,
      legal_name: name.trim().slice(0, 250),
      country_iso: 'EST',
      status: 'active',
      primary_source: 'opencorporates',
    }
    const { data, error } = await client
      .from('lv_companies')
      .insert(insert)
      .select('id')
      .single()
    if (error || !data) {
      // race condition — re-fetch
      const { data: again } = await client
        .from('lv_companies')
        .select('id')
        .eq('crn', crn)
        .eq('country_iso', 'EST')
        .maybeSingle()
      if (again) {
        const id = (again as { id: string }).id
        companyCache.set(crn, id)
        return id
      }
      return null
    }
    companiesUpserted++
    companyCache.set(crn, (data as { id: string }).id)
    return (data as { id: string }).id
  }

  await streamRecords(file, async (rec) => {
    processed++
    if (!rec.ariregistri_kood || !rec.nimi) { skipped++; return }
    const crn = String(rec.ariregistri_kood)
    const companyId = await upsertCompany(crn, rec.nimi)
    if (!companyId) { skipped++; return }

    const persons: LvPersonInsert[] = []
    if (mode === 'kasusaajad') {
      for (const p of rec.kasusaajad ?? []) {
        if (p.lopp_kpv) continue // ended
        const first = (p.eesnimi ?? '').trim()
        const last = (p.nimi ?? '').trim()
        const full = [first, last].filter(Boolean).join(' ')
        if (!full) continue
        const { label, seniority, score } = mapUboRole(p.kontrolli_teostamise_viis_tekstina)
        persons.push({
          company_id: companyId,
          full_name: full,
          first_name: first || null,
          last_name: last || null,
          role: label,
          role_seniority: seniority,
          decision_maker_score: score,
          primary_source: 'opencorporates',
        })
      }
    } else {
      for (const p of rec.isikud ?? []) {
        if (p.lopp_kpv) continue
        const first = (p.eesnimi ?? '').trim()
        const last = (p.nimi ?? '').trim()
        const full = [first, last].filter(Boolean).join(' ')
        if (!full) continue
        const mapped = mapOfficerRole(p.rolli_tekstina)
        if (!mapped) continue
        persons.push({
          company_id: companyId,
          full_name: full,
          first_name: first || null,
          last_name: last || null,
          role: mapped.label,
          role_seniority: mapped.seniority,
          decision_maker_score: mapped.score,
          primary_source: 'opencorporates',
        })
      }
    }

    for (const p of persons) personBatch.push(p)

    if (personBatch.length >= BATCH_SIZE) await flushPersons()

    if (processed % 5000 === 0) {
      console.log(`▶ ${processed} processed, ${companiesUpserted} new companies, ${personsInserted} persons inserted`)
    }
  })

  await flushPersons()

  console.log(JSON.stringify({
    mode,
    rows_processed: processed,
    rows_inserted: personsInserted,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: { companies_upserted: companiesUpserted, persons_inserted: personsInserted },
  }, null, 2))

  // Optional: cleanup file
  if (process.argv.includes('--cleanup')) {
    await rm(file).catch(() => {})
    console.log(`▶ cleaned up ${file}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
