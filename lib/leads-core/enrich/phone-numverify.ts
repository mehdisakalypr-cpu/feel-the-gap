/**
 * NumVerify phone validation — v1
 *
 * Validates lv_contacts.contact_value (where contact_type='phone') via
 * NumVerify free API (apilayer.net). Identifies mobile vs landline vs voip,
 * carrier, country. Updates verify_status / verify_provider / verify_score.
 *
 * Auth:
 *  - NUMVERIFY_API_KEY (free tier 100/mo at numverify.com).
 *  - If absent → mode 'skip' (sets metadata flag, no DB writes).
 *
 * Free tier: HTTP only (no HTTPS) on free plan. Paid uses HTTPS.
 *
 * Score mapping (mobile-first since user goal is "fiabiliser les mobiles"):
 *  - valid + line_type='mobile'                      → 'valid'    score 100
 *  - valid + line_type='landline'                    → 'valid'    score 80
 *  - valid + line_type='voip'                        → 'risky'    score 50
 *  - valid + line_type∈{tollfree,premium_rate}       → 'risky'    score 40
 *  - !valid                                          → 'invalid'  score 0
 *
 * Rate limit: ~5 req/s safely (free tier no documented hard limit).
 * We throttle to 250ms to stay polite + avoid burning monthly quota fast.
 *
 * Idempotency: reprocesses only contacts where verify_provider != 'numverify'
 * OR verify_status='unverified' (cheap re-check on next pass).
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { ConnectorOptions, SyncResult } from '../types'

const FREE_BASE = 'http://apilayer.net/api/validate'
const PAID_BASE = 'https://apilayer.net/api/validate'
const THROTTLE_MS = 250

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

type NumverifyResp =
  | {
      valid: boolean
      number: string
      local_format: string
      international_format: string
      country_prefix: string
      country_code: string
      country_name: string
      location: string
      carrier: string
      line_type:
        | 'mobile'
        | 'landline'
        | 'special_services'
        | 'toll_free'
        | 'premium_rate'
        | 'voip'
        | 'pager'
        | 'unknown'
        | null
    }
  | { success: false; error: { code: number; type: string; info: string } }

function scoreFromLineType(valid: boolean, lt: string | null | undefined): {
  status: 'valid' | 'invalid' | 'risky'
  score: number
} {
  if (!valid) return { status: 'invalid', score: 0 }
  switch (lt) {
    case 'mobile':
      return { status: 'valid', score: 100 }
    case 'landline':
      return { status: 'valid', score: 80 }
    case 'voip':
      return { status: 'risky', score: 50 }
    case 'toll_free':
    case 'premium_rate':
    case 'special_services':
      return { status: 'risky', score: 40 }
    default:
      return { status: 'valid', score: 70 }
  }
}

async function validateOne(
  number: string,
  apiKey: string,
  paid: boolean
): Promise<NumverifyResp | null> {
  const base = paid ? PAID_BASE : FREE_BASE
  const url = `${base}?access_key=${apiKey}&number=${encodeURIComponent(number)}&format=1`
  let attempt = 0
  const backoffs = [3_000, 9_000, 27_000]
  while (attempt <= 3) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 12_000)
    try {
      const res = await fetch(url, { signal: ac.signal })
      clearTimeout(timer)
      if (res.status === 200) return (await res.json()) as NumverifyResp
      if (res.status === 429) {
        await sleep(60_000)
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

export async function runPhoneNumverify(opts: ConnectorOptions = {}): Promise<SyncResult> {
  const t0 = Date.now()
  const limit = opts.limit ?? 100
  const dryRun = !!opts.dryRun
  const apiKey = process.env.NUMVERIFY_API_KEY
  const paid = process.env.NUMVERIFY_PLAN === 'paid'

  console.log(
    `[phone-numverify] start limit=${limit} dryRun=${dryRun} keySet=${!!apiKey} plan=${paid ? 'paid' : 'free'}`
  )

  if (!apiKey) {
    console.warn('[phone-numverify] NUMVERIFY_API_KEY absent — skip mode')
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      metadata: { skipped: 'no_api_key' },
    }
  }

  const supa = vaultClient()

  const { data: contacts, error: fetchErr } = (await (supa.from as any)('lv_contacts')
    .select('id, contact_value, verify_status, verify_provider')
    .eq('contact_type', 'phone')
    .or('verify_provider.is.null,verify_provider.neq.numverify,verify_status.eq.unverified')
    .limit(limit)) as { data: Array<{ id: string; contact_value: string; verify_status: string | null; verify_provider: string | null }> | null; error: { message: string } | null }

  if (fetchErr) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      error: fetchErr.message,
    }
  }

  const total = contacts?.length ?? 0
  console.log(`[phone-numverify] ${total} contacts to validate`)
  if (total === 0) {
    return {
      rows_processed: 0,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      duration_ms: Date.now() - t0,
      metadata: { reason: 'no_pending_contacts' },
    }
  }

  let updated = 0
  let invalid = 0
  let skipped = 0
  let mobile = 0
  let landline = 0
  let voip = 0
  let api_calls = 0

  for (const c of contacts ?? []) {
    const num = (c.contact_value ?? '').replace(/[^\d+]/g, '')
    if (!num || num.length < 6) {
      skipped++
      continue
    }
    const r = await validateOne(num, apiKey, paid)
    api_calls++
    if (!r || ('success' in r && r.success === false)) {
      skipped++
      await sleep(THROTTLE_MS)
      continue
    }
    const ok = r as Extract<NumverifyResp, { valid: boolean }>
    const { status, score } = scoreFromLineType(ok.valid, ok.line_type)
    if (ok.line_type === 'mobile') mobile++
    else if (ok.line_type === 'landline') landline++
    else if (ok.line_type === 'voip') voip++
    if (!ok.valid) invalid++

    if (!dryRun) {
      const { error: updErr } = (await (supa.from as any)('lv_contacts')
        .update({
          contact_value: ok.international_format || c.contact_value,
          verify_status: status,
          verify_provider: 'numverify',
          verify_score: score,
        })
        .eq('id', c.id)) as { error: { message: string } | null }
      if (updErr) {
        console.error(`[phone-numverify] update id=${c.id}: ${updErr.message}`)
        skipped++
      } else {
        updated++
      }
    } else {
      updated++
    }
    await sleep(THROTTLE_MS)
  }

  const duration = Date.now() - t0
  const result: SyncResult = {
    rows_processed: total,
    rows_inserted: 0,
    rows_updated: updated,
    rows_skipped: skipped,
    duration_ms: duration,
    metadata: { api_calls, mobile, landline, voip, invalid, paid },
  }
  await logSync({ source_id: 'numverify', operation: 'verify', result })
  return result
}
