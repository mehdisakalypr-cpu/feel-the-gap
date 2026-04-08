'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090F] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const sb = createSupabaseBrowser()

    // Method 1: PKCE flow — code in query params
    const code = searchParams.get('code')
    if (code) {
      sb.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) {
          setError('Lien expiré ou invalide. Demandez un nouveau lien.')
        } else {
          setSessionReady(true)
        }
        setChecking(false)
      })
      return
    }

    // Method 2: Hash fragment flow — tokens in URL hash (#access_token=...&type=recovery)
    // The Supabase browser client auto-detects this via onAuthStateChange
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionReady(true)
        setChecking(false)
      }
    })

    // Method 3: Check if there's already an active session (e.g. user navigated here manually)
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true)
      }
      setChecking(false)
    })

    // Give the hash fragment detection 3 seconds
    const timeout = setTimeout(() => {
      setChecking(false)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const sb = createSupabaseBrowser()
    const { error: err } = await sb.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/map'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/auth/login" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
              <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-bold text-white">Feel <span className="text-[#C9A84C]">The Gap</span></span>
        </Link>

        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-7">
          {success ? (
            <div className="text-center">
              <div className="text-4xl text-emerald-400 mb-3">&#10003;</div>
              <h2 className="text-lg font-bold text-white mb-2">Mot de passe mis à jour</h2>
              <p className="text-gray-400 text-sm">Redirection...</p>
            </div>
          ) : checking ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">Vérification du lien...</p>
            </div>
          ) : sessionReady ? (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Nouveau mot de passe</h1>
              <p className="text-gray-400 text-sm mb-6">Choisissez votre nouveau mot de passe (minimum 8 caractères).</p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Nouveau mot de passe</label>
                  <input
                    type="password" required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmer</label>
                  <input
                    type="password" required value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? 'Mise à jour...' : 'Changer le mot de passe'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              {error ? (
                <>
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                  <Link
                    href="/auth/forgot"
                    className="inline-block px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm hover:bg-[#E8C97A] transition-colors"
                  >
                    Demander un nouveau lien
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-4">Lien invalide ou expiré.</p>
                  <Link
                    href="/auth/forgot"
                    className="inline-block px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm hover:bg-[#E8C97A] transition-colors"
                  >
                    Demander un nouveau lien
                  </Link>
                </>
              )}
            </div>
          )}

          <Link
            href="/auth/login"
            className="block text-center text-sm text-gray-500 mt-4 hover:text-[#C9A84C] transition-colors"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
