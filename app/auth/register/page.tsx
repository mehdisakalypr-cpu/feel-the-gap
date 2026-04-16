'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { checkPassword } from '@/lib/hibp'
import { useLang } from '@/components/LanguageProvider'
import TurnstileWidget from '@/components/TurnstileWidget'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function RegisterPage() {
  const { t, lang } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  // 'confirm_required' = Supabase a envoyé un lien de confirmation (mailer_autoconfirm=false).
  //                     Cas rare aujourd'hui, mais on garde le support si la config change.
  const [done, setDone] = useState<null | 'confirm_required'>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleGoogle() {
    const sb = createSupabaseBrowser()
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || username.trim().length < 3) { setError(lang === 'fr' ? 'Le pseudo doit faire au moins 3 caractères' : 'Username must be at least 3 characters'); return }
    if (password !== confirm) { setError(t('auth.passwords_no_match')); return }
    if (password.length < 12) { setError(lang === 'fr' ? 'Le mot de passe doit faire au moins 12 caractères' : 'Password must be at least 12 characters'); return }
    setLoading(true)
    setError(null)

    // HIBP k-anonymity check — refuse passwords seen in known breaches.
    const hibp = await checkPassword(password)
    if (hibp.pwned) {
      setError(lang === 'fr'
        ? `Ce mot de passe a été compromis dans ${hibp.count.toLocaleString('fr-FR')} fuites de données. Choisis-en un autre.`
        : `This password has appeared in ${hibp.count.toLocaleString('en-US')} data breaches. Please pick another.`)
      setLoading(false)
      return
    }

    const sb = createSupabaseBrowser()
    const captchaToken = (typeof window !== 'undefined' ? window.__turnstileToken : undefined)
    const { data: signUpData, error: err } = await sb.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() }, ...(captchaToken ? { captchaToken } : {}) },
    })
    if (err) { setError(err.message); setLoading(false); return }
    // Username -> profiles
    if (signUpData.user) {
      await sb.from('profiles').update({ username: username.trim() }).eq('id', signUpData.user.id)
    }

    // Supabase renvoie une session SI mailer_autoconfirm=true (compte actif direct).
    // Dans ce cas, on connecte l'utilisateur et on file sur /map. Pas d'écran "check email"
    // trompeur qui laisse attendre un mail qui n'arrivera jamais.
    if (signUpData.session) {
      // Capture éventuel referral (cookie ftg_ref) avant redirection
      try { await fetch('/api/referral/capture', { method: 'POST' }) } catch {}
      router.push('/map')
      return
    }

    // Sinon (confirmation email requise côté Supabase), on affiche l'écran check email.
    setDone('confirm_required')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
          {done === 'confirm_required' ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="font-bold text-white text-lg mb-2">{t('auth.check_email')}</h2>
              <p className="text-gray-400 text-sm">{t('auth.check_email_desc', { email })}</p>
              <p className="text-gray-500 text-xs mt-2">
                Expéditeur : Feel The Gap &lt;outreach@ofaops.xyz&gt; · vérifiez les spams/promos.
              </p>
              <Link href="/auth/login" className="inline-block mt-5 text-[#C9A84C] text-sm hover:text-[#E8C97A]">{t('auth.back_to_signin')}</Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">{t('auth.register_title')}</h1>
              <p className="text-gray-400 text-sm mb-6">{t('auth.register_subtitle')}</p>

              <button
                onClick={handleGoogle} type="button"
                className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continuer avec Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-600">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-red-400 text-sm">{error}</div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{lang === 'fr' ? 'Pseudo' : 'Username'}</label>
                  <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder={lang === 'fr' ? 'Votre pseudo (min. 3 caractères)' : 'Your username (min. 3 chars)'}
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t('auth.email')}</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full px-4 py-2.5 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t('auth.password')}</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors" />
                    <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                      {showPwd ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t('auth.confirm_password')}</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password"
                      className="w-full px-4 py-2.5 pr-10 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors" />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                      {showConfirm ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    </button>
                  </div>
                </div>
                {TURNSTILE_SITE_KEY && (
                  <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} action="register" />
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors disabled:opacity-50 text-sm">
                  {loading ? t('common.loading') : t('auth.register_btn')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          {t('auth.have_account')}{' '}
          <Link href="/auth/login" className="text-[#C9A84C] hover:text-[#E8C97A]">{t('auth.signin_link')}</Link>
        </p>
      </div>
    </div>
  )
}
