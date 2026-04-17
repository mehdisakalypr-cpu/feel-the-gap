/**
 * Cloudflare Turnstile — server-side verify.
 * Skip only if TURNSTILE_SECRET_KEY is unset AND env === 'test' (unit tests).
 */

import { getAuthConfig } from './config'

export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getAuthConfig()
  if (!cfg.secrets.turnstileSecret) {
    return cfg.env === 'test' ? { ok: true } : { ok: false, reason: 'turnstile_not_configured' }
  }
  if (!token) return { ok: false, reason: 'turnstile_missing' }

  const body = new URLSearchParams()
  body.set('secret', cfg.secrets.turnstileSecret)
  body.set('response', token)
  if (ip) body.set('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)

  if (!res || !res.ok) return { ok: false, reason: 'turnstile_unreachable' }
  const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
  if (!data.success) return { ok: false, reason: (data['error-codes'] ?? ['turnstile_failed']).join(',') }
  return { ok: true }
}
