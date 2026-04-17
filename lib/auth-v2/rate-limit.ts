/**
 * Rate limiting — sliding window.
 * Backends: Upstash Redis (if env vars present), Postgres (fallback), in-memory (last resort).
 *
 * Usage: await rateLimit({ key: `login:ip:${ip}`, limit: 5, windowSec: 300 })
 *
 * Expo backoff: optional, based on successive failures (tracked separately).
 */

import { getAuthConfig } from './config'
import { supabaseAdmin } from './supabase-server'

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  retryAfter: number
}

export async function rateLimit(opts: { key: string; limit: number; windowSec: number }): Promise<RateLimitResult> {
  const cfg = getAuthConfig()
  if (cfg.upstash) return upstashSlidingWindow(opts, cfg.upstash)
  try { return await pgSlidingWindow(opts) } catch { return memorySlidingWindow(opts) }
}

// ── Upstash ──────────────────────────────────────────────────────────────────
async function upstashSlidingWindow(
  opts: { key: string; limit: number; windowSec: number },
  u: { url: string; token: string },
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = opts.windowSec * 1000
  const member = `${now}:${Math.random().toString(36).slice(2)}`
  const windowKey = `rl:${opts.key}`

  // Pipeline: ZREMRANGEBYSCORE → ZADD → ZCARD → EXPIRE
  const body = [
    ['ZREMRANGEBYSCORE', windowKey, '0', String(now - windowMs)],
    ['ZADD', windowKey, String(now), member],
    ['ZCARD', windowKey],
    ['EXPIRE', windowKey, String(opts.windowSec + 60)],
  ]
  const res = await fetch(`${u.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)
  const json = (await res.json()) as Array<{ result?: number; error?: string }>
  const count = (json[2]?.result ?? 0)
  const remaining = Math.max(0, opts.limit - count)
  return { ok: count <= opts.limit, limit: opts.limit, remaining, retryAfter: count > opts.limit ? opts.windowSec : 0 }
}

// ── Postgres fallback (uses public.auth_rate_limit) ──────────────────────────
async function pgSlidingWindow(opts: { key: string; limit: number; windowSec: number }): Promise<RateLimitResult> {
  const sb = supabaseAdmin()
  const now = new Date()
  const bucket = new Date(Math.floor(now.getTime() / 1000 / opts.windowSec) * opts.windowSec * 1000)
  const since = new Date(now.getTime() - opts.windowSec * 1000)

  await sb.from('auth_rate_limit')
    .upsert({ key: opts.key, bucket_ts: bucket.toISOString(), count: 1 }, { onConflict: 'key,bucket_ts', ignoreDuplicates: false })

  // Increment atomically via rpc-like pattern (retry if race).
  const { data: upd } = await sb.rpc('auth_rate_limit_incr', { p_key: opts.key, p_bucket: bucket.toISOString() })
    .select()
    .single() as unknown as { data: { count: number } | null }
  if (!upd) {
    const { data } = await sb.from('auth_rate_limit').select('count').eq('key', opts.key).eq('bucket_ts', bucket.toISOString()).maybeSingle()
    // best-effort
    const count = (data?.count ?? 1)
    return result(opts, count)
  }
  // Sum last window buckets for true sliding semantics
  const { data: sums } = await sb.from('auth_rate_limit').select('count').eq('key', opts.key).gte('bucket_ts', since.toISOString())
  const total = (sums ?? []).reduce((s, r) => s + (r.count ?? 0), 0)
  return result(opts, total)
}

function result(opts: { limit: number; windowSec: number }, count: number): RateLimitResult {
  return {
    ok: count <= opts.limit,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - count),
    retryAfter: count > opts.limit ? opts.windowSec : 0,
  }
}

// ── Memory fallback (single-process; fine for dev) ───────────────────────────
type Bucket = { ts: number; count: number }
const memory = new Map<string, Bucket[]>()
function memorySlidingWindow(opts: { key: string; limit: number; windowSec: number }): RateLimitResult {
  const now = Date.now()
  const since = now - opts.windowSec * 1000
  const arr = (memory.get(opts.key) ?? []).filter(b => b.ts > since)
  arr.push({ ts: now, count: 1 })
  memory.set(opts.key, arr)
  const total = arr.reduce((s, b) => s + b.count, 0)
  return result(opts, total)
}

export function getClientIp(req: Request): string {
  const h = req.headers
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '0.0.0.0'
  )
}
