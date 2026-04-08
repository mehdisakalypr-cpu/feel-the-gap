'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [biometricEmail, setBiometricEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Check biometric availability when email changes (debounced)
  useEffect(() => {
    if (!window.PublicKeyCredential) return
    const saved = localStorage.getItem('ftg_biometric_email')
    if (saved) {
      setBiometricEmail(saved)
      setEmail(saved)
      checkBiometric(saved)
    }
  }, [])

  async function checkBiometric(emailToCheck: string) {
    if (!emailToCheck || !window.PublicKeyCredential) return
    try {
      const platformOk =
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
          ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          : false
      if (!platformOk) return

      const res = await fetch('/api/auth/webauthn/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      })
      const data = await res.json()
      setBiometricAvailable(data.available)
    } catch {
      setBiometricAvailable(false)
    }
  }

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true)
    setError(null)
    try {
      // 1. Start authentication
      const startRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', email: biometricEmail || email }),
      })
      const startData = await startRes.json()
      if (!startData.available) {
        setError('Biométrie non disponible pour ce compte.')
        setBiometricLoading(false)
        return
      }

      // 2. Trigger fingerprint via browser WebAuthn API
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const authResponse = await startAuthentication({ optionsJSON: startData.options })

      // 3. Finish authentication
      const finishRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', userId: startData.userId, response: authResponse }),
      })
      const finishData = await finishRes.json()

      if (finishData.ok && finishData.token_hash) {
        // 4. Exchange the token for a Supabase session
        const sb = createSupabaseBrowser()
        const { error: verifyErr } = await sb.auth.verifyOtp({
          type: 'magiclink',
          token_hash: finishData.token_hash,
        })
        if (verifyErr) {
          setError('Erreur de session. Utilisez le mot de passe.')
        } else {
          router.push('/map')
        }
      } else {
        setError(finishData.error || 'Authentification échouée.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('AbortError') && !msg.includes('NotAllowedError')) {
        setError('biometric_error')
      }
    }
    setBiometricLoading(false)
  }, [email, biometricEmail, router])

  async function resetBiometric() {
    // Clear local biometric data and server credentials
    localStorage.removeItem('ftg_biometric_email')
    localStorage.removeItem('ftg_biometric_offered')
    setBiometricAvailable(false)
    setBiometricEmail('')
    setError(null)
    // Try to delete server-side credentials
    try {
      await fetch('/api/auth/webauthn/check', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: biometricEmail || email }),
      })
    } catch { /* ignore */ }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const sb = createSupabaseBrowser()
    const { error: err } = await sb.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    // Save email for biometric quick-access
    localStorage.setItem('ftg_biometric_email', email)

    // Offer biometric setup only ONCE (never re-ask if already offered or configured)
    const biometricOffered = localStorage.getItem('ftg_biometric_offered')
    if (!biometricOffered && window.PublicKeyCredential) {
      try {
        const platformOk = typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
          ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          : false

        if (platformOk) {
          const checkRes = await fetch('/api/auth/webauthn/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const checkData = await checkRes.json()

          if (!checkData.available) {
            // Mark as offered so we never ask again
            localStorage.setItem('ftg_biometric_offered', 'true')
            setLoading(false)
            router.push('/auth/biometric-setup')
            return
          }
        }
      } catch { /* proceed to map */ }
    }

    router.push('/map')
  }

  async function handleGoogle() {
    const sb = createSupabaseBrowser()
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href="/map" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
              <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-bold text-white">Feel <span className="text-[#C9A84C]">The Gap</span></span>
        </Link>

        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-7">
          <h1 className="text-xl font-bold text-white mb-1">{t('auth.login_title')}</h1>
          <p className="text-gray-400 text-sm mb-6">{t('auth.login_subtitle')}</p>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">
              {error === 'biometric_error' ? (
                <div>
                  <p>Erreur biométrique. Utilisez le mot de passe.</p>
                  <button onClick={resetBiometric} className="mt-2 text-xs text-[#C9A84C] underline hover:text-[#E8C97A]">
                    Réinitialiser la biométrie
                  </button>
                </div>
              ) : error}
            </div>
          )}

          {/* Biometric login button */}
          {biometricAvailable && (
            <div className="mb-4">
              <button
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                className="w-full py-3 bg-gradient-to-r from-[#C9A84C] to-[#a07830] text-[#07090F] font-bold rounded-xl hover:from-[#E8C97A] hover:to-[#C9A84C] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4" />
                  <path d="M8 15c0-2.2 1.8-4 4-4" />
                  <path d="M12 3c4.97 0 9 4.03 9 9 0 1.4-.32 2.72-.88 3.9" />
                  <path d="M3 12c0-4.97 4.03-9 9-9" />
                  <path d="M6.34 17.66A8.96 8.96 0 0 1 3 12" />
                </svg>
                {biometricLoading ? 'Vérification...' : `Connexion biométrique (${biometricEmail})`}
              </button>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-600">{t('auth.or') || 'ou'}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t('auth.email')}</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('auth.password')}</label>
                <Link href="/auth/forgot" className="text-xs text-[#C9A84C] hover:text-[#E8C97A]">{t('auth.forgot')}</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? t('common.loading') : t('auth.signin_btn')}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t('auth.google_btn')}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          {t('auth.no_account')}{' '}
          <Link href="/auth/register" className="text-[#C9A84C] hover:text-[#E8C97A]">{t('auth.signup_free')}</Link>
        </p>
      </div>
    </div>
  )
}
