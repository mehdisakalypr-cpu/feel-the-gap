'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email')
  const [error, setError] = useState<string | null>(null)

  // Step 1: Send OTP code to email
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const sb = createSupabaseBrowser()
    const { error: err } = await sb.auth.resetPasswordForEmail(email)

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setStep('otp')
    }
  }

  // Step 2: Verify OTP + set new password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const sb = createSupabaseBrowser()

    // Verify OTP and get a session
    const { error: verifyErr } = await sb.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'recovery',
    })

    if (verifyErr) {
      setLoading(false)
      setError('Code invalide ou expiré. Vérifiez le code reçu par email.')
      return
    }

    // Now we have a valid session — update the password
    const { error: updateErr } = await sb.auth.updateUser({ password: newPassword })

    if (updateErr) {
      setLoading(false)
      setError(updateErr.message || 'Erreur lors de la mise à jour.')
      return
    }

    await sb.auth.signOut()
    setLoading(false)
    setStep('success')
    setTimeout(() => router.push('/auth/login'), 2500)
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

          {/* STEP 1: Enter email */}
          {step === 'email' && (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
              <p className="text-gray-400 text-sm mb-6">
                Entrez votre email. Nous enverrons un code de vérification.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
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
                  {loading ? 'Envoi...' : 'Envoyer le code'}
                </button>
              </form>
            </>
          )}

          {/* STEP 2: Enter OTP + new password */}
          {step === 'otp' && (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Réinitialisation</h1>
              <p className="text-gray-400 text-sm mb-2">
                Un code à 8 chiffres a été envoyé à <span className="text-[#C9A84C] font-medium">{email}</span>
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Expéditeur : Feel The Gap &lt;outreach@ofaops.xyz&gt;. Vérifiez vos spams/promotions.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Code de vérification</label>
                  <input
                    type="text" required value={otp}
                    onChange={e => setOtp(e.target.value)}
                    placeholder="Entrez le code reçu par email"
                    autoFocus
                    maxLength={8}
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors text-center tracking-widest text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'} required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                    />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                      {showPwd ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Confirmer</label>
                  <input
                    type="password" required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
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
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); setOtp(''); }}
                  className="w-full text-center text-sm text-gray-500 hover:text-[#C9A84C] transition-colors"
                >
                  Renvoyer un code
                </button>
              </form>
            </>
          )}

          {/* STEP 3: Success */}
          {step === 'success' && (
            <div className="text-center">
              <div className="text-4xl text-emerald-400 mb-3">&#10003;</div>
              <h2 className="text-lg font-bold text-white mb-2">Mot de passe mis à jour</h2>
              <p className="text-gray-400 text-sm">Redirection vers la connexion...</p>
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
