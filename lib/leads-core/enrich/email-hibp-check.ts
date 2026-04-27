/**
 * HIBP (Have I Been Pwned) email enrichment — v1
 *
 * Auth:
 *  - HIBP Search (breach lookup per email): requires HIBP_API_KEY (€3.95/mo)
 *    GET https://haveibeenpwned.com/api/v3/breachedaccount/{email}
 *  - Pwned Passwords (k-anonymity SHA-1 prefix): no key required, free
 *    GET https://api.pwnedpasswords.com/range/{first5}
 *
 * Signal:
 *  - hibp_clean (score 100): email not in any known breach → confirmed active
 *  - hibp_pwned (score 60): email exists but is in one or more breaches
 *  - hibp_skipped: HIBP_API_KEY not set; metadata flag only
 *
 * Rate limit: 1 req / 1.5s (per HIBP ToS). Batch processes lv_contacts
 * where contact_type='email' AND verify_status NOT IN ('hibp_pwned', 'hibp_clean').
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { SyncResult } from '../types'

const HIBP_BASE = 'https://haveibeenpwned.com/api/v3'
const THROTTLE_MS = 1_500
const UA = 'gapup-leads-vault/2.0 (research; mehdi.sakalypr@gmail.com)'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

type HibpBreach = {
  Name: string
  BreachDate: string
  DataClasses: string[]
  IsVerified: boolean
  IsSensitive: boolean
}

async function fetchBreaches(email: string, apiKey: string): Promise<HibpBreach[] | null> {
  const url = `${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`
  let attempt = 0
  const backoffs = [5_000, 15_000, 45_000]
  while (attempt <= 3) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 15_000)
    try {
      const res = await fetch(url, {
        headers: {
          'hibp-api-key': apiKey,
          'User-Agent': UA,
          Accept: 'application/json',
        },
        signal: ac.signal,
      })
      clearTimeout(timer)
      if (res.status === 404) return []
      if (res.status === 200) {
        const data = (await res.json()) as HibpBreach[]
        return data
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
        await sleep(Math.max(retryAfter * 1000, 60_000))
        continue
      }
      if (res.status >= 500) {
        if (attempt === 3) return null
        await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
        attempt++
        continue
      }
      return null
    } catch {
      clearTimeout(timer)
      if (attempt === 3) return null
      await sleep(backoffs[Math.min(attempt, backoffs.length - 1)])
      attempt++
    }
  }
  return null
}

export async function runHibpCheck(opts: { limit?: number; dryRun?: boolean } = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
    metadata: {
      hibp_clean: 0,
      hibp_pwned: 0,
      hibp_skipped: 0,
      hibp_error: 0,
      api_key_present: false,
    },
  }

  const apiKey = process.env.HIBP_API_KEY ?? ''
  const hasKey = apiKey.length > 0
  ;(result.metadata!.api_key_present as unknown) = hasKey

  const sb = vaultClient()
  const batchLimit = opts.limit ?? 500

  const { data: pending, error } = await (sb.from as any)('lv_contacts')
    .select('id, contact_value')
    .eq('contact_type', 'email')
    .not('verify_status', 'in', '("hibp_pwned","hibp_clean")')
    .limit(batchLimit)

  if (error) {
    result.error = error.message
    result.duration_ms = Date.now() - start
    return result
  }

  for (const row of (pending ?? []) as Array<{ id: string; contact_value: string }>) {
    result.rows_processed++

    if (!hasKey) {
      if (!opts.dryRun) {
        await (sb.from as any)('lv_contacts').update({
          verify_provider: 'hibp',
          last_verified_at: new Date().toISOString(),
          metadata: { hibp_skipped: true },
        }).eq('id', row.id)
      }
      ;(result.metadata!.hibp_skipped as number)++
      result.rows_skipped++
      continue
    }

    await sleep(THROTTLE_MS)

    const breaches = await fetchBreaches(row.contact_value, apiKey)
    if (breaches === null) {
      ;(result.metadata!.hibp_error as number)++
      result.rows_skipped++
      continue
    }

    const isPwned = breaches.length > 0
    const newStatus = isPwned ? 'hibp_pwned' : 'hibp_clean'
    const newScore = isPwned ? 60 : 100

    const breachMeta = isPwned
      ? breaches.map((b) => ({
          name: b.Name,
          date: b.BreachDate,
          data_classes: b.DataClasses,
          verified: b.IsVerified,
        }))
      : []

    if (!opts.dryRun) {
      const { error: updErr } = await (sb.from as any)('lv_contacts').update({
        verify_status: newStatus,
        verify_score: newScore,
        verify_provider: 'hibp',
        last_verified_at: new Date().toISOString(),
        metadata: { breaches: breachMeta },
      }).eq('id', row.id)

      if (updErr) {
        result.rows_skipped++
        continue
      }
    }

    if (isPwned) {
      ;(result.metadata!.hibp_pwned as number)++
    } else {
      ;(result.metadata!.hibp_clean as number)++
    }
    result.rows_updated++
  }

  result.duration_ms = Date.now() - start
  if (!opts.dryRun) {
    await logSync({ source_id: 'mailscout', operation: 'verify', result })
  }
  return result
}
