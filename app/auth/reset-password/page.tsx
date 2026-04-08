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
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const resetTokenRef = useRef<string | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const sb = createSupabaseBrowser()

    // Method 1: PKCE flow — code in query params (?code=...)
    async function obtainResetToken(uid: string) {
      const res = await fetch(`/api/auth/reset-password?userId=${uid}`)
      if (res.ok) {
        const { token } = await res.json()
        resetTokenRef.current = token
      }
    }

    const code = searchParams.get('code')
    if (code) {
      sb.auth.exchangeCodeForSession(code).then(async ({ data, error: err }) => {
        if (err || !data.user) {
          setError('Lien expiré ou invalide. Demandez un nouveau lien.')
          setChecking(false)
          return
        }
        userIdRef.current = data.user.id
        await obtainResetToken(data.user.id)
        await sb.auth.signOut()
        setReady(true)
        setChecking(false)
      })
      return
    }

    // Method 2: Implicit flow — tokens in hash fragment (#access_token=...&type=recovery)
    // The Supabase browser client auto-detects hash tokens on init.
    // We listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        userIdRef.current = session.user.id
        await obtainResetToken(session.user.id)
        await sb.auth.signOut()
        setReady(true)
        setChecking(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        const hash = window.location.hash
        if (hash.includes('type=recovery')) {
          userIdRef.current = session.user.id
          await obtainResetToken(session.user.id)
          await sb.auth.signOut()
          setReady(true)
          setChecking(false)
        }
      }
    })

    // Method 3: Manual hash parsing as fallback
    // Some Supabase versions send: #access_token=...&type=recovery&...
    const hash = window.location.hash.substring(1)
    if (hash && hash.includes('type=recovery')) {
      // Let onAuthStateChange handle it — the Supabase client will process the hash
      // Give it time
      setTimeout(() => {
        if (!ready) {
          // Try to get session that was set from hash
          sb.auth.getSession().then(async ({ data }) => {
            if (data.session?.user) {
              userIdRef.current = data.session.user.id
              await obtainResetToken(data.session.user.id)
              await sb.auth.signOut()
              setReady(true)
            }
            setChecking(false)
          })
        }
      }, 2000)
    } else {
      // No code and no hash — invalid link
      setTimeout(() => setChecking(false), 2000)
    }

    return () => {
      subscription.unsubscribe()
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
    if (!userIdRef.current || !resetTokenRef.current) {
      setError('Session expirée. Demandez un nouveau lien.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userIdRef.current, password, resetToken: resetTokenRef.current }),
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
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'} required value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      autoFocus
                      className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                      {showPwd ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmer</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'} required value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Retapez le mot de passe"
                      className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                      {showConfirm ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
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
