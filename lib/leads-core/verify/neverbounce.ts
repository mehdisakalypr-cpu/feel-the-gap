/**
 * NeverBounce SMTP verify — paid SaaS validator.
 *
 * Why: VPS port 25 is blocked, regex+MX path produces ~30-60% false positives.
 * NeverBounce maintains catch-all detection + bounce-prediction at scale.
 *
 * Pricing: $0.008/credit (1k free at signup). 1216 emails ≈ $1.73 + 1k free.
 * API: https://developers.neverbounce.com/reference/single-check
 *
 * Auth: NEVERBOUNCE_API_KEY env var.
 *
 * Status mapping (NeverBounce → lv_contacts.verify_status):
 *   valid       → 'valid'
 *   invalid     → 'invalid'
 *   disposable  → 'invalid'  (burner mailbox)
 *   catchall    → 'catch-all'
 *   unknown     → 'risky'    (NB couldn't determine — keep but flag)
 *   accept_all  → 'catch-all'
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { SyncResult } from '../types'

const API_URL = 'https://api.neverbounce.com/v4/single/check'
const SLEEP_MS = 220 // ~4.5 req/s, well under their 60/s rate limit

type NbResult =
  | 'valid'
  | 'invalid'
  | 'disposable'
  | 'catchall'
  | 'unknown'
  | 'accept_all'

type NbResponse = {
  status: 'success' | 'auth_failure' | 'temp_unavail' | 'throttle_triggered' | 'bad_referrer' | 'general_failure'
  result?: NbResult
  flags?: string[]
  suggested_correction?: string
  execution_time?: number
  message?: string
}

async function checkOne(email: string, apiKey: string): Promise<NbResponse | null> {
  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return null
    return (await res.json()) as NbResponse
  } catch {
    return null
  }
}

function mapStatus(r: NbResult | undefined): {
  status: 'valid' | 'invalid' | 'risky' | 'catch-all'
  score: number
} {
  switch (r) {
    case 'valid': return { status: 'valid', score: 95 }
    case 'invalid': return { status: 'invalid', score: 0 }
    case 'disposable': return { status: 'invalid', score: 0 }
    case 'catchall': return { status: 'catch-all', score: 40 }
    case 'accept_all': return { status: 'catch-all', score: 40 }
    case 'unknown': return { status: 'risky', score: 50 }
    default: return { status: 'risky', score: 50 }
  }
}

export async function runNeverBounceVerify(opts: {
  limit?: number
  /** Only re-verify rows currently in these statuses. Default: only person-bound 'valid' (regex+mx). */
  reverifyStatuses?: string[]
  /** Restrict to person-bound emails (skip company-level info@/contact@). Default true. */
  personBoundOnly?: boolean
} = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 1000
  const reverifyStatuses = opts.reverifyStatuses ?? ['valid']
  const personBoundOnly = opts.personBoundOnly ?? true
  const apiKey = process.env.NEVERBOUNCE_API_KEY
  if (!apiKey) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: 'NEVERBOUNCE_API_KEY not set',
    }
  }

  const sb = vaultClient()
  let q = (sb.from as any)('lv_contacts')
    .select('id, contact_value, person_id')
    .eq('contact_type', 'email')
    .in('verify_status', reverifyStatuses)
    .not('contact_value', 'is', null)
    .neq('verify_provider', 'neverbounce')
    .limit(limit)
  if (personBoundOnly) q = q.not('person_id', 'is', null)

  const { data: pending, error } = await q
  if (error) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: error.message,
    }
  }

  const rows = (pending ?? []) as Array<{ id: string; contact_value: string; person_id: string | null }>
  let processed = 0
  let updated = 0
  let skipped = 0
  const counters = { valid: 0, invalid: 0, risky: 0, 'catch-all': 0 }

  for (const c of rows) {
    processed++
    const nb = await checkOne(c.contact_value, apiKey)
    if (!nb || nb.status !== 'success') {
      skipped++
      // Throttle hit → bail out (don't burn quota retrying)
      if (nb?.status === 'throttle_triggered' || nb?.status === 'auth_failure') {
        console.error(`[neverbounce] ${nb.status} — bailing out`)
        break
      }
      await new Promise((r) => setTimeout(r, SLEEP_MS))
      continue
    }
    const m = mapStatus(nb.result)
    counters[m.status]++
    const { error: updErr } = await (sb.from as any)('lv_contacts')
      .update({
        verify_status: m.status,
        verify_provider: 'neverbounce',
        verify_score: m.score,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', c.id)
    if (updErr) skipped++
    else updated++
    await new Promise((r) => setTimeout(r, SLEEP_MS))
  }

  const result: SyncResult = {
    rows_processed: processed,
    rows_inserted: 0,
    rows_updated: updated,
    rows_skipped: skipped,
    duration_ms: Date.now() - t0,
    metadata: counters,
  }

  await logSync({ source_id: 'mailscout', operation: 'verify', result })
  return result
}
