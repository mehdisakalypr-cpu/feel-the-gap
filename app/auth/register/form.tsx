'use client'

/**
 * Register form — client component.
 *
 * Flow: submit → POST /api/auth/register → show "Vérifiez votre email" screen.
 * Server is expected to send a verification email and create auth_site_access
 * on verify. We do NOT auto-login even if the API returned tokens, because the
 * email confirmation loop is the authoritative trust event.
 */

import { useCallback, useEffect, useState } from 'react'
import { PasswordField } from '@/components/auth/PasswordField'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

export interface RegisterFormProps {
  brand: { name: string; logoUrl?: string }
  turnstileSiteKey: string | null
  loginPath: string
  postLoginPath: string
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(c => c.startsWith('csrf='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : null
}

export function RegisterForm({ brand, turnstileSiteKey, loginPath }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Prime CSRF cookie
  useEffect(() => {
    fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' }).catch(() => { /* noop */ })
  }, [])

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!email || !password || !displayName) {
      setError('Tous les champs sont requis')
      return
    }
    if (password.length < 12) {
      setError('Mot de passe trop court (12 caractères minimum)')
      return
    }
    setBusy(true)
    try {
      const csrf = readCsrfCookie()
      const captchaToken = turnstileToken || (typeof window !== 'undefined' ? window.__turnstileToken ?? null : null)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          display_name: displayName.trim(),
          captchaToken,
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Inscription impossible')
        setBusy(false)
        return
      }
      setDone(true)
    } catch {
      setError('Inscription impossible')
    } finally {
      setBusy(false)
    }
  }, [email, password, displayName, busy, turnstileToken])

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
        <h1 className="text-xl font-semibold">Vérifiez votre email</h1>
        <p className="text-sm text-neutral-300">
          Nous avons envoyé un lien de confirmation à <span className="font-mono">{email}</span>.
          Cliquez dessus pour activer votre compte {brand.name}.
        </p>
        <p className="text-xs text-neutral-500">
          Pensez à vérifier le dossier spam. Le lien expire après 1 heure.
        </p>
        <a href={loginPath} className="mt-2 text-center text-sm text-neutral-300 underline-offset-2 hover:underline">
          Retour à la connexion
        </a>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <header>
        <h1 className="text-xl font-semibold">Créer un compte {brand.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Un email de confirmation vous sera envoyé.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="reg-name" className="text-sm text-neutral-300">Nom</label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-400 focus:outline-none"
            maxLength={80}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reg-email" className="text-sm text-neutral-300">Email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-400 focus:outline-none"
          />
        </div>

        <PasswordField
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          label="Mot de passe"
          required
          showStrength
          minLength={12}
        />

        {turnstileSiteKey && (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            action="register"
            theme="dark"
            onChange={setTurnstileToken}
          />
        )}

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
        >
          {busy ? 'Création…' : 'Créer le compte'}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-400">
        Déjà inscrit ?{' '}
        <a href={loginPath} className="text-neutral-200 underline-offset-2 hover:underline">
          Se connecter
        </a>
      </p>
    </div>
  )
}

export default RegisterForm
