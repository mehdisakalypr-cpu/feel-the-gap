// © 2025-2026 Feel The Gap — buyer login form (client)
'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'

interface Props {
  slug: string
  postLoginPath: string
}

export function LoginForm({ slug, postLoginPath }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const sb = createSupabaseBrowser()
      const { error: signInErr } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInErr) {
        setError(signInErr.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : signInErr.message)
        setBusy(false)
        return
      }
      router.push(postLoginPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible')
      setBusy(false)
    }
  }, [email, password, busy, router, postLoginPath])

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-6">
      <div className="space-y-1">
        <label htmlFor="store-login-email" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Email
        </label>
        <input
          id="store-login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="store-login-password" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Mot de passe
          </label>
          <Link href="/auth/forgot" className="text-[10px] text-[#C9A84C] hover:underline">
            Oublié ?
          </Link>
        </div>
        <input
          id="store-login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white focus:border-[#C9A84C] focus:outline-none"
        />
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !email || !password}
        className="w-full rounded-xl bg-[#C9A84C] px-4 py-3 text-sm font-bold text-[#07090F] hover:bg-[#E8C97A] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      {/* Hidden marker so we can keep `slug` referenced (future tracking hook). */}
      <input type="hidden" name="slug" value={slug} />
    </form>
  )
}
