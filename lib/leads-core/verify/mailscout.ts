/**
 * Mailscout SMTP verify — wraps batuhanaky/mailscout (port 25 SMTP)
 *
 * License: MIT — free
 * Throughput: ~30-60 verifications/min depending on target servers
 *
 * Falls back to a built-in regex+MX validation when the mailscout binary is
 * not installed locally. The regex/MX path is fast (~200/min) but only flags
 * obvious format/MX failures, not catch-all detection.
 */

import { vaultClient } from '../client'
import { logSync } from '../log'
import type { SyncResult } from '../types'
import { spawn } from 'child_process'
import { promises as dns } from 'dns'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/
const MX_CACHE = new Map<string, boolean>()

async function hasMx(domain: string): Promise<boolean> {
  if (MX_CACHE.has(domain)) return MX_CACHE.get(domain) as boolean
  try {
    const records = await dns.resolveMx(domain)
    const ok = records.length > 0
    MX_CACHE.set(domain, ok)
    return ok
  } catch {
    MX_CACHE.set(domain, false)
    return false
  }
}

async function quickValidate(email: string): Promise<{ status: 'valid' | 'invalid' | 'risky'; score: number }> {
  const m = email.match(EMAIL_RE)
  if (!m) return { status: 'invalid', score: 0 }
  const domain = m[1].toLowerCase()
  if (!(await hasMx(domain))) return { status: 'invalid', score: 0 }
  const local = email.split('@')[0]
  const isRole = /^(info|contact|hello|sales|admin|office|support|enquiries|enquiry|service|hr|jobs|careers|noreply|no-reply)$/i.test(local)
  return { status: isRole ? 'risky' : 'valid', score: isRole ? 50 : 80 }
}

async function mailscoutValidate(email: string): Promise<{ status: 'valid' | 'invalid' | 'risky' | 'catch-all'; score: number } | null> {
  return new Promise((resolve) => {
    const p = spawn('mailscout', ['--check', email], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    p.stdout.on('data', (b) => (out += b.toString()))
    p.on('error', () => resolve(null))
    p.on('exit', (code) => {
      if (code !== 0) return resolve(null)
      const text = out.toLowerCase()
      if (text.includes('catch-all')) return resolve({ status: 'catch-all', score: 30 })
      if (text.includes('valid') && !text.includes('invalid')) return resolve({ status: 'valid', score: 90 })
      if (text.includes('invalid')) return resolve({ status: 'invalid', score: 0 })
      return resolve({ status: 'risky', score: 50 })
    })
  })
}

export async function runMailscoutVerify(opts: { limit?: number; useBinary?: boolean } = {}): Promise<SyncResult> {
  const start = Date.now()
  const result: SyncResult = {
    rows_processed: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    duration_ms: 0,
  }
  const sb = vaultClient()
  const limit = opts.limit ?? 1000

  const { data: pending, error } = await sb
    .from('lv_contacts')
    .select('id, contact_value')
    .eq('contact_type', 'email')
    .eq('verify_status', 'unverified')
    .limit(limit)

  if (error) {
    result.error = error.message
    result.duration_ms = Date.now() - start
    return result
  }

  for (const c of pending ?? []) {
    result.rows_processed++
    let res = opts.useBinary ? await mailscoutValidate(c.contact_value as string) : null
    if (!res) res = await quickValidate(c.contact_value as string)

    const { error: updErr } = await sb
      .from('lv_contacts')
      .update({
        verify_status: res.status,
        verify_provider: opts.useBinary ? 'mailscout' : 'regex+mx',
        verify_score: res.score,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', c.id)
    if (updErr) result.rows_skipped++
    else result.rows_updated++
  }

  result.duration_ms = Date.now() - start
  await logSync({ source_id: 'mailscout', operation: 'verify', result })
  return result
}
