/**
 * Rate-limit — sliding-window counter keyed by IP (or custom key).
 *
 * Backends:
 *   1. Upstash Redis REST (if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      are present) — survives cold starts, shared across regions.
 *   2. In-memory Map fallback — per-instance, best-effort. Prints a warning
 *      on boot so the operator knows the limiter is not globally consistent.
 *
 * Usage:
 *   const rl = await rateLimit({ key: `login:${ip}`, limit: 5, windowSec: 300 })
 *   if (!rl.ok) return new Response('Too many', { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const HAS_UPSTASH = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

if (!HAS_UPSTASH && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn('[rate-limit] UPSTASH not configured — using in-memory fallback (per-instance, not consistent across Vercel regions). Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production.')
}

type MemoryEntry = { hits: number[]; }
const MEM = new Map<string, MemoryEntry>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  limit: number
  retryAfter: number // seconds
}

export interface RateLimitOptions {
  key: string
  limit: number
  windowSec: number
}

export async function rateLimit({ key, limit, windowSec }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = windowSec * 1000

  if (HAS_UPSTASH) {
    try {
      return await upstashLimit(key, limit, windowSec, now)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[rate-limit] Upstash error, falling back to memory:', err)
    }
  }

  // In-memory sliding window
  const entry = MEM.get(key) ?? { hits: [] }
  // drop expired
  entry.hits = entry.hits.filter(t => now - t < windowMs)
  if (entry.hits.length >= limit) {
    const oldest = entry.hits[0]
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    MEM.set(key, entry)
    return { ok: false, remaining: 0, limit, retryAfter }
  }
  entry.hits.push(now)
  MEM.set(key, entry)
  // Opportunistic GC
  if (MEM.size > 10_000) {
    for (const [k, v] of MEM) {
      if (v.hits.length === 0 || now - v.hits[v.hits.length - 1] > windowMs) MEM.delete(k)
    }
  }
  return { ok: true, remaining: limit - entry.hits.length, limit, retryAfter: 0 }
}

async function upstashLimit(key: string, limit: number, windowSec: number, now: number): Promise<RateLimitResult> {
  // Use Redis INCR with EXPIRE (fixed window — simpler and cheaper than sliding)
  const bucket = Math.floor(now / 1000 / windowSec)
  const rkey = `rl:${key}:${bucket}`

  // Pipeline: INCR + EXPIRE
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', rkey],
      ['EXPIRE', rkey, String(windowSec)],
    ]),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)
  const data = await res.json() as Array<{ result: number | string }>
  const count = Number(data?.[0]?.result ?? 0)
  const remaining = Math.max(0, limit - count)
  if (count > limit) {
    const retryAfter = windowSec - Math.floor((now / 1000) % windowSec)
    return { ok: false, remaining: 0, limit, retryAfter }
  }
  return { ok: true, remaining, limit, retryAfter: 0 }
}

/** Extract best-effort client IP from a Request/NextRequest. */
export function getClientIp(req: Request | { headers: Headers }): string {
  const h = req.headers
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = h.get('x-real-ip')
  if (real) return real.trim()
  const vercel = h.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]!.trim()
  return 'unknown'
}
