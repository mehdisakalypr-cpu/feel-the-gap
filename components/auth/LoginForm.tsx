'use client'

/**
 * Login form — passkeys-first, password fallback.
 *
 * Features:
 *  - Mobile UA detection → biometric CTA is displayed FIRST and larger.
 *  - Conditional mediation: on mount, if isConditionalMediationAvailable(),
 *    we call navigator.credentials.get({mediation:'conditional',...}) so the
 *    OS autofill keyboard proposes the passkey directly.
 *  - Embedded webview detection (FBAN/FB_IAB/Instagram/TikTok/WeChat) →
 *    render a banner telling the user to open in Safari/Chrome.
 *  - Turnstile required in production (silent in tests).
 *  - Fetches a CSRF token at mount via GET /api/auth/csrf (needed for future
 *    POSTs; /login itself does NOT require CSRF by design — see route handler).
 *  - MFA gate: if response returns mfa_token → redirect /auth/mfa.
 *
 * AbortError / NotAllowedError on WebAuthn are swallowed silently (user cancel).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { PasskeyButton } from './PasskeyButton'
import { PasswordField } from './PasswordField'
import { TurnstileWidget } from './TurnstileWidget'
import { createSupabaseBrowser } from '@/lib/auth-v2/supabase'

const MOBILE_UA = /iPhone|iPad|iPod|Android/i
const BAD_WEBVIEW = /(FBAN|FB_IAB|FBAV|Instagram|TikTok|MicroMessenger|WeChat)/i

export interface LoginFormProps {
  postLoginPath?: string
  brand: { name: string; logoUrl?: string }
  turnstileSiteKey?: string | null
  registerPath?: string
  forgotPath?: string
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

export function LoginForm({
  postLoginPath = '/',
  brand,
  turnstileSiteKey,
  registerPath = '/auth/register',
  forgotPath = '/auth/forgot',
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isBadWebview, setIsBadWebview] = useState(false)
  const [conditionalReady, setConditionalReady] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // UA detection — client only
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setIsMobile(MOBILE_UA.test(navigator.userAgent))
    setIsBadWebview(BAD_WEBVIEW.test(navigator.userAgent))
  }, [])

  // Fetch CSRF token at mount (non-blocking).
  useEffect(() => {
    fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' }).catch(() => { /* noop */ })
  }, [])

  // Conditional mediation — start a background WebAuthn get() that the autofill
  // keyboard can surface. Do nothing if feature-detect fails.
  useEffect(() => {
    let cancelled = false
    async function armConditional() {
      try {
        const PKC = (window as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential
        if (!PKC || typeof PKC.isConditionalMediationAvailable !== 'function') return
        const ok = await PKC.isConditionalMediationAvailable()
        if (!ok || cancelled) return

        const startRes = await fetch('/api/auth/webauthn/authenticate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        })
        if (!startRes.ok || cancelled) return
        const startJson = await startRes.json() as {
          options?: {
            challenge: string
            rpId: string
            timeout?: number
            userVerification?: UserVerificationRequirement
            allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: AuthenticatorTransport[] }>
          }
          state?: string
        }
        if (!startJson?.options?.challenge) return

        setConditionalReady(true)
        const controller = new AbortController()
        abortRef.current = controller

        const cred = await navigator.credentials.get({
          mediation: 'conditional',
          signal: controller.signal,
          publicKey: {
            challenge: fromBase64Url(startJson.options.challenge),
            rpId: startJson.options.rpId,
            timeout: startJson.options.timeout ?? 60_000,
            userVerification: startJson.options.userVerification ?? 'preferred',
            allowCredentials: (startJson.options.allowCredentials ?? []).map(c => ({
              id: fromBase64Url(c.id),
              type: 'public-key',
              transports: c.transports,
            })),
          },
        }) as PublicKeyCredential | null

        if (!cred || cancelled) return

        const resp = cred.response as AuthenticatorAssertionResponse
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
        if (finishRes.ok && !cancelled) {
          window.location.assign(postLoginPath)
        }
      } catch (e: unknown) {
        const err = e as { name?: string }
        if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') return
        // silent — conditional UI is a progressive enhancement
      }
    }
    armConditional()
    return () => {
      cancelled = true
      try { abortRef.current?.abort() } catch { /* noop */ }
    }
  }, [postLoginPath])

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!email || !password) {
      setError('Identifiants invalides')
      return
    }
    setBusy(true)
    try {
      const captchaToken = turnstileToken || (typeof window !== 'undefined' ? window.__turnstileToken ?? null : null)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, captchaToken, remember }),
      })
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; require_mfa?: boolean; mfa_token?: string; access_token?: string; refresh_token?: string; token_hash?: string; type?: 'magiclink' | 'email'; error?: string }
        | null
      if (!res.ok || !json?.ok) {
        setError(json?.error === 'Accès non autorisé' ? 'Accès non autorisé' : 'Identifiants invalides')
        setBusy(false)
        return
      }
      if (json.require_mfa && json.mfa_token) {
        window.location.assign(`/auth/mfa?token=${encodeURIComponent(json.mfa_token)}`)
        return
      }
      const sb = createSupabaseBrowser()
      if (json.token_hash && json.type) {
        // Per-site password flow (Option C): server minted a magic-link hashed_token.
        const { error: otpErr } = await sb.auth.verifyOtp({
          token_hash: json.token_hash,
          type: json.type,
        })
        if (otpErr) {
          setError('Identifiants invalides')
          setBusy(false)
          return
        }
        window.location.assign(postLoginPath)
        return
      }
      if (json.access_token && json.refresh_token) {
        // Legacy path (kept for backwards compat if ever needed).
        const { error: setErr } = await sb.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        })
        if (setErr) {
          setError('Identifiants invalides')
          setBusy(false)
          return
        }
        window.location.assign(postLoginPath)
        return
      }
      // Unexpected shape
      setError('Identifiants invalides')
    } catch {
      setError('Identifiants invalides')
    } finally {
      setBusy(false)
    }
  }, [email, password, turnstileToken, busy, remember, postLoginPath])

  const PasskeyBlock = (
    <PasskeyButton
      postLoginPath={postLoginPath}
      brand={brand}
      label="Continuer avec Face ID / Touch ID / empreinte"
      className={isMobile ? 'mb-4' : 'mt-4'}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <header className="flex items-center gap-3">
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
        )}
        <h1 className="text-xl font-semibold">Connexion à {brand.name}</h1>
      </header>

      {isBadWebview && (
        <div className="rounded-md border border-amber-700 bg-amber-900/30 px-3 py-2 text-sm text-amber-200">
          Pour vous connecter avec la biométrie, ouvrez cette page dans Safari ou Chrome
          (pas dans l&apos;application Instagram/Facebook/TikTok).
        </div>
      )}

      {isMobile && PasskeyBlock}

      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-neutral-300">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username webauthn"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
            placeholder="vous@exemple.com"
          />
        </div>

        <PasswordField
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password webauthn"
          label="Mot de passe"
          required
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-neutral-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-900"
            />
            Rester connecté
          </label>
          <a href={forgotPath} className="text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline">
            Mot de passe oublié ?
          </a>
        </div>

        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            action="login"
            theme="dark"
            onChange={setTurnstileToken}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      {!isMobile && PasskeyBlock}

      <p className="text-center text-sm text-neutral-400">
        Pas encore de compte ?{' '}
        <a href={registerPath} className="text-neutral-200 underline-offset-2 hover:underline">
          Créer un compte
        </a>
      </p>

      {/* Hidden status for tests/debug */}
      <span data-testid="conditional-ready" className="hidden" data-ready={conditionalReady ? '1' : '0'} />
    </div>
  )
}

export default LoginForm
