'use client'

import { useCallback, useEffect, useState } from 'react'

export interface BiometricSetupFlowProps {
  brand: { name: string; logoUrl?: string }
  postLoginPath: string
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(c => c.startsWith('csrf='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : null
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

export function BiometricSetupFlow({ brand, postLoginPath }: BiometricSetupFlowProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' }).catch(() => { /* noop */ })
  }, [])

  useEffect(() => {
    const PKC = typeof window !== 'undefined' ? (window as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential : undefined
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      setSupported(false)
      return
    }
    PKC.isUserVerifyingPlatformAuthenticatorAvailable().then(ok => setSupported(!!ok)).catch(() => setSupported(false))
  }, [])

  const enroll = useCallback(async () => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const csrf = readCsrfCookie()
      const startRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'start' }),
      })
      if (!startRes.ok) {
        setError('Impossible de configurer la biométrie')
        setBusy(false)
        return
      }
      const startJson = await startRes.json() as {
        options?: {
          challenge: string
          rp: { name: string; id: string }
          user: { id: string; name: string; displayName: string }
          pubKeyCredParams: PublicKeyCredentialParameters[]
          timeout?: number
          excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>
          authenticatorSelection?: AuthenticatorSelectionCriteria
          attestation?: AttestationConveyancePreference
        }
        state?: string
      }
      if (!startJson?.options?.challenge) {
        setError('Impossible de configurer la biométrie')
        setBusy(false)
        return
      }

      const opts = startJson.options
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge: fromBase64Url(opts.challenge),
        rp: opts.rp,
        user: {
          id: fromBase64Url(opts.user.id),
          name: opts.user.name,
          displayName: opts.user.displayName,
        },
        pubKeyCredParams: opts.pubKeyCredParams,
        timeout: opts.timeout ?? 60_000,
        attestation: opts.attestation ?? 'none',
        excludeCredentials: (opts.excludeCredentials ?? []).map(c => ({
          id: fromBase64Url(c.id),
          type: 'public-key',
          transports: c.transports,
        })),
        authenticatorSelection: opts.authenticatorSelection ?? {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'preferred',
        },
      }

      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null
      if (!cred) return

      const resp = cred.response as AuthenticatorAttestationResponse
      const finishRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'finish',
          state: startJson.state,
          credential: {
            id: cred.id,
            rawId: toBase64Url(cred.rawId),
            type: cred.type,
            response: {
              clientDataJSON: toBase64Url(resp.clientDataJSON),
              attestationObject: toBase64Url(resp.attestationObject),
              transports: (resp as unknown as { getTransports?: () => AuthenticatorTransport[] }).getTransports?.() ?? [],
            },
            clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
          },
        }),
      })
      if (!finishRes.ok) {
        setError('Échec de l’enrôlement')
        setBusy(false)
        return
      }
      window.location.assign(postLoginPath)
    } catch (e: unknown) {
      const err = e as { name?: string }
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        // silent cancel
        setBusy(false)
        return
      }
      setError('Échec de l’enrôlement')
    } finally {
      setBusy(false)
    }
  }, [busy, postLoginPath])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <header>
        <h1 className="text-xl font-semibold">Configurer la connexion biométrique</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Activez Face ID / Touch ID / empreinte pour vous connecter à {brand.name}
          sans retaper votre mot de passe.
        </p>
      </header>

      {supported === false && (
        <div className="rounded-md border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
          Cet appareil ne supporte pas la biométrie. Vous pouvez continuer avec votre mot de passe.
        </div>
      )}

      <button
        type="button"
        onClick={enroll}
        disabled={busy || supported !== true}
        className="w-full rounded-md bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Configuration…' : 'Configurer Face ID / Touch ID / empreinte'}
      </button>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      <a
        href={postLoginPath}
        className="text-center text-sm text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
      >
        Plus tard
      </a>
    </div>
  )
}

export default BiometricSetupFlow
