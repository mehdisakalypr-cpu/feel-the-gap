'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/auth-v2/supabase'

export interface CallbackHandlerProps {
  postLoginPath: string
  loginPath: string
}

export function CallbackHandler({ postLoginPath, loginPath }: CallbackHandlerProps) {
  const [status, setStatus] = useState<'working' | 'error'>('working')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const sb = createSupabaseBrowser()
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash')
        const typeRaw = url.searchParams.get('type')
        const next = url.searchParams.get('next') || postLoginPath

        let exchanged = false
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code)
          if (!error) exchanged = true
        } else if (tokenHash) {
          const type = (typeRaw ?? 'magiclink') as 'magiclink' | 'recovery' | 'email' | 'signup' | 'invite' | 'email_change'
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type })
          if (!error) exchanged = true
        }

        if (!exchanged) {
          if (!cancelled) {
            window.location.assign(`${loginPath}?error=callback_failed`)
          }
          return
        }

        // Site-access check via /api/auth/me (which runs requireUser + access check).
        const me = await fetch('/api/auth/me', { credentials: 'include' })
        if (!me.ok) {
          try { await sb.auth.signOut() } catch { /* noop */ }
          if (!cancelled) window.location.assign(`${loginPath}?reason=no_access`)
          return
        }

        if (!cancelled) window.location.assign(next)
      } catch {
        if (!cancelled) {
          setStatus('error')
          window.location.assign(`${loginPath}?error=callback_failed`)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [postLoginPath, loginPath])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 shadow-xl">
      <p className="text-sm text-neutral-300">
        {status === 'working' ? 'Finalisation de la connexion…' : 'Redirection…'}
      </p>
    </div>
  )
}

export default CallbackHandler
