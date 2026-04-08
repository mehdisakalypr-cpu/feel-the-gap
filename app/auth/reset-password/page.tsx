'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
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
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    const code = searchParams.get('code')

    async function handleCode(authCode: string) {
      // 1. Exchange code for session (needed to identify the user)
      const { data, error: err } = await sb.auth.exchangeCodeForSession(authCode)
      if (err || !data.user) {
        setError('Lien expiré ou invalide. Demandez un nouveau lien.')
        setChecking(false)
        return
      }

      // 2. Save user ID for the API call
      userIdRef.current = data.user.id

      // 3. SECURITY: Sign out IMMEDIATELY — destroy the session
      // This prevents the recovery link from giving access to the app
      await sb.auth.signOut()

      // 4. Now the user has no session, only the form is available
      setReady(true)
      setChecking(false)
    }

    if (code) {
      handleCode(code)
      return
    }

    // Hash fragment flow: PASSWORD_RECOVERY event
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        userIdRef.current = session.user.id
        await sb.auth.signOut()
        setReady(true)
        setChecking(false)
      }
    })

    const timeout = setTimeout(() => setChecking(false), 3000)

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
    if (!userIdRef.current) {
      setError('Session expirée. Demandez un nouveau lien.')
      return
    }

    setLoading(true)

    // Call server-side API to update password (uses admin privileges, no session needed)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current, password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Erreur lors de la mise à jour.')
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/auth/login'), 2500)
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
              <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-bold text-white">Feel <span className="text-[#C9A84C]">The Gap</span></span>
        </div>

        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-7">
          {success ? (
            <div className="text-center">
              <div className="text-4xl text-emerald-400 mb-3">&#10003;</div>
              <h2 className="text-lg font-bold text-white mb-2">Mot de passe mis à jour</h2>
              <p className="text-gray-400 text-sm mb-1">Redirection vers la page de connexion...</p>
              <p className="text-gray-500 text-xs">Connectez-vous avec votre nouveau mot de passe.</p>
            </div>
          ) : checking ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">Vérification du lien...</p>
            </div>
          ) : ready ? (
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
              <p className="text-red-400 text-sm mb-4">{error || 'Lien invalide ou expiré.'}</p>
              <Link
                href="/auth/forgot"
                className="inline-block px-4 py-2 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm hover:bg-[#E8C97A] transition-colors"
              >
                Demander un nouveau lien
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
