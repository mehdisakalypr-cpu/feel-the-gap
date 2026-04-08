'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

export default function BiometricSetupPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'prompt' | 'registering' | 'done' | 'error'>('prompt')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push('/auth/login')
      else setAuthenticated(true)
    })
  }, [router])

  async function registerBiometric() {
    setStatus('registering')
    try {
      // 1. Get registration options
      const optRes = await fetch('/api/auth/webauthn/register')
      if (!optRes.ok) throw new Error('Not authenticated')
      const options = await optRes.json()

      // 2. Trigger fingerprint via browser
      const { startRegistration } = await import('@simplewebauthn/browser')
      const regResponse = await startRegistration({ optionsJSON: options })

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: regResponse,
          deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
        }),
      })

      if (verifyRes.ok) {
        setStatus('done')
        setTimeout(() => router.push('/map'), 1500)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (!authenticated) return null

  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-2xl p-7">
          {status === 'prompt' && (
            <>
              <div className="flex justify-center mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4" />
                  <path d="M8 15c0-2.2 1.8-4 4-4" />
                  <path d="M12 3c4.97 0 9 4.03 9 9 0 1.4-.32 2.72-.88 3.9" />
                  <path d="M3 12c0-4.97 4.03-9 9-9" />
                  <path d="M6.34 17.66A8.96 8.96 0 0 1 3 12" />
                  <path d="M12 7c2.76 0 5 2.24 5 5 0 .71-.15 1.39-.42 2" />
                  <path d="M7 12c0-2.76 2.24-5 5-5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white text-center mb-2">
                Activer la connexion biométrique ?
              </h2>
              <p className="text-gray-400 text-sm text-center mb-6 leading-relaxed">
                La prochaine fois, connectez-vous avec votre empreinte digitale sans saisir de mot de passe.
              </p>
              <button
                onClick={registerBiometric}
                className="w-full py-3 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm flex items-center justify-center gap-2"
              >
                Activer l'empreinte
              </button>
              <button
                onClick={() => router.push('/map')}
                className="w-full mt-3 py-2 text-gray-500 text-xs hover:text-gray-300 transition-colors underline"
              >
                Non merci, plus tard
              </button>
            </>
          )}

          {status === 'registering' && (
            <div className="text-center py-4">
              <div className="animate-pulse mb-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-60">
                  <path d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-2 4-2 4" />
                  <path d="M8 15c0-2.2 1.8-4 4-4" />
                  <path d="M12 3c4.97 0 9 4.03 9 9 0 1.4-.32 2.72-.88 3.9" />
                  <path d="M3 12c0-4.97 4.03-9 9-9" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Touchez le capteur d'empreinte...</p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-4">
              <div className="text-4xl text-emerald-400 mb-3">&#10003;</div>
              <p className="text-emerald-400 font-semibold text-sm">Biométrie activée !</p>
              <p className="text-gray-500 text-xs mt-1">Redirection...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm mb-4">Erreur lors de l'enregistrement.</p>
              <button onClick={registerBiometric} className="w-full py-2.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl text-sm">
                Réessayer
              </button>
              <button onClick={() => router.push('/map')} className="w-full mt-3 py-2 text-gray-500 text-xs underline">
                Passer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
