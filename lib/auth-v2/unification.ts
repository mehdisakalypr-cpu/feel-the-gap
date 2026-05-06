/**
 * Auth unification helper — detects multi-site credentials + mints one-time
 * cross-domain redirect token to hub.gapup.io/auth/unify.
 *
 * Trigger : after a successful login on a SaaS, if the email has credentials
 * on >1 site (auth_site_passwords + estate_users + hub_users union), the
 * client receives `unification_redirect_url` and routes there.
 *
 * Token format : base64url(`<email>|<originSite>|<exp>|<sig>`) — HMAC over
 * HUB_SHARED_SECRET, 5min TTL, single-use enforced via unification_tokens
 * table (token_hash unique constraint).
 */
import crypto from 'node:crypto'
import { supabaseAdmin } from './supabase-server'
import { isClientPoolSite, CLIENT_FACING_POOL } from './auth-pools'

const TOKEN_TTL_SEC = 5 * 60

function hubSecret(): string {
  const s = process.env.HUB_SHARED_SECRET
  if (!s || s.length < 32) throw new Error('HUB_SHARED_SECRET not set or too short')
  return s
}

function hubBaseUrl(): string {
  return process.env.NEXT_PUBLIC_HUB_URL || 'https://hub.gapup.io'
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', hubSecret()).update(payload).digest('hex')
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export type LegacyCredential = {
  source_table: string
  site_slug: string
  created_at: string
  superseded: boolean
}

export async function detectLegacyCredentials(email: string): Promise<LegacyCredential[]> {
  const admin = supabaseAdmin()
  const { data, error } = await admin.rpc('detect_legacy_credentials', { p_email: email })
  if (error) {
    console.error('[unification] detect_legacy_credentials failed:', error.message)
    return []
  }
  return (data ?? []) as LegacyCredential[]
}

/**
 * Returns true iff the email has credentials on >1 site of the CLIENT_FACING_POOL
 * (currently {ftg, hub}). Sites of the ADMIN_SEPARATE_POOL (cc, ofa, estate) are
 * EXPLICITLY IGNORED — they have separate credentials by design (security boundary).
 *
 * Voir lib/auth-v2/auth-pools.ts pour la rationale.
 */
export function needsUnification(creds: LegacyCredential[]): boolean {
  const activeClientPool = creds.filter(
    (c) => !c.superseded && isClientPoolSite(c.site_slug),
  )
  // Need >= 2 distinct sites of the client pool (e.g. ftg AND hub) to trigger
  const distinctSites = new Set(activeClientPool.map((c) => c.site_slug))
  return distinctSites.size >= 2
}

/** Filter helper exposed for the hub /auth/unify page UI */
export function filterClientPoolCredentials(creds: LegacyCredential[]): LegacyCredential[] {
  return creds.filter((c) => isClientPoolSite(c.site_slug))
}

export { CLIENT_FACING_POOL }

/**
 * Mints a cross-domain one-time token + persists hash to unification_tokens
 * (single-use enforced via DB unique index on token_hash).
 */
export async function createUnificationToken(
  email: string,
  originSite: string,
): Promise<{ token: string; redirectUrl: string }> {
  const expMs = Date.now() + TOKEN_TTL_SEC * 1000
  const body = `${email}|${originSite}|${expMs}`
  const sig = sign(body)
  const token = Buffer.from(`${body}|${sig}`).toString('base64url')
  const tokenHash = sha256(token)

  const admin = supabaseAdmin()
  const { error } = await admin.from('unification_tokens').insert({
    email,
    token_hash: tokenHash,
    origin_site: originSite,
    expires_at: new Date(expMs).toISOString(),
  })
  if (error) {
    console.error('[unification] failed to persist token:', error.message)
    throw new Error('unification_token_persist_failed')
  }

  // Mark hub_users.unification_pending=true (upsert to create the row if needed)
  await admin.from('hub_users').upsert(
    { email, unification_pending: true, password_hash: '' },
    { onConflict: 'email', ignoreDuplicates: false },
  )

  const redirectUrl = `${hubBaseUrl()}/auth/unify?t=${encodeURIComponent(token)}`
  return { token, redirectUrl }
}

/**
 * Verifies + consumes a unification token. Used by hub /api/auth/unify POST.
 * Returns the email if valid, null otherwise. Single-use enforced via
 * consumed_at timestamp (atomic check via UPDATE ... WHERE consumed_at IS NULL).
 */
export async function verifyAndConsumeToken(
  token: string,
): Promise<{ email: string; originSite: string } | null> {
  let payload: { email: string; originSite: string; expMs: number; sig: string }
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [email, originSite, expStr, sig] = decoded.split('|')
    if (!email || !originSite || !expStr || !sig) return null
    payload = { email, originSite, expMs: Number(expStr), sig }
  } catch {
    return null
  }

  // HMAC check
  const expectedSig = sign(`${payload.email}|${payload.originSite}|${payload.expMs}`)
  if (!crypto.timingSafeEqual(Buffer.from(payload.sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    return null
  }
  if (Date.now() > payload.expMs) return null

  // DB single-use check: atomic UPDATE WHERE consumed_at IS NULL
  const admin = supabaseAdmin()
  const tokenHash = sha256(token)
  const { data, error } = await admin
    .from('unification_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .select('email, origin_site')
    .maybeSingle()

  if (error || !data) return null
  return { email: data.email as string, originSite: data.origin_site as string }
}
