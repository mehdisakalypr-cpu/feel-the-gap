'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const redirectUrl = `${window.location.origin}/auth/reset-password`

    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
          {!sent ? (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
              <p className="text-gray-400 text-sm mb-6">
                Entrez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-3xl mb-4">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="M22 4L12 13 2 4"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Email envoyé</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-2">
                  Si un compte existe pour <span className="text-[#C9A84C] font-medium">{email}</span>, vous recevrez un lien de réinitialisation.
                </p>
                <p className="text-gray-500 text-xs mb-6">
                  Pensez à vérifier vos spams.
                </p>
              </div>
            </>
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
