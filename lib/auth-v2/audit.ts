/**
 * Append-only audit log (auth_events).
 * Events use a stable controlled vocabulary (cf. AuthEventType).
 */

import crypto from 'node:crypto'
import { getAuthConfig } from './config'
import { supabaseAdmin } from './supabase-server'

export type AuthEventType =
  | 'login_ok'
  | 'login_fail'
  | 'login_rate_limited'
  | 'register_ok'
  | 'register_fail'
  | 'logout'
  | 'reset_request'
  | 'reset_verify_ok'
  | 'reset_verify_fail'
  | 'reset_completed'
  | 'passkey_registered'
  | 'passkey_auth_ok'
  | 'passkey_auth_fail'
  | 'passkey_deleted'
  | 'mfa_enrolled'
  | 'mfa_verify_ok'
  | 'mfa_verify_fail'
  | 'mfa_disabled'
  | 'magic_link_sent'
  | 'magic_link_verified'
  | 'session_revoked'
  | 'site_access_granted'
  | 'site_access_revoked'

export async function logEvent(e: {
  userId?: string | null
  event: AuthEventType
  ip?: string | null
  ua?: string | null
  meta?: Record<string, unknown>
}) {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const ua_hash = e.ua ? crypto.createHash('sha256').update(e.ua).digest() : null
  try {
    await sb.from('auth_events').insert({
      user_id: e.userId ?? null,
      site_slug: siteSlug,
      event: e.event,
      ip: e.ip ?? null,
      ua_hash,
      meta: e.meta ?? {},
    })
  } catch {
    // Never break auth flow on audit failure
  }
}
