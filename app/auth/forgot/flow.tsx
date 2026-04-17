'use client'

/**
 * Forgot-password flow — client component.
 * See /auth/forgot/page.tsx for the step-by-step contract.
 */

import { useCallback, useEffect, useState } from 'react'
import { PasswordField } from '@/components/auth/PasswordField'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

type Step = 'email' | 'otp' | 'done'

export interface ForgotFlowProps {
  brand: { name: string; logoUrl?: string }
  loginPath: string
  turnstileSiteKey: string | null
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.split('; ').find(c => c.startsWith('csrf='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : null
}

export function ForgotFlow({ brand, loginPath, turnstileSiteKey }: ForgotFlowProps) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Prime CSRF cookie
  useEffect(() => {
    fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' }).catch(() => { /* noop */ })
  }, [])

  // Auto-redirect on done
  useEffect(() => {
    if (step !== 'done') return
    const t = setTimeout(() => { window.location.assign(loginPath) }, 2000)
    return () => clearTimeout(t)
  }, [step, loginPath])

  const submitEmail = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Email requis')
      return
    }
    setBusy(true)
    try {
      const captchaToken = turnstileToken || (typeof window !== 'undefined' ? window.__turnstileToken ?? null : null)
      const csrf = readCsrfCookie()
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), captchaToken }),
      })
      // Turnstile tokens are single-use; reset the widget to get a fresh one for the next step.
      try { window.turnstile?.reset() } catch { /* noop */ }
      setTurnstileToken(null)
      // ALWAYS advance — anti-enumeration.
      setStep('otp')
      setInfo('Si cet email existe, un code à 6 chiffres vient d’être envoyé.')
    } catch {
      try { window.turnstile?.reset() } catch { /* noop */ }
      setTurnstileToken(null)
      // Even on network error, advance to step 2 so we don't leak existence.
      setStep('otp')
      setInfo('Si cet email existe, un code à 6 chiffres vient d’être envoyé.')
    } finally {
      setBusy(false)
    }
  }, [email, turnstileToken, busy])

  const submitReset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setInfo(null)
    if (!/^\d{6}$/.test(code)) {
      setError('Code invalide')
      return
    }
    if (newPwd.length < 12) {
      setError('Mot de passe trop court (12 caractères minimum)')
      return
    }
    if (newPwd !== confirmPwd) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setBusy(true)
    try {
      const csrf = readCsrfCookie()
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          password: newPwd,
        }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Code invalide ou expiré')
        setBusy(false)
        return
      }
      setStep('done')
    } catch {
      setError('Code invalide ou expiré')
    } finally {
      setBusy(false)
    }
  }, [code, newPwd, confirmPwd, email, busy])

  const resendCode = useCallback(async () => {
    if (busy) return
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const captchaToken = turnstileToken || (typeof window !== 'undefined' ? window.__turnstileToken ?? null : null)
      const csrf = readCsrfCookie()
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), captchaToken }),
      })
      try { window.turnstile?.reset() } catch { /* noop */ }
      setTurnstileToken(null)
      setInfo('Si cet email existe, un nouveau code vient d’être envoyé.')
    } catch {
      try { window.turnstile?.reset() } catch { /* noop */ }
      setTurnstileToken(null)
      setInfo('Si cet email existe, un nouveau code vient d’être envoyé.')
    } finally {
      setBusy(false)
    }
  }, [email, turnstileToken, busy])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <header>
        <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Nous allons vous envoyer un code à 6 chiffres pour réinitialiser votre accès {brand.name}.
        </p>
      </header>

      {step === 'email' && (
        <form onSubmit={submitEmail} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="fg-email" className="text-sm text-neutral-300">Email</label>
            <input
              id="fg-email"
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
          {turnstileSiteKey && (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              action="forgot"
              theme="dark"
              onChange={setTurnstileToken}
            />
          )}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
          >
            {busy ? 'Envoi…' : 'Envoyer le code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={submitReset} className="flex flex-col gap-3">
          {info && <p className="text-sm text-neutral-300">{info}</p>}
          <div className="flex flex-col gap-1">
            <label htmlFor="fg-code" className="text-sm text-neutral-300">Code à 6 chiffres</label>
            <input
              id="fg-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-neutral-100 focus:border-neutral-400 focus:outline-none"
              placeholder="••••••"
            />
          </div>
          <PasswordField
            name="new-password"
            value={newPwd}
            onChange={setNewPwd}
            autoComplete="new-password"
            label="Nouveau mot de passe"
            required
            showStrength
            minLength={12}
          />
          <PasswordField
            name="confirm-password"
            value={confirmPwd}
            onChange={setConfirmPwd}
            autoComplete="new-password"
            label="Confirmer"
            required
            minLength={12}
          />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
          >
            {busy ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={busy}
            className="text-center text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline disabled:opacity-60"
          >
            Renvoyer le code
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">Mot de passe réinitialisé.</p>
          <p className="text-sm text-neutral-300">
            Vous allez être redirigé vers la page de connexion…
          </p>
          <a href={loginPath} className="text-center text-sm text-neutral-300 underline-offset-2 hover:underline">
            Continuer maintenant
          </a>
        </div>
      )}

      <a href={loginPath} className="text-center text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline">
        Retour à la connexion
      </a>
    </div>
  )
}

export default ForgotFlow
