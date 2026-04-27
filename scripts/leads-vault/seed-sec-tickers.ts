/**
 * Seed lv_companies USA via SEC company_tickers.json
 *
 * Source: https://www.sec.gov/files/company_tickers.json (10k+ publicly traded US companies)
 * Result: lv_companies rows with country_iso='USA', crn=CIK (10-digit padded), legal_name=title
 * Why   : enables persons-sec-edgar connector to find inputs (currently 0 USA companies in DB)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { vaultClient } from '../../lib/leads-core/client'
import type { LvCompanyInsert } from '../../lib/leads-core/types'

const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json'
const UA = 'feel-the-gap-leadsvault/1.0 mehdi.sakalypr@gmail.com'
const BATCH_SIZE = 500

type Ticker = { cik_str: number; ticker: string; title: string }

function padCik(n: number): string {
  return String(n).padStart(10, '0')
}

async function main(): Promise<void> {
  const t0 = Date.now()
  console.log(`▶ seed-sec-tickers: downloading ${TICKERS_URL}`)
  const res = await fetch(TICKERS_URL, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as Record<string, Ticker>
  const tickers = Object.values(data)
  console.log(`▶ seed-sec-tickers: ${tickers.length} tickers loaded`)

  const client = vaultClient()
  let inserted = 0
  let skipped = 0
  let dup = 0
  const batch: LvCompanyInsert[] = []

  for (const t of tickers) {
    if (!t.cik_str || !t.title) { skipped++; continue }
    const cik = padCik(t.cik_str)
    batch.push({
      crn: cik,
      legal_name: t.title.trim().slice(0, 250),
      country_iso: 'USA',
      status: 'active',
      primary_source: 'opencorporates',
      source_ids: { sec_cik: cik, sec_ticker: t.ticker },
    })
    if (batch.length >= BATCH_SIZE) {
      const { error } = await client.from('lv_companies').insert(batch)
      if (error) {
        if (error.message.includes('duplicate')) dup += batch.length
        else console.error('insert err:', error.message)
      } else {
        inserted += batch.length
      }
      batch.length = 0
    }
  }
  if (batch.length > 0) {
    const { error } = await client.from('lv_companies').insert(batch)
    if (error) {
      if (error.message.includes('duplicate')) dup += batch.length
      else console.error('flush err:', error.message)
    } else {
      inserted += batch.length
    }
  }

  console.log(JSON.stringify({
    rows_processed: tickers.length,
    rows_inserted: inserted,
    rows_skipped: skipped + dup,
    duration_ms: Date.now() - t0,
    metadata: { duplicates: dup },
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
