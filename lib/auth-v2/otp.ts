/**
 * OTP generation + verification (6-digit numeric).
 * - Generated via crypto.randomInt (not Math.random)
 * - Stored as sha256(otp + pepper) in DB
 * - TTL 10 minutes
 * - Max 5 attempts before consumption-regardless lockout
 * - Email hash used as lookup key (no plaintext email in table)
 */

import crypto from 'node:crypto'
import { getAuthConfig } from './config'
import { supabaseAdmin } from './supabase-server'

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

export type OtpPurpose = 'reset' | 'mfa_recover' | 'email_verify'

function sha256(input: string | Buffer): Buffer {
  return crypto.createHash('sha256').update(input).digest()
}

function hashEmail(email: string): Buffer {
  return sha256(email.trim().toLowerCase())
}

function hashCode(code: string): Buffer {
  const { secrets } = getAuthConfig()
  return sha256(code + '|' + secrets.otpPepper)
}

/** Generate & persist a 6-digit OTP. Returns plaintext for email delivery. */
export async function createOtp(opts: { email: string; purpose: OtpPurpose; ip?: string | null }): Promise<string> {
  const { siteSlug } = getAuthConfig()
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const sb = supabaseAdmin()

  // Invalidate any outstanding OTP for (email, purpose, site)
  await sb.from('auth_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email_hash', hashEmail(opts.email))
    .eq('site_slug', siteSlug)
    .eq('purpose', opts.purpose)
    .is('consumed_at', null)

  await sb.from('auth_otp_codes').insert({
    email_hash: hashEmail(opts.email),
    site_slug: siteSlug,
    purpose: opts.purpose,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    max_attempts: MAX_ATTEMPTS,
    created_ip: opts.ip ?? null,
  })

  return code
}

/**
 * Verify an OTP (constant-time-ish comparison via sha256 equality).
 * On success, marks consumed_at. On failure, increments attempts; past max → invalidates.
 */
export async function verifyOtp(opts: { email: string; purpose: OtpPurpose; code: string }): Promise<{ ok: boolean; reason?: 'invalid' | 'expired' | 'too_many' | 'consumed' }> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const emailHash = hashEmail(opts.email)
  const codeHash = hashCode(opts.code.trim())

  const { data: row } = await sb.from('auth_otp_codes')
    .select('id, code_hash, expires_at, attempts, max_attempts, consumed_at')
    .eq('email_hash', emailHash)
    .eq('site_slug', siteSlug)
    .eq('purpose', opts.purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return { ok: false, reason: 'invalid' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }
  if (row.attempts >= row.max_attempts) return { ok: false, reason: 'too_many' }

  // Constant-time byte compare.
  const dbHash = typeof row.code_hash === 'string'
    ? Buffer.from(row.code_hash.replace(/^\\x/, ''), 'hex')
    : Buffer.from(row.code_hash)
  const match = dbHash.length === codeHash.length &&
    crypto.timingSafeEqual(dbHash, codeHash)

  if (!match) {
    await sb.from('auth_otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    return { ok: false, reason: 'invalid' }
  }

  await sb.from('auth_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id)
  return { ok: true }
}
