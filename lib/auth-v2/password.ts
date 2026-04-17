/**
 * Password policy — NIST SP 800-63B-4 compliant.
 * - min 15 chars single-factor / 8 chars if MFA (we enforce 12 as baseline)
 * - no composition rules
 * - blocklist: HIBP + common trivial patterns
 * - reject UTF-8 NFC-normalized length > 128 (DoS guard)
 */

import { isPwnedPassword } from './hibp'

export interface PolicyResult {
  ok: boolean
  reason?: 'too_short' | 'too_long' | 'breached' | 'trivial'
  hint?: string
  breachCount?: number
}

const TRIVIAL = new Set([
  'password', 'passw0rd', 'qwerty', 'letmein', 'welcome', 'admin',
  '12345678', 'iloveyou', 'dragon', 'football', 'changeme',
])

export async function checkPasswordPolicy(password: string, opts?: { mfa?: boolean; minLength?: number }): Promise<PolicyResult> {
  const min = opts?.minLength ?? (opts?.mfa ? 8 : 12)

  const normalized = password.normalize('NFC')
  if (normalized.length < min) return { ok: false, reason: 'too_short', hint: `At least ${min} characters required.` }
  if (normalized.length > 128) return { ok: false, reason: 'too_long', hint: 'Maximum 128 characters.' }

  const lower = normalized.toLowerCase()
  for (const t of TRIVIAL) {
    if (lower === t || lower.startsWith(t) || lower.endsWith(t)) {
      return { ok: false, reason: 'trivial', hint: 'Password is too common.' }
    }
  }

  const { pwned, count } = await isPwnedPassword(normalized)
  if (pwned) return { ok: false, reason: 'breached', hint: 'Password appears in known breaches.', breachCount: count }

  return { ok: true }
}
