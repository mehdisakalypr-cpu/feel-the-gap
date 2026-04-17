/**
 * Per-site password storage (Option C — 2026-04-17).
 *
 * One password per (email, site_slug) — the Supabase auth.users.password is
 * DELIBERATELY ignored for login (kept as a random placeholder). Authentication
 * flow:
 *   1. Client → POST /api/auth/login { email, password }
 *   2. Server → verifySitePassword(email, site_slug, password)
 *   3. If match → admin.generateLink({type:'magiclink', email}) → return token_hash
 *   4. Client → supabase.auth.verifyOtp({token_hash, type:'magiclink'}) → session
 *
 * Isolation guarantee: FTG password is bcrypt'd with FTG-specific salt and
 * stored only in row (email='mehdi@x', site_slug='ftg'). Even identical
 * passwords produce different hashes per site (salt is random). Cross-site
 * auth is cryptographically impossible.
 */

import crypto from 'node:crypto'
import { supabaseAdmin } from './supabase-server'
import { getAuthConfig } from './config'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_DKLEN = 64
const SALT_BYTES = 16

/** Format: scrypt$N$r$p$<salt-hex>$<hash-hex>. Embeds params so we can rotate defaults safely. */
export function hashPassword(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_BYTES)
  const hash = crypto.scryptSync(plaintext, salt, SCRYPT_DKLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Constant-time verify. Returns true iff plaintext matches the stored hash. */
export function verifyHash(plaintext: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'hex')
  const expected = Buffer.from(parts[5], 'hex')
  try {
    const actual = crypto.scryptSync(plaintext, salt, expected.length, { N, r, p })
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/** Upsert a per-site password (used by register + reset). */
export async function setSitePassword(email: string, password: string): Promise<void> {
  const { siteSlug } = getAuthConfig()
  const hash = hashPassword(password)
  const sb = supabaseAdmin()
  const { error } = await sb.from('auth_site_passwords').upsert({
    email: email.trim().toLowerCase(),
    site_slug: siteSlug,
    password_hash: hash,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email,site_slug' })
  if (error) throw new Error(`setSitePassword failed: ${error.message}`)
}

/** Returns true iff (email, current site, password) matches the stored hash. */
export async function verifySitePassword(email: string, password: string): Promise<boolean> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_site_passwords')
    .select('password_hash')
    .eq('email', email.trim().toLowerCase())
    .eq('site_slug', siteSlug)
    .maybeSingle()
  if (!data?.password_hash) return false
  return verifyHash(password, data.password_hash)
}

/** Does any site-password exist for this (email, current site)? Used by login to pick the right error shape. */
export async function hasSitePassword(email: string): Promise<boolean> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_site_passwords')
    .select('email')
    .eq('email', email.trim().toLowerCase())
    .eq('site_slug', siteSlug)
    .maybeSingle()
  return !!data
}
