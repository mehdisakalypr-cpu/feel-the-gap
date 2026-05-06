/**
 * KBO/BCE Belgium connector — Crossroads Bank for Enterprises Open Data
 *
 * License : OGL Belgium (Open Government Licence Belgium) — free reuse,
 *           attribution required: "Source: Crossroads Bank for Enterprises (CBE)"
 * Volume  : ~1.5M active legal entities (enterprises + establishments)
 * Source  : https://economie.fgov.be/en/themes/enterprises/crossroads-bank-enterprises/
 *             services-everyone/public-data-available-reuse/cbe-open-data
 * Portal  : https://kbopub.economie.fgov.be/kbo-open-data/ (free account required)
 *
 * ZIP structure (v3):
 *   enterprise.csv   — EnterpriseNumber, Status, JuridicalSituation, TypeOfEnterprise,
 *                       JuridicalForm, StartDate
 *   denomination.csv — EnterpriseNumber, Language, TypeOfDenomination, Denomination
 *   address.csv      — EnterpriseNumber, TypeOfAddress, CountryNL, Zipcode,
 *                       MunicipalityNL, MunicipalityFR, StreetNL, StreetFR, HouseNumber
 *   contact.csv      — EnterpriseNumber, EntityContact, ContactType, Value
 *
 * Auth strategy:
 *   1. If KBO_USERNAME + KBO_PASSWORD env vars set  → auto-login + download
 *   2. Else if ZIP already in CACHE_DIR             → use it
 *   3. Else                                         → graceful error with instructions
 *
 * Cache: /root/leads-vault/cache/kbo/ (persists across runs)
 */

import { createReadStream, existsSync, createWriteStream } from 'fs'
import { mkdir, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import * as https from 'https'
import * as http from 'http'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/root/leads-vault/cache/kbo'
const CACHE_ZIP = `${CACHE_DIR}/KboOpenData_full.zip`
const LOGIN_URL = 'https://kbopub.economie.fgov.be/kbo-open-data/static/j_spring_security_check'
const DOWNLOAD_URL = 'https://kbopub.economie.fgov.be/kbo-open-data/files/v3/KboOpenData_full.zip'

const CHUNK_SIZE = 500

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function buildIndexMap(header: string): Record<string, number> {
  const idx: Record<string, number> = {}
  parseCSVLine(header).forEach((col, i) => { idx[col.trim()] = i })
  return idx
}

function get(cols: string[], idx: Record<string, number>, key: string): string {
  const i = idx[key]
  return i !== undefined ? (cols[i] ?? '').trim() : ''
}

async function streamCSVFromZip(
  zipPath: string,
  fileName: string,
  onRow: (cols: string[], idx: Record<string, number>) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('unzip', ['-p', zipPath, fileName], { stdio: ['ignore', 'pipe', 'inherit'] })
    let idx: Record<string, number> = {}
    let isHeader = true
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (!line.trim()) return
      if (isHeader) {
        idx = buildIndexMap(line)
        isHeader = false
        return
      }
      const cols = parseCSVLine(line)
      onRow(cols, idx)
    })
    rl.on('close', resolve)
    proc.on('error', reject)
    proc.on('exit', (code) => { if (code !== 0 && code !== null) reject(new Error(`unzip exit ${code} for ${fileName}`)) })
  })
}

async function fetchWithRedirects(
  url: string,
  options: https.RequestOptions & { cookieJar?: Record<string, string> },
  body?: string,
): Promise<{ statusCode: number; headers: Record<string, string | string[]>; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib = isHttps ? https : http
    const cookies = options.cookieJar ?? {}
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')

    const reqOpts: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: body ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadVaultBot/1.0)',
        'Cookie': cookieStr,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': String(Buffer.byteLength(body)) } : {}),
        ...options.headers,
      },
    }
    const req = lib.request(reqOpts, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const headers: Record<string, string | string[]> = {}
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) headers[k] = v
        }
        resolve({ statusCode: res.statusCode ?? 0, headers, body: text })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function extractCookies(setCookieHeader: string | string[] | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : []
  for (const c of raw) {
    const [pair] = c.split(';')
    const eqIdx = pair.indexOf('=')
    if (eqIdx > 0) {
      result[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim()
    }
  }
  return result
}

async function downloadWithAuth(username: string, password: string): Promise<void> {
  console.log('[kbo-be] authenticating with KBO portal...')
  const cookieJar: Record<string, string> = {}

  const loginPage = await fetchWithRedirects('https://kbopub.economie.fgov.be/kbo-open-data/login', { cookieJar })
  Object.assign(cookieJar, extractCookies(loginPage.headers['set-cookie']))

  const loginBody = `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`
  const loginResp = await fetchWithRedirects(LOGIN_URL, { cookieJar }, loginBody)
  Object.assign(cookieJar, extractCookies(loginResp.headers['set-cookie']))

  if (loginResp.statusCode >= 400) {
    throw new Error(`KBO login failed (HTTP ${loginResp.statusCode}). Check KBO_USERNAME / KBO_PASSWORD.`)
  }
  if (loginResp.body.includes('Login failed') || loginResp.body.includes('Bad credentials')) {
    throw new Error('KBO login rejected: bad credentials. Check KBO_USERNAME / KBO_PASSWORD.')
  }

  console.log('[kbo-be] login ok, fetching download listing...')
  const listing = await fetchWithRedirects('https://kbopub.economie.fgov.be/kbo-open-data/files/v3/', { cookieJar })
  Object.assign(cookieJar, extractCookies(listing.headers['set-cookie']))

  const zipMatch = listing.body.match(/href="([^"]*KboOpenData[^"]*\.zip)"/i)
  const downloadPath = zipMatch ? zipMatch[1] : '/kbo-open-data/files/v3/KboOpenData_full.zip'
  const fullDownloadUrl = downloadPath.startsWith('http')
    ? downloadPath
    : `https://kbopub.economie.fgov.be${downloadPath}`

  console.log(`[kbo-be] downloading from ${fullDownloadUrl} ...`)
  await new Promise<void>((resolve, reject) => {
    const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
    const parsed = new URL(fullDownloadUrl)
    const reqOpts: https.RequestOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadVaultBot/1.0)',
        'Cookie': cookieStr,
      },
    }
    const req = https.request(reqOpts, (res) => {
      if ((res.statusCode ?? 0) >= 300 && res.headers.location) {
        req.destroy()
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://kbopub.economie.fgov.be${res.headers.location}`
        const out2 = createWriteStream(CACHE_ZIP)
        https.get(redirectUrl, (res2) => {
          res2.pipe(out2)
          out2.on('finish', () => { out2.close(); resolve() })
          out2.on('error', reject)
        }).on('error', reject)
        return
      }
      const out = createWriteStream(CACHE_ZIP)
      res.pipe(out)
      out.on('finish', () => { out.close(); resolve() })
      out.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
  console.log(`[kbo-be] ZIP saved to ${CACHE_ZIP}`)
}

async function ensureZip(): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })

  if (existsSync(CACHE_ZIP)) {
    console.log(`[kbo-be] using cached ZIP at ${CACHE_ZIP}`)
    return CACHE_ZIP
  }

  const username = process.env.KBO_USERNAME
  const password = process.env.KBO_PASSWORD

  if (username && password) {
    await downloadWithAuth(username, password)
    return CACHE_ZIP
  }

  const manualZips = (await readdir(CACHE_DIR).catch(() => [])).filter(f => f.endsWith('.zip'))
  if (manualZips.length > 0) {
    const found = join(CACHE_DIR, manualZips[0])
    console.log(`[kbo-be] found manually placed ZIP: ${found}`)
    return found
  }

  throw new Error(
    `[kbo-be] KBO ZIP not found and no credentials configured.\n` +
    `Options:\n` +
    `  1) Set KBO_USERNAME + KBO_PASSWORD in .env.local (free account at https://kbopub.economie.fgov.be/kbo-open-data/signup?form)\n` +
    `  2) Download the ZIP manually and place it at: ${CACHE_ZIP}\n` +
    `     URL: ${DOWNLOAD_URL} (requires free login)`
  )
}

async function listZipContents(zipPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const p = spawn('unzip', ['-l', zipPath], { stdio: ['ignore', 'pipe', 'inherit'] })
    const chunks: Buffer[] = []
    p.stdout.on('data', (c: Buffer) => chunks.push(c))
    p.on('exit', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      const files = text.split('\n')
        .map(l => l.trim().split(/\s+/).pop() ?? '')
        .filter(f => f.endsWith('.csv'))
      resolve(files)
    })
    p.on('error', reject)
  })
}

export async function runKboBeIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  try {
    const zipPath = await ensureZip()

    console.log('[kbo-be] scanning ZIP contents...')
    const zipFiles = await listZipContents(zipPath)

    const resolveFile = (pattern: RegExp): string => {
      const match = zipFiles.find(f => pattern.test(f))
      if (!match) throw new Error(`[kbo-be] required CSV not found in ZIP: ${pattern}`)
      return match
    }

    const enterpriseCsv = resolveFile(/enterprise\.csv$/i)
    const denominationCsv = resolveFile(/denomination\.csv$/i)
    const addressCsv = resolveFile(/address\.csv$/i)

    console.log('[kbo-be] loading denomination index...')
    const denomMap = new Map<string, { legal: string; trade: string | null }>()

    await streamCSVFromZip(zipPath, denominationCsv, (cols, idx) => {
      const num = get(cols, idx, 'EnterpriseNumber')
      const lang = get(cols, idx, 'Language')
      const type = get(cols, idx, 'TypeOfDenomination')
      const name = get(cols, idx, 'Denomination')
      if (!num || !name) return

      const existing = denomMap.get(num)

      if (type === '001') {
        if (!existing) {
          denomMap.set(num, { legal: name, trade: null })
        } else if (!existing.legal) {
          existing.legal = name
        } else {
          const langPrio: Record<string, number> = { '2': 0, '1': 1, '3': 2, '4': 3 }
          const existingPrio = langPrio[lang] ?? 99
          const storedLang = (existing as any).__legalLang ?? '99'
          if (existingPrio < Number(storedLang)) {
            existing.legal = name
            ;(existing as any).__legalLang = lang
          }
        }
        if (existing) (existing as any).__legalLang = lang
        else {
          const entry = { legal: name, trade: null }
          ;(entry as any).__legalLang = lang
          denomMap.set(num, entry)
        }
      } else if (type === '002' || type === '003') {
        const e = denomMap.get(num)
        if (e && !e.trade) e.trade = name
        else if (!e) denomMap.set(num, { legal: '', trade: name })
      }
    })

    console.log(`[kbo-be] denomination index: ${denomMap.size} entries`)

    console.log('[kbo-be] loading address index...')
    const addrMap = new Map<string, { city: string | null; postal: string | null; street: string | null }>()

    await streamCSVFromZip(zipPath, addressCsv, (cols, idx) => {
      const num = get(cols, idx, 'EnterpriseNumber')
      const type = get(cols, idx, 'TypeOfAddress')
      if (!num || type !== '1') return

      const zipCode = get(cols, idx, 'Zipcode') || null
      const muniFR = get(cols, idx, 'MunicipalityFR') || null
      const muniNL = get(cols, idx, 'MunicipalityNL') || null
      const streetFR = get(cols, idx, 'StreetFR') || null
      const streetNL = get(cols, idx, 'StreetNL') || null
      const houseNum = get(cols, idx, 'HouseNumber') || null

      const city = muniFR ?? muniNL
      const streetBase = streetFR ?? streetNL
      const street = streetBase && houseNum ? `${streetBase} ${houseNum}` : (streetBase ?? null)

      addrMap.set(num, { city, postal: zipCode, street })
    })

    console.log(`[kbo-be] address index: ${addrMap.size} entries`)

    console.log('[kbo-be] streaming enterprise.csv...')
    const sb = vaultClient()
    const batch: LvCompanyInsert[] = []
    const limit = opts.limit ?? 5000

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (opts.dryRun) {
        result.rows_inserted += batch.length
        batch.length = 0
        return
      }
      const { error, count } = await (sb.from as any)('lv_companies').upsert(
        batch,
        { onConflict: 'crn', ignoreDuplicates: false, count: 'exact' },
      )
      if (error) {
        console.error('[kbo-be] upsert error', error.message)
        result.rows_skipped += batch.length
      } else {
        result.rows_inserted += count ?? batch.length
      }
      batch.length = 0
    }

    let done = false

    await streamCSVFromZip(zipPath, enterpriseCsv, async (cols, idx) => {
      if (done) return
      result.rows_processed++

      const num = get(cols, idx, 'EnterpriseNumber')
      if (!num) { result.rows_skipped++; return }

      const status = get(cols, idx, 'Status')
      const typeOfEnterprise = get(cols, idx, 'TypeOfEnterprise')
      const startDate = get(cols, idx, 'StartDate')

      const activeStatus: LvCompanyInsert['status'] =
        status === 'AC' ? 'active' :
        status === 'JU' ? 'dissolved' :
        'dormant'

      const denom = denomMap.get(num)
      const legalName = denom?.legal
      if (!legalName) { result.rows_skipped++; return }

      const addr = addrMap.get(num)

      const crnClean = num
      const vatNumber = typeOfEnterprise === '2'
        ? `BE${num.replace(/\./g, '').replace(/^0+/, '').padStart(10, '0')}`
        : null

      let foundedYear: number | null = null
      if (startDate) {
        const parts = startDate.split('-')
        const yr = parseInt(parts[0], 10)
        if (!isNaN(yr) && yr > 1800 && yr <= new Date().getFullYear()) foundedYear = yr
      }

      const company: LvCompanyInsert = {
        crn: crnClean,
        vat_number: vatNumber,
        legal_name: legalName,
        trade_name: denom?.trade ?? null,
        country_iso: 'BEL',
        city: addr?.city ?? null,
        postal_code: addr?.postal ?? null,
        address: addr?.street ?? null,
        status: activeStatus,
        founded_year: foundedYear,
        primary_source: 'kbo_be',
        source_ids: { kbo: num },
        enrichment_score: 12,
      }

      batch.push(company)

      if (batch.length >= CHUNK_SIZE) {
        await flush()
      }

      if (result.rows_inserted + batch.length >= limit) {
        done = true
        await flush()
      }
    })

    if (!done) await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({ source_id: 'kbo_be', delta_count: result.rows_inserted, is_full_pull: !opts.delta })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[kbo-be]', result.error)
  } finally {
    result.duration_ms = Date.now() - start
    if (!opts.dryRun) {
      await logSync({ source_id: 'kbo_be', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
