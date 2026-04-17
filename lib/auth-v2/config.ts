/**
 * Canonical configuration resolver for Auth Brick v2.
 *
 * Each deployed project sets:
 *   AUTH_SITE_SLUG        — "feel-the-gap" | "one-for-all" | "command-center" | "the-estate"
 *   AUTH_APP_NAME         — human-readable RP name (e.g. "Feel The Gap")
 *   AUTH_PRIMARY_DOMAIN   — canonical public domain for WebAuthn rpId
 *   AUTH_ALLOWED_HOSTS    — CSV of extra RP origins (preview URLs, duckdns, localhost)
 *   AUTH_POST_LOGIN_PATH  — default redirect after successful login (e.g. "/map")
 *   AUTH_LOGIN_PATH       — default redirect for non-authenticated users (e.g. "/auth/login")
 *
 * Shared secrets (per-project):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   AUTH_CHALLENGE_SECRET        — 32+ random bytes, HMAC for WebAuthn challenges
 *   AUTH_OTP_PEPPER              — 32+ random bytes, peppers OTP hashes
 *   AUTH_TOTP_KEY                — 32 bytes base64, AES-GCM master key for TOTP secrets
 *   TURNSTILE_SECRET_KEY         — Cloudflare Turnstile backend
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY — Cloudflare Turnstile frontend
 *   RESEND_API_KEY               — email sender
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (optional — falls back to Postgres)
 */

export interface AuthConfig {
  siteSlug: string
  appName: string
  primaryDomain: string
  allowedHosts: Set<string>
  postLoginPath: string
  loginPath: string
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  secrets: {
    challenge: string
    otpPepper: string
    totpKey: string
    turnstileSecret: string | null
    resendKey: string | null
  }
  upstash: { url: string; token: string } | null
  env: 'development' | 'test' | 'production'
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`[auth-v2] missing env: ${name}`)
  return v
}

function optEnv(name: string): string | null {
  return process.env[name] || null
}

let cached: AuthConfig | null = null

export function getAuthConfig(): AuthConfig {
  if (cached) return cached

  const siteSlug = requireEnv('AUTH_SITE_SLUG')
  const appName = requireEnv('AUTH_APP_NAME')
  const primaryDomain = requireEnv('AUTH_PRIMARY_DOMAIN').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const allowed = (optEnv('AUTH_ALLOWED_HOSTS') ?? '').split(',').map(s => s.trim()).filter(Boolean)

  cached = {
    siteSlug,
    appName,
    primaryDomain,
    allowedHosts: new Set([primaryDomain, ...allowed, 'localhost']),
    postLoginPath: optEnv('AUTH_POST_LOGIN_PATH') ?? '/',
    loginPath: optEnv('AUTH_LOGIN_PATH') ?? '/auth/login',
    supabase: {
      url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    },
    secrets: {
      challenge: requireEnv('AUTH_CHALLENGE_SECRET'),
      otpPepper: requireEnv('AUTH_OTP_PEPPER'),
      totpKey: requireEnv('AUTH_TOTP_KEY'),
      turnstileSecret: optEnv('TURNSTILE_SECRET_KEY'),
      resendKey: optEnv('RESEND_API_KEY'),
    },
    upstash: (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
      ? { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }
      : null,
    env: (process.env.NODE_ENV as 'development' | 'test' | 'production') ?? 'development',
  }

  // Fail fast if secrets look like defaults
  for (const [k, v] of [
    ['AUTH_CHALLENGE_SECRET', cached.secrets.challenge],
    ['AUTH_OTP_PEPPER', cached.secrets.otpPepper],
    ['AUTH_TOTP_KEY', cached.secrets.totpKey],
  ] as const) {
    if (v.length < 32) throw new Error(`[auth-v2] ${k} must be >= 32 chars`)
  }

  return cached
}

/** Resolve the WebAuthn RP ID + origin for a given request host. */
export function resolveWebAuthnOrigin(host: string | null | undefined) {
  const cfg = getAuthConfig()
  const h = (host ?? cfg.primaryDomain).replace(/:\d+$/, '')
  const isVercelPreview = h.endsWith('.vercel.app')
  const isAllowed = cfg.allowedHosts.has(h) || isVercelPreview
  const rpId = isAllowed ? h : cfg.primaryDomain
  const scheme = (h === 'localhost' || h.startsWith('127.')) ? 'http' : 'https'
  return { rpId, origin: `${scheme}://${rpId}`, rpName: cfg.appName }
}

/** Test helper (unit tests only). */
export function resetConfigCache() { cached = null }
