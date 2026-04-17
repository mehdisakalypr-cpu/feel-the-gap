'use client'

import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/auth-v2/supabase'

export interface MfaFlowProps {
  brand: { name: string; logoUrl?: string }
  postLoginPath: string
  loginPath: string
}

export function MfaFlow({ brand, postLoginPath, loginPath }: MfaFlowProps) {
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const t = url.searchParams.get('token')
    if (!t) {
      window.location.assign(loginPath)
      return
    }
    setMfaToken(t)
  }, [loginPath])

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !mfaToken) return
    setError(null)
    const trimmed = code.trim()
    if (useRecovery ? trimmed.length < 10 : !/^\d{6}$/.test(trimmed)) {
      setError('Code invalide')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mfa_token: mfaToken,
          code: trimmed,
          kind: useRecovery ? 'recovery' : 'totp',
        }),
      })
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            error?: string
            access_token?: string
            refresh_token?: string
            token_hash?: string
            type?: 'magiclink' | 'email'
          }
        | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Code invalide ou expiré')
        setBusy(false)
        return
      }

      const sb = createSupabaseBrowser()
      if (json.access_token && json.refresh_token) {
        const { error: setErr } = await sb.auth.setSession({
          access_token: json.access_token,
          refresh_token: json.refresh_token,
        })
        if (setErr) throw setErr
      } else if (json.token_hash && json.type) {
        const { error: otpErr } = await sb.auth.verifyOtp({
          token_hash: json.token_hash,
          type: json.type,
        })
        if (otpErr) throw otpErr
      } else {
        throw new Error('invalid_response')
      }
      window.location.assign(postLoginPath)
    } catch {
      setError('Code invalide ou expiré')
      setBusy(false)
    }
  }, [mfaToken, code, useRecovery, busy, postLoginPath])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <header>
        <h1 className="text-xl font-semibold">Vérification en 2 étapes</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Entrez le code généré par votre application d’authentification pour continuer sur {brand.name}.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="mfa-code" className="text-sm text-neutral-300">
            {useRecovery ? 'Code de secours' : 'Code à 6 chiffres'}
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) =>
              setCode(useRecovery ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-neutral-100 focus:border-neutral-400 focus:outline-none"
            placeholder={useRecovery ? 'XXXX-XXXX-XX' : '••••••'}
            maxLength={useRecovery ? 32 : 6}
            autoFocus
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-60"
        >
          {busy ? 'Vérification…' : 'Vérifier'}
        </button>

        <button
          type="button"
          onClick={() => { setUseRecovery(v => !v); setCode('') }}
          className="text-center text-xs text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline"
        >
          {useRecovery ? 'Utiliser un code à 6 chiffres' : 'Utiliser un code de secours'}
        </button>
      </form>

      <a href={loginPath} className="text-center text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline">
        Retour à la connexion
      </a>
    </div>
  )
}

export default MfaFlow
