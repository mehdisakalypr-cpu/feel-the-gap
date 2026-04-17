/**
 * TOTP — RFC 6238, 6-digit, 30s window, SHA-1 (compat Google Authenticator/1Password/Authy).
 * Secret is AES-GCM encrypted at rest with AUTH_TOTP_KEY.
 */

import crypto from 'node:crypto'
import { getAuthConfig } from './config'
import { supabaseAdmin } from './supabase-server'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD = 30
const DIGITS = 6

function randomBase32(bytes: number): string {
  const buf = crypto.randomBytes(bytes)
  let bits = '', out = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').toUpperCase()
  let bits = ''
  for (const c of clean) {
    const v = BASE32.indexOf(c)
    if (v < 0) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(secretB32: string, t: number): string {
  const counter = Math.floor(t / PERIOD)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', base32Decode(secretB32)).update(buf).digest()
  const off = hmac[hmac.length - 1] & 0x0f
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff)
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0')
}

function encrypt(secret: string): Buffer {
  const { secrets } = getAuthConfig()
  const key = Buffer.from(secrets.totpKey, 'base64').subarray(0, 32)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

function decrypt(blob: Buffer): string {
  const { secrets } = getAuthConfig()
  const key = Buffer.from(secrets.totpKey, 'base64').subarray(0, 32)
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const data = blob.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function createRecoveryCodes(n: number = 10): string[] {
  return Array.from({ length: n }, () =>
    crypto.randomBytes(5).toString('base64url').slice(0, 10).replace(/[-_]/g, 'x')
  )
}

// bytea must ship as `\x<hex>` wire format or Supabase JS silently JSON-ifies.
function toBytea(buf: Buffer): string {
  return '\\x' + buf.toString('hex')
}

export async function enrollTotp(userId: string, label: string): Promise<{ secret: string; otpauth: string; recovery: string[] }> {
  const { siteSlug, appName } = getAuthConfig()
  const sb = supabaseAdmin()
  const secret = randomBase32(20) // 160-bit
  const recovery = createRecoveryCodes(10)
  const recoveryHashes = recovery.map(c => toBytea(crypto.createHash('sha256').update(c).digest()))

  await sb.from('auth_totp').upsert({
    user_id: userId,
    site_slug: siteSlug,
    secret_enc: toBytea(encrypt(secret)),
    recovery_hashes: recoveryHashes,
    verified_at: null,
  }, { onConflict: 'user_id,site_slug' })

  const otpauth = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`
  return { secret, otpauth, recovery }
}

export async function verifyTotp(userId: string, code: string, opts?: { confirmEnrollment?: boolean }): Promise<{ ok: boolean }> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_totp')
    .select('secret_enc, verified_at')
    .eq('user_id', userId).eq('site_slug', siteSlug).maybeSingle()
  if (!data) return { ok: false }

  const secretEncBuf = typeof data.secret_enc === 'string'
    ? Buffer.from(data.secret_enc.replace(/^\\x/, ''), 'hex')
    : Buffer.from(data.secret_enc)
  const secret = decrypt(secretEncBuf)
  const now = Math.floor(Date.now() / 1000)
  const windows = [0, -1, 1]  // allow ±1 window (±30s) drift
  let ok = false
  for (const w of windows) {
    if (totp(secret, now + w * PERIOD) === code) { ok = true; break }
  }
  if (ok && opts?.confirmEnrollment && !data.verified_at) {
    await sb.from('auth_totp').update({ verified_at: new Date().toISOString() })
      .eq('user_id', userId).eq('site_slug', siteSlug)
  }
  return { ok }
}

export async function hasActiveTotp(userId: string): Promise<boolean> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_totp')
    .select('verified_at').eq('user_id', userId).eq('site_slug', siteSlug).maybeSingle()
  return !!data?.verified_at
}

export async function verifyRecoveryCode(userId: string, code: string): Promise<{ ok: boolean }> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('auth_totp')
    .select('recovery_hashes').eq('user_id', userId).eq('site_slug', siteSlug).maybeSingle()
  if (!data?.recovery_hashes) return { ok: false }
  const target = crypto.createHash('sha256').update(code).digest()
  const remaining: Buffer[] = []
  let match = false
  for (const b of data.recovery_hashes as unknown as Array<Buffer | string>) {
    const buf = typeof b === 'string' ? Buffer.from(b.replace(/^\\x/, ''), 'hex') : Buffer.from(b)
    if (!match && buf.length === target.length && crypto.timingSafeEqual(buf, target)) {
      match = true  // consume this one
    } else {
      remaining.push(buf)
    }
  }
  if (match) {
    await sb.from('auth_totp').update({ recovery_hashes: remaining.map(toBytea) })
      .eq('user_id', userId).eq('site_slug', siteSlug)
  }
  return { ok: match }
}

export async function disableTotp(userId: string) {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  await sb.from('auth_totp').delete().eq('user_id', userId).eq('site_slug', siteSlug)
}
