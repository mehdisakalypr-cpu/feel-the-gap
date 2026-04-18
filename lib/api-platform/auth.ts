/**
 * lib/api-platform/auth — Vague 3 #7 · 2026-04-18
 *
 * Middleware helper pour routes publiques `/api/v1/*` :
 *  - Extrait le bearer token de l'header Authorization
 *  - Hash SHA-256 → lookup en DB
 *  - Vérifie tier/rate-limit/revoked/expires_at
 *  - Log de l'appel (fire-and-forget)
 *
 * Tier → défaut (surchargé par rate_limit_per_min/day en DB) :
 *   starter    — 30/min · 10k/jour     · €12K/an
 *   pro        — 120/min · 100k/jour   · €40K/an
 *   enterprise — 600/min · 1M/jour     · €120K/an
 *   sovereign  — 3000/min · illimité   · €300K+/an (+ SLA)
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export type ApiTier = 'starter' | 'pro' | 'enterprise' | 'sovereign'

export const TIER_DEFAULTS: Record<ApiTier, { perMin: number; perDay: number; priceEurYear: number }> = {
  starter:    { perMin: 30,   perDay: 10_000,    priceEurYear: 12_000 },
  pro:        { perMin: 120,  perDay: 100_000,   priceEurYear: 40_000 },
  enterprise: { perMin: 600,  perDay: 1_000_000, priceEurYear: 120_000 },
  sovereign:  { perMin: 3000, perDay: 10_000_000, priceEurYear: 300_000 },
}

export type AuthedRequest = {
  token: {
    id: string
    owner_id: string
    tier: ApiTier
    permissions: string[]
    rate_limit_per_min: number
    rate_limit_per_day: number
  }
  ip: string
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(): { token: string; prefix: string; hash: string } {
  // Format: ftg_live_<24 hex> — prefix = 12 chars visibles
  const randomBytes = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 40)
  const token = `ftg_live_${randomBytes}`
  const prefix = token.slice(0, 16)
  const hash = hashToken(token)
  return { token, prefix, hash }
}

export async function authenticateApiRequest(req: Request, requiredScope?: string): Promise<
  | { ok: true; auth: AuthedRequest }
  | { ok: false; status: number; error: string; retryAfter?: number }
> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' }
  }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, status: 401, error: 'empty token' }

  const hash = hashToken(token)
  const sb = admin()
  const { data: row, error } = await sb
    .from('api_tokens')
    .select('id, owner_id, tier, permissions, rate_limit_per_min, rate_limit_per_day, revoked_at, expires_at')
    .eq('token_hash', hash)
    .maybeSingle()

  if (error || !row) return { ok: false, status: 401, error: 'invalid token' }
  if (row.revoked_at) return { ok: false, status: 401, error: 'token revoked' }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: 'token expired' }
  }
  if (requiredScope && !(row.permissions ?? []).includes(requiredScope) && !(row.permissions ?? []).includes('*')) {
    return { ok: false, status: 403, error: `missing scope: ${requiredScope}` }
  }

  // Rate-limit : per-min (hot) + per-day (quota)
  const perMin = await rateLimit({
    key: `api:${row.id}:min`,
    limit: row.rate_limit_per_min || TIER_DEFAULTS[row.tier as ApiTier].perMin,
    windowSec: 60,
  })
  if (!perMin.ok) {
    return { ok: false, status: 429, error: 'rate_limit_per_minute_exceeded', retryAfter: perMin.retryAfter }
  }
  const perDay = await rateLimit({
    key: `api:${row.id}:day`,
    limit: row.rate_limit_per_day || TIER_DEFAULTS[row.tier as ApiTier].perDay,
    windowSec: 86_400,
  })
  if (!perDay.ok) {
    return { ok: false, status: 429, error: 'rate_limit_per_day_exceeded', retryAfter: perDay.retryAfter }
  }

  return {
    ok: true,
    auth: {
      token: {
        id: row.id,
        owner_id: row.owner_id,
        tier: row.tier as ApiTier,
        permissions: row.permissions ?? [],
        rate_limit_per_min: row.rate_limit_per_min,
        rate_limit_per_day: row.rate_limit_per_day,
      },
      ip: getClientIp(req),
    },
  }
}

/** Log fire-and-forget d'un appel API pour monitoring. */
export function logApiCall(args: {
  tokenId: string | null
  path: string
  method: string
  status: number
  latencyMs: number
  ip: string
}): void {
  const sb = admin()
  void sb.from('api_calls_log').insert({
    token_id: args.tokenId,
    path: args.path,
    method: args.method,
    status: args.status,
    latency_ms: args.latencyMs,
    ip: args.ip,
  }).then(({ error }) => {
    if (error) console.error('[api-platform/log]', error.message)
  })
  // Bump usage_total + last_used_at (idempotent pour le monitoring)
  if (args.tokenId) {
    void sb.rpc('increment_api_token_usage', { p_token_id: args.tokenId }).then(({ error }) => {
      if (error) {
        // Fallback si RPC absent — update direct (best-effort)
        void sb.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', args.tokenId!)
      }
    })
  }
}
