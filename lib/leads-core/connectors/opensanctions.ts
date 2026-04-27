/**
 * OpenSanctions PEPs connector — Politically Exposed Persons dataset
 *
 * Source  : https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json
 * Format  : JSONLines (one FollowTheMoney entity per line)
 * License : Free non-commercial; commercial requires license.
 *           We tag metadata legal_use='internal_research' and never resell raw data.
 * Volume  : ~197k PEPs + family + state-owned company managers
 * Auth    : none
 *
 * Strategy:
 *   1. Download latest PEPs dump (or reuse cached if < 24h).
 *   2. Stream parse line by line.
 *   3. Filter schema='Person' → insert lv_persons (c-level, score 90).
 *   4. If person has email/phone properties → insert lv_contacts.
 *   5. Batch 500 rows at a time.
 */

import { existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { vaultClient } from '../client'
import { logSync, bumpSourceStock } from '../log'
import type { LvPersonInsert, LvContactInsert, ConnectorOptions, SyncResult } from '../types'

const CACHE_DIR = '/root/leads-vault/cache/opensanctions'
const PEPS_FILE = join(CACHE_DIR, 'peps-entities.ftm.json')
const PEPS_URL = 'https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const BATCH_SIZE = 500

type FtmEntity = {
  id: string
  schema: string
  properties: Record<string, string[]>
}

function cacheAge(): number {
  try {
    return Date.now() - statSync(PEPS_FILE).mtimeMs
  } catch {
    return Infinity
  }
}

async function ensureDownload(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  if (cacheAge() < CACHE_TTL_MS) {
    console.log('[opensanctions] using cached PEPs dump (< 24h)')
    return
  }
  console.log(`[opensanctions] downloading ${PEPS_URL}`)
  await new Promise<void>((resolve, reject) => {
    const p = spawn('curl', ['-L', '--fail', '--retry', '3', '-o', PEPS_FILE, PEPS_URL], {
      stdio: 'inherit',
    })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`curl exit ${code}`))))
  })
}

function firstProp(props: Record<string, string[]>, key: string): string | null {
  return props[key]?.[0]?.trim() || null
}

function allProp(props: Record<string, string[]>, key: string): string[] {
  return (props[key] ?? []).map((v) => v.trim()).filter(Boolean)
}

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { first: null, last: parts[0] }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

export async function runOpenSanctionsIngest(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }

  try {
    await ensureDownload()

    const sb = vaultClient()

    // Sentinel company for PEPs (state/government context, no specific company)
    let sentinelCompanyId: string | null = null
    {
      const { data: existing } = await sb
        .from('lv_companies')
        .select('id')
        .eq('primary_source', 'opencorporates')
        .eq('crn', '__opensanctions_peps_sentinel__')
        .maybeSingle()
      if (existing) {
        sentinelCompanyId = (existing as { id: string }).id
      } else if (!opts.dryRun) {
        const { data: ins } = await sb
          .from('lv_companies')
          .insert({
            crn: '__opensanctions_peps_sentinel__',
            legal_name: 'OpenSanctions PEPs — Aggregate',
            country_iso: 'INT',
            primary_source: 'opencorporates',
            enrichment_score: 0,
          })
          .select('id')
          .single()
        sentinelCompanyId = (ins as { id: string } | null)?.id ?? null
      } else {
        sentinelCompanyId = '00000000-0000-0000-0000-000000000002'
      }
    }

    if (!sentinelCompanyId) {
      result.error = 'Could not create/find sentinel company for opensanctions'
      result.duration_ms = Date.now() - t0
      return result
    }

    const rl = createInterface({
      input: createReadStream(PEPS_FILE, 'utf8'),
      crlfDelay: Infinity,
    })

    const personBatch: LvPersonInsert[] = []
    // contacts need person_id which we don't have until after insert — defer to separate pass
    // For simplicity: collect emails in a side batch mapped to position in personBatch
    type ContactPending = { batchIdx: number; type: 'email' | 'phone'; value: string }
    const contactsPending: ContactPending[] = []

    const flush = async (): Promise<void> => {
      if (!personBatch.length) return
      if (!opts.dryRun) {
        const { data: inserted, error } = await sb
          .from('lv_persons')
          .insert(personBatch)
          .select('id')
        if (error && !error.message.includes('duplicate')) {
          console.error('[opensanctions] persons insert error', error.message)
          result.rows_skipped += personBatch.length
        } else {
          result.rows_inserted += personBatch.length
          // Insert contacts with resolved person_ids
          if (inserted && contactsPending.length) {
            const contactBatch: LvContactInsert[] = []
            for (const cp of contactsPending) {
              const personRow = (inserted as Array<{ id: string }>)[cp.batchIdx]
              if (personRow) {
                contactBatch.push({
                  person_id: personRow.id,
                  company_id: sentinelCompanyId!,
                  contact_type: cp.type,
                  contact_value: cp.value,
                  is_personal: false,
                  verify_status: 'unverified',
                  primary_source: 'opencorporates',
                })
              }
            }
            if (contactBatch.length) {
              const { error: ce } = await sb.from('lv_contacts').insert(contactBatch)
              if (ce && !ce.message.includes('duplicate')) {
                console.error('[opensanctions] contacts insert error', ce.message)
              }
            }
          }
        }
      } else {
        result.rows_inserted += personBatch.length
      }
      personBatch.length = 0
      contactsPending.length = 0
    }

    for await (const line of rl) {
      if (!line.trim()) continue
      result.rows_processed++

      let entity: FtmEntity
      try {
        entity = JSON.parse(line) as FtmEntity
      } catch {
        result.rows_skipped++
        continue
      }

      if (entity.schema !== 'Person') {
        continue
      }

      const props = entity.properties ?? {}
      const fullName =
        firstProp(props, 'name') ??
        [firstProp(props, 'firstName'), firstProp(props, 'lastName')].filter(Boolean).join(' ')

      if (!fullName) {
        result.rows_skipped++
        continue
      }

      const { first, last } = splitName(fullName)
      const position = firstProp(props, 'position') ?? 'PEP'
      const country = firstProp(props, 'country') ?? 'INT'

      const batchIdx = personBatch.length
      personBatch.push({
        company_id: sentinelCompanyId,
        full_name: fullName,
        first_name: first,
        last_name: last,
        role: position,
        role_seniority: 'c-level',
        decision_maker_score: 90,
        primary_source: 'opencorporates',
      })

      for (const email of allProp(props, 'email')) {
        contactsPending.push({ batchIdx, type: 'email', value: email })
      }
      for (const phone of allProp(props, 'phone')) {
        contactsPending.push({ batchIdx, type: 'phone', value: phone })
      }

      if (personBatch.length >= BATCH_SIZE) await flush()
      if (opts.limit && result.rows_inserted + personBatch.length >= opts.limit) break

      if (result.rows_processed % 10000 === 0) {
        console.log(
          `[opensanctions] processed=${result.rows_processed} inserted=${result.rows_inserted}`,
        )
      }
    }

    await flush()

    if (!opts.dryRun) {
      await bumpSourceStock({
        source_id: 'opencorporates',
        delta_count: result.rows_inserted,
        is_full_pull: !opts.delta,
      })
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    console.error('[opensanctions] fatal', result.error)
  } finally {
    result.duration_ms = Date.now() - t0
    if (!opts.dryRun) {
      await logSync({
        source_id: 'opencorporates',
        operation: opts.delta ? 'delta' : 'ingest',
        result,
      })
    }
  }

  return result
}
