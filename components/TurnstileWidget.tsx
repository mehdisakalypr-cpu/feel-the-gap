'use client'
/**
 * Cloudflare Turnstile widget (invisible / managed).
 * Emits the solved token to `window.__turnstileToken` AND via onToken prop.
 *
 * Usage:
 *   <TurnstileWidget siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onToken={t => setToken(t)} />
 *
 * Server-side, pass the captchaToken to supabase.auth.signInWithPassword({
 *   email, password, options: { captchaToken }
 * }) — Supabase will verify it against your configured captcha provider
 * (Dashboard → Auth → Settings → Captcha).
 *
 * Dashboard checklist (MANUAL — user action):
 *  1. Cloudflare → Turnstile → create widget (Managed / invisible) for each domain:
 *       feel-the-gap.vercel.app, cc-dashboard.vercel.app, site-factory-delta.vercel.app
 *  2. Copy the Site Key into Vercel env (NEXT_PUBLIC_TURNSTILE_SITE_KEY)
 *     and the Secret Key into Supabase Dashboard → Auth → Settings → Captcha Provider
 *     (select Cloudflare Turnstile, paste secret).
 *  3. Same dashboard page: enable "Leaked Password Protection" (HIBP) = ON.
 *  4. Save. Changes apply immediately.
 */
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
    __turnstileToken?: string
  }
}

interface Props {
  siteKey: string
  onToken?: (token: string) => void
  action?: string
  className?: string
}

let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export default function TurnstileWidget({ siteKey, onToken, action, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action,
        appearance: 'interaction-only',
        callback: (token: string) => {
          window.__turnstileToken = token
          onToken?.(token)
        },
        'error-callback': () => { window.__turnstileToken = undefined },
        'expired-callback': () => { window.__turnstileToken = undefined },
      })
    }).catch(() => { /* ignore — login still works without captcha until enforced */ })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* noop */ }
      }
    }
  }, [siteKey, action, onToken])

  return <div ref={ref} className={className} />
}
