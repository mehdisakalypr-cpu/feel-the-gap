/**
 * WebAuthn Level 3 — server-side helpers.
 *
 * - Passkeys-first: residentKey='required', authenticatorAttachment='platform'
 * - userVerification='preferred' (phishing resistance suffices, per SimpleWebAuthn guidance)
 *   but routes can upgrade to 'required' for admin/AAL3 flows.
 * - Stateless challenge: HMAC-signed (survives Vercel serverless cold starts).
 * - Per-site isolation via `site_slug` column.
 */

import crypto from 'node:crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type WebAuthnCredential,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import { getAuthConfig, resolveWebAuthnOrigin } from './config'
import { supabaseAdmin } from './supabase-server'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

interface StoredCredential {
  id: string
  user_id: string
  site_slug: string
  rp_id: string
  public_key: string
  counter: number
  transports: string[] | null
  device_name: string | null
  backup_eligible: boolean
  backup_state: boolean
}

// ── Challenge HMAC (stateless) ──────────────────────────────────────────────
function signChallenge(userId: string, challenge: string): string {
  const { secrets } = getAuthConfig()
  const expires = Date.now() + CHALLENGE_TTL_MS
  const payload = `${userId}:${challenge}:${expires}`
  const hmac = crypto.createHmac('sha256', secrets.challenge).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`
}

function verifyChallenge(userId: string, token: string): string | null {
  if (!token || typeof token !== 'string') return null
  const [payloadB64, hmac] = token.split('.')
  if (!payloadB64 || !hmac) return null
  const { secrets } = getAuthConfig()
  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const expected = crypto.createHmac('sha256', secrets.challenge).update(payload).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null
  const [storedUserId, challenge, expiresStr] = payload.split(':')
  if (storedUserId !== userId) return null
  if (Number(expiresStr) < Date.now()) return null
  return challenge
}

// ── Credential store ─────────────────────────────────────────────────────────
async function getCredentials(userId: string): Promise<StoredCredential[]> {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  const { data } = await sb.from('webauthn_credentials').select('*').eq('user_id', userId).eq('site_slug', siteSlug)
  return (data ?? []) as StoredCredential[]
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const sb = supabaseAdmin()
  const { data } = await sb.from('profiles').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

async function saveCredential(cred: Omit<StoredCredential, 'site_slug'>, siteSlug: string) {
  const sb = supabaseAdmin()
  const { error } = await sb.from('webauthn_credentials').insert({ ...cred, site_slug: siteSlug })
  if (error) throw new Error(`Save credential failed: ${error.message}`)
}

async function updateCounter(credId: string, newCounter: number, backupState?: boolean) {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  await sb.from('webauthn_credentials')
    .update({ counter: newCounter, backup_state: backupState ?? false, last_used_at: new Date().toISOString() })
    .eq('id', credId)
    .eq('site_slug', siteSlug)
}

// ── Registration ─────────────────────────────────────────────────────────────
export async function startRegistration(
  userId: string,
  userEmail: string,
  host: string | null,
  opts?: { adminGrade?: boolean }
) {
  const { siteSlug, appName } = getAuthConfig()
  const { rpId } = resolveWebAuthnOrigin(host)

  const existing = await getCredentials(userId)

  const options = await generateRegistrationOptions({
    rpName: appName,
    rpID: rpId,
    userName: userEmail,
    userDisplayName: userEmail,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.id,
      transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',  // mobile biometrics first
      residentKey: 'required',              // discoverable credentials (passkeys)
      userVerification: opts?.adminGrade ? 'required' : 'preferred',
    },
  })

  const challengeToken = signChallenge(userId, options.challenge)
  return { options, challengeToken, rpId, siteSlug }
}

export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  host: string | null,
  challengeToken: string,
  deviceName: string | null,
) {
  const { siteSlug } = getAuthConfig()
  const { rpId, origin } = resolveWebAuthnOrigin(host)
  const expectedChallenge = verifyChallenge(userId, challengeToken)
  if (!expectedChallenge) throw new Error('Challenge expired or invalid')

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: false,  // preferred, not required (standard passkey flow)
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed')
  }

  const { credential, credentialBackedUp, credentialDeviceType, aaguid } = verification.registrationInfo

  await saveCredential({
    id: credential.id,
    user_id: userId,
    rp_id: rpId,
    public_key: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: (credential.transports ?? []) as string[],
    device_name: deviceName,
    backup_eligible: credentialDeviceType === 'multiDevice',
    backup_state: credentialBackedUp,
  } as unknown as Omit<StoredCredential, 'site_slug'>, siteSlug)

  return { verified: true, credentialId: credential.id, aaguid }
}

// ── Authentication ───────────────────────────────────────────────────────────
/**
 * Start authentication.
 *   - If email provided: allowCredentials restricted to that user (server-side enumeration-safe).
 *   - If email omitted: discoverable credentials (Conditional UI / Passkey autofill).
 */
export async function startAuthentication(
  host: string | null,
  email?: string,
) {
  const { rpId } = resolveWebAuthnOrigin(host)

  let userId: string | null = null
  let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> = []

  if (email) {
    userId = await findUserIdByEmail(email)
    if (userId) {
      const creds = await getCredentials(userId)
      allowCredentials = creds.map(c => ({
        id: c.id,
        transports: (c.transports ?? []) as AuthenticatorTransportFuture[],
      }))
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials,           // empty → conditional UI / discoverable
    userVerification: 'preferred',
  })

  // Challenge bound to placeholder "anon" if email unknown (will be rebound after verify).
  const challengeToken = signChallenge(userId ?? 'anon', options.challenge)
  return { options, challengeToken, userId }
}

export async function finishAuthentication(
  response: AuthenticationResponseJSON,
  host: string | null,
  challengeToken: string,
) {
  const { rpId, origin } = resolveWebAuthnOrigin(host)

  // Locate credential by id (user_id may come from the response in conditional UI).
  const sb = supabaseAdmin()
  const { siteSlug } = getAuthConfig()
  const { data: credRow } = await sb.from('webauthn_credentials')
    .select('*').eq('id', response.id).eq('site_slug', siteSlug).maybeSingle()
  if (!credRow) throw new Error('Credential not found')
  const credential = credRow as StoredCredential

  // Challenge: allow either the specific userId OR 'anon' (conditional UI flow)
  const expectedChallenge =
    verifyChallenge(credential.user_id, challengeToken) ??
    verifyChallenge('anon', challengeToken)
  if (!expectedChallenge) throw new Error('Challenge expired or invalid')

  const stored: WebAuthnCredential = {
    id: credential.id,
    publicKey: Buffer.from(credential.public_key, 'base64url'),
    counter: credential.counter,
    transports: (credential.transports ?? []) as AuthenticatorTransportFuture[],
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    credential: stored,
    requireUserVerification: false,
  })

  if (!verification.verified) throw new Error('Authentication verification failed')

  await updateCounter(
    credential.id,
    verification.authenticationInfo.newCounter,
    verification.authenticationInfo.credentialBackedUp,
  )
  return { verified: true, userId: credential.user_id }
}

/** Does this user/site have any passkey registered? */
export async function hasCredentials(email: string): Promise<{ available: boolean; count: number }> {
  const userId = await findUserIdByEmail(email)
  if (!userId) return { available: false, count: 0 }
  const creds = await getCredentials(userId)
  return { available: creds.length > 0, count: creds.length }
}

/** Delete all of a user's passkeys for the current site (e.g., on password reset). */
export async function deleteCredentialsForUser(userId: string) {
  const { siteSlug } = getAuthConfig()
  const sb = supabaseAdmin()
  await sb.from('webauthn_credentials').delete().eq('user_id', userId).eq('site_slug', siteSlug)
}
