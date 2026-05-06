/**
 * Brazil Receita Federal do Brasil (RFB) CNPJ connector — bulk open data
 *
 * Source  : https://dadosabertos.rfb.gov.br/CNPJ/
 * Format  : ZIP-compressed CSV (semicolon-delimited, latin-1 encoding), one file per UF (estado)
 * License : Open Data Brazil — free commercial use with attribution
 * Volume  : ~50M CNPJs total; ~20M active; SP alone ~3M entries
 * Auth    : none — fully public
 *
 * Strategy (disk-aware):
 *   1. Download ZIP for a single UF at a time (≤500 MB chunk).
 *   2. Unzip to /root/leads-vault/cache/rfb-br/ — stream CSV line-by-line.
 *   3. Filter SIT_CADASTRAL = '02' (Ativa) only.
 *   4. Batch-upsert into lv_companies (crn = CNPJ 14-digit).
 *   5. Delete cache after ingest to recover disk space.
 *
 * CSV columns (relevant subset):
 *   CNPJ_BASICO (8) | CNPJ_ORDEM (4) | CNPJ_DV (2) | IDENTIFICADOR_MATRIZ_FILIAL |
 *   RAZAO_SOCIAL | NAT_JURIDICA | QUALIF_RESP | CAPITAL_SOCIAL | PORTE | ENTE_FED_RESP
 *   (establishments file adds SIT_CADASTRAL, MUNICIPIO, UF, EMAIL, etc.)
 *
 * The RFB publishes two linked file sets:
 *   - Empresas*.zip  → CNPJ_BASICO + RAZAO_SOCIAL (company master)
 *   - Estabelecimentos*.zip → CNPJ full + situation + address + email + UF
 * V1 implementation: uses Estabelecimentos which contains all fields we need.
 *
 * UF filter: pass --uf=SP to limit to one state (São Paulo). Defaults to SP.
 */

import { createReadStream, existsSync, unlinkSync } from 'fs'
import { mkdir, stat } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvCompanyInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/root/leads-vault/cache/rfb-br'
const UA = 'gapup-leads-vault/2.0 (research; mehdi.sakalypr@gmail.com)'
const BATCH_SIZE = 500
const MAX_ZIP_BYTES = 500 * 1024 * 1024

const BASE_URL = 'https://dadosabertos.rfb.gov.br/CNPJ'

const SITUACAO_ATIVA = '02'

const UF_CODES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}

type RfbOptions = ConnectorOptions & {
  uf?: string
}

function str(v: string | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function parseCnpj(basico: string, ordem: string, dv: string): string | null {
  const b = (basico ?? '').replace(/\D/g, '').padStart(8, '0')
  const o = (ordem ?? '').replace(/\D/g, '').padStart(4, '0')
  const d = (dv ?? '').replace(/\D/g, '').padStart(2, '0')
  if (b.length !== 8 || o.length !== 4 || d.length !== 2) return null
  return `${b}${o}${d}`
}

function normalizeEmail(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (!s.includes('@') || s.length < 5 || s.length > 254) return null
  return s
}

function porteToSizeBucket(porte: string | undefined): LvCompanyInsert['size_bucket'] {
  switch ((porte ?? '').trim()) {
    case '01': return 'micro'
    case '03': return 'small'
    case '05': return 'medium'
    case '07': return 'large'
    default: return null
  }
}

function capitalToRevenue(capitalStr: string | undefined): number | null {
  if (!capitalStr) return null
  const n = parseFloat(capitalStr.replace(',', '.'))
  return isFinite(n) && n > 0 ? Math.round(n) : null
}

async function getFileSize(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.size
  } catch {
    return 0
  }
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  console.log(`[rfb-br] downloading ${url} → ${dest}`)
  return new Promise<boolean>((resolve) => {
    const p = spawn(
      'curl',
      ['-L', '--fail', '--retry', '3', '--max-filesize', String(MAX_ZIP_BYTES), '-o', dest, '-A', UA, url],
      { stdio: 'inherit' },
    )
    p.on('exit', (code) => resolve(code === 0))
  })
}

async function unzipFile(zipPath: string, destDir: string): Promise<string | null> {
  console.log(`[rfb-br] unzipping ${zipPath}`)
  return new Promise<string | null>((resolve) => {
    const p = spawn('unzip', ['-o', '-d', destDir, zipPath], { stdio: 'inherit' })
    p.on('exit', async (code) => {
      if (code !== 0) { resolve(null); return }
      const ls = spawn('find', [destDir, '-maxdepth', '1', '-name', '*.csv', '-o', '-name', '*.ESTABELECIMENTOS', '-o', '-name', '*.TXT'], { stdio: ['ignore', 'pipe', 'ignore'] })
      let out = ''
      ls.stdout.on('data', (d: Buffer) => { out += d.toString() })
      ls.on('exit', () => {
        const files = out.trim().split('\n').filter(Boolean)
        resolve(files[0] ?? null)
      })
    })
  })
}

function parseCsvLine(line: string): string[] {
  return line.split(';').map((f) => f.replace(/^"(.*)"$/, '$1').trim())
}

export async function runRfbBrIngest(opts: RfbOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: { uf: opts.uf ?? 'SP', source: 'rfb_br' },
  }

  const uf = (opts.uf ?? 'SP').toUpperCase()

  if (!UF_CODES[uf]) {
    result.error = `Unknown UF: ${uf}. Valid values: ${Object.keys(UF_CODES).join(', ')}`
    result.duration_ms = Date.now() - t0
    return result
  }

  try {
    await mkdir(CACHE_DIR, { recursive: true })

    const estabUrl = `${BASE_URL}/Estabelecimentos${uf}.zip`
    const zipPath = join(CACHE_DIR, `Estabelecimentos${uf}.zip`)

    if (!existsSync(zipPath) || (await getFileSize(zipPath)) < 1024) {
      const ok = await downloadFile(estabUrl, zipPath)
      if (!ok) {
        const estabUrlAlt = `${BASE_URL}/dados/Estabelecimentos${uf}.zip`
        console.log(`[rfb-br] primary URL failed, trying alternate: ${estabUrlAlt}`)
        const ok2 = await downloadFile(estabUrlAlt, zipPath)
        if (!ok2) {
          result.error = `Download failed for UF=${uf}. Network issue or file not available. Skipping gracefully.`
          result.duration_ms = Date.now() - t0
          return result
        }
      }
    } else {
      console.log(`[rfb-br] using cached zip: ${zipPath}`)
    }

    const csvFile = await unzipFile(zipPath, CACHE_DIR)
    if (!csvFile || !existsSync(csvFile)) {
      result.error = `unzip failed or no CSV found in ${zipPath}`
      result.duration_ms = Date.now() - t0
      return result
    }

    const sb = vaultClient()

    const inputStream = createReadStream(csvFile, { encoding: 'latin1' })
    const rl = createInterface({ input: inputStream, crlfDelay: Infinity })

    const batch: LvCompanyInsert[] = []

    const flush = async (): Promise<void> => {
      if (!batch.length) return
      if (!opts.dryRun) {
        const { error } = await (sb.from as any)('lv_companies').upsert(batch, {
          onConflict: 'crn,primary_source',
          ignoreDuplicates: false,
        })
        if (error && !error.message.includes('duplicate')) {
          console.error('[rfb-br] upsert error', error.message)
          result.rows_skipped += batch.length
        } else {
          result.rows_inserted += batch.length
        }
      } else {
        result.rows_inserted += batch.length
      }
      batch.length = 0
    }

    let isFirstLine = true

    for await (const rawLine of rl) {
      if (isFirstLine) {
        isFirstLine = false
        if (rawLine.toLowerCase().includes('cnpj') || rawLine.toLowerCase().includes('razao')) {
          continue
        }
      }

      result.rows_processed++

      const cols = parseCsvLine(rawLine)
      if (cols.length < 10) { result.rows_skipped++; continue }

      const [
        cnpjBasico,
        cnpjOrdem,
        cnpjDv,
        ,
        ,
        situCadastral,
        ,
        ,
        ,
        nomeFantasia,
        ,
        ,
        ,
        ,
        ,
        logradouro,
        ,
        numero,
        ,
        bairro,
        cep,
        uf_col,
        municipio,
        ,
        email,
        ,
        ,
        capital,
        porte,
        ,
        razaoSocial,
      ] = cols

      if ((situCadastral ?? '').trim() !== SITUACAO_ATIVA) {
        result.rows_skipped++
        continue
      }

      const cnpj = parseCnpj(cnpjBasico, cnpjOrdem, cnpjDv)
      if (!cnpj) { result.rows_skipped++; continue }

      const legal_name = str(razaoSocial) ?? str(nomeFantasia)
      if (!legal_name) { result.rows_skipped++; continue }

      const addressParts = [
        str(logradouro), str(numero), str(bairro), str(municipio), str(uf_col),
      ].filter(Boolean)

      const row: LvCompanyInsert = {
        crn: cnpj,
        legal_name,
        trade_name: str(nomeFantasia),
        country_iso: 'BRA',
        region: str(uf_col) ?? uf,
        city: str(municipio),
        postal_code: str(cep)?.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') ?? null,
        address: addressParts.length > 0 ? addressParts.join(', ') : null,
        domain: null,
        status: 'active',
        size_bucket: porteToSizeBucket(porte),
        revenue_estimate_eur: capitalToRevenue(capital),
        primary_source: 'rfb_br',
        source_ids: { rfb_br: cnpj },
        enrichment_score: 25,
      }

      const emailNorm = normalizeEmail(email)
      if (emailNorm) {
        row.domain = emailNorm.split('@')[1] ?? null
      }

      batch.push(row)
      if (batch.length >= BATCH_SIZE) await flush()

      if (opts.limit && result.rows_inserted + batch.length >= opts.limit) break

      if (result.rows_processed % 100000 === 0) {
        console.log(`[rfb-br] processed=${result.rows_processed} inserted=${result.rows_inserted} skipped=${result.rows_skipped}`)
      }
    }

    await flush()

    try {
      unlinkSync(zipPath)
      if (existsSync(csvFile)) unlinkSync(csvFile)
      console.log('[rfb-br] cache cleaned up')
    } catch {
      // best-effort cleanup
    }

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'rfb_br',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[rfb-br] fatal', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
    if (!opts.dryRun) {
      await logSync({ source_id: 'rfb_br', operation: opts.delta ? 'delta' : 'ingest', result })
    }
  }

  return result
}
