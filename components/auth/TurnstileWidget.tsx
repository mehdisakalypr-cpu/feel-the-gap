'use client'

/**
 * Cloudflare Turnstile widget — minimal wrapper.
 *
 * Loads the Turnstile JS once, renders an invisible/managed widget, exposes the
 * token both via a callback (onChange) and a window global so legacy form
 * handlers can pick it up without prop-drilling.
 *
 * Silent if siteKey is missing (dev/test environments) — callers should still
 * hit the API which will bypass turnstile only when NODE_ENV=test.
 */

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        opts: {
          sitekey: string
          action?: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'flexible' | 'compact' | 'invisible'
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    __turnstileToken?: string | null
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    if (window.turnstile) return resolve()
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('turnstile_script_failed')), { once: true })
    document.head.appendChild(s)
  })
}

export interface TurnstileWidgetProps {
  siteKey: string | null | undefined
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  onChange?: (token: string | null) => void
}

export function TurnstileWidget({ siteKey, action, theme = 'auto', onChange }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          callback: (token: string) => {
            window.__turnstileToken = token
            onChange?.(token)
          },
          'expired-callback': () => {
            window.__turnstileToken = null
            onChange?.(null)
          },
          'error-callback': () => {
            window.__turnstileToken = null
            onChange?.(null)
          },
        })
      })
      .catch(() => {
        // Script failed to load — leave token unset; server may reject.
      })
    return () => {
      cancelled = true
      try {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current)
        }
      } catch { /* noop */ }
      widgetIdRef.current = null
      window.__turnstileToken = null
    }
  }, [siteKey, action, theme, onChange])

  if (!siteKey) return null
  return <div ref={containerRef} className="mt-3" data-testid="turnstile-widget" />
}

export default TurnstileWidget
