'use client'

/**
 * Passkey button — explicit (non-conditional) WebAuthn authentication.
 *
 * Triggers the platform authenticator (Face ID / Touch ID / fingerprint) on
 * click. Uses the same POST /api/auth/webauthn/authenticate action=start/finish
 * flow as conditional mediation, but without the mediation:'conditional' hint.
 *
 * Passing `email` = narrow flow (server returns allowCredentials).
 * Omitting `email` = discoverable/resident-key flow (no allowCredentials).
 *
 * AbortError / NotAllowedError (user cancel) → silent, no error surfaced.
 */

import { useEffect, useState } from 'react'

export interface PasskeyButtonProps {
  email?: string
  postLoginPath: string
  brand: { name: string; logoUrl?: string }
  className?: string
  label?: string
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const pad = 4 - (s.length % 4)
  const b64 = (s + (pad < 4 ? '='.repeat(pad) : '')).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function PasskeyButton({ email, postLoginPath, brand, className, label }: PasskeyButtonProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  // hasCredential: tri-state — null = unknown, true = a passkey is registered for this
  // email on this site, false = none. We ONLY render the button when true, so new
  // visitors never see a non-functional CTA.
  const [hasCredential, setHasCredential] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Device capability check — once.
  useEffect(() => {
    let alive = true
    const PKC = typeof window !== 'undefined' ? (window as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential : undefined
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      setSupported(false)
      return
    }
    PKC.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(ok => { if (alive) setSupported(!!ok) })
      .catch(() => { if (alive) setSupported(false) })
    return () => { alive = false }
  }, [])

  // Server check — only show the button if a passkey actually exists for this email.
  useEffect(() => {
    if (!email || !supported) { setHasCredential(null); return }
    let alive = true
    const t = setTimeout(() => {
      fetch('/api/auth/webauthn/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
        .then(r => r.ok ? r.json() : null)
        .then((d: { available?: boolean } | null) => { if (alive) setHasCredential(!!d?.available) })
        .catch(() => { if (alive) setHasCredential(false) })
    }, 250) // debounce while user types
    return () => { alive = false; clearTimeout(t) }
  }, [email, supported])

  async function handleClick() {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      // 1) start
      const startRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', email }),
      })
      if (!startRes.ok) {
        setErr('Connexion par biométrie indisponible')
        return
      }
      const startJson = (await startRes.json()) as {
        ok?: boolean
        options?: {
          challenge: string
          rpId: string
          timeout?: number
          userVerification?: UserVerificationRequirement
          allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>
        }
        state?: string
      }
      if (!startJson?.options?.challenge) {
        setErr('Connexion par biométrie indisponible')
        return
      }
      const opts = startJson.options
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: fromBase64Url(opts.challenge),
        rpId: opts.rpId,
        timeout: opts.timeout ?? 60_000,
        userVerification: opts.userVerification ?? 'preferred',
        allowCredentials: (opts.allowCredentials ?? []).map(c => ({
          id: fromBase64Url(c.id),
          type: 'public-key',
          transports: c.transports,
        })),
      }
      // 2) navigator.credentials.get
      const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null
      if (!cred) {
        // user dismissed — silent
        return
      }
      const resp = cred.response as AuthenticatorAssertionResponse
      // 3) finish
      const finishRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'finish',
          state: startJson.state,
          credential: {
            id: cred.id,
            rawId: toBase64Url(cred.rawId),
            type: cred.type,
            response: {
              clientDataJSON: toBase64Url(resp.clientDataJSON),
              authenticatorData: toBase64Url(resp.authenticatorData),
              signature: toBase64Url(resp.signature),
              userHandle: resp.userHandle ? toBase64Url(resp.userHandle) : null,
            },
            clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
          },
        }),
      })
      if (!finishRes.ok) {
        setErr('Identifiants invalides')
        return
      }
      // Success — full reload so middleware picks up fresh cookies.
      window.location.assign(postLoginPath)
    } catch (e: unknown) {
      const err = e as { name?: string }
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        // silent cancel
        return
      }
      setErr('Connexion par biométrie échouée')
    } finally {
      setBusy(false)
    }
  }

  // Hide completely unless device supports AND a passkey is actually registered
  // for this email on this domain. Prevents a non-functional "aucune clé" click
  // for first-time visitors.
  if (supported === false) return null
  if (hasCredential !== true) return null

  return (
    <div className={className ?? ''}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || supported === null}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-600 bg-neutral-800 px-4 py-3 text-base font-medium text-neutral-100 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Se connecter à ${brand.name} avec la biométrie`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 1-4 4"/>
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 0 4 4"/>
          <path d="M4 18c2 2 5 3 8 3s6-1 8-3"/>
          <path d="M8 14c1 1 2 2 4 2s3-1 4-2"/>
        </svg>
        <span>{busy ? 'Authentification…' : (label ?? 'Continuer avec Face ID / Touch ID / empreinte')}</span>
      </button>
      {err && (
        <p className="mt-2 text-center text-xs text-neutral-400">{err}</p>
      )}
    </div>
  )
}

export default PasskeyButton
