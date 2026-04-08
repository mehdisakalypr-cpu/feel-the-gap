'use client'

import en from './en.json'
import fr from './fr.json'

export type Lang = 'en' | 'fr'

export const SUPPORTED_LANGS: Lang[] = ['en', 'fr']

const TRANSLATIONS: Record<Lang, typeof en> = { en, fr }

// Detect best language from browser, falling back to 'en'
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'

  const raw = navigator.languages?.[0] ?? navigator.language ?? 'en'
  const base = raw.split('-')[0].toLowerCase() as Lang

  if (SUPPORTED_LANGS.includes(base)) return base

  // Track unsupported language for future prioritisation
  trackUnsupportedLang(raw)
  return 'en'
}

// Log unsupported languages to Supabase (fire and forget)
function trackUnsupportedLang(lang: string) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'unsupported_lang',
        properties: { lang, url: location.href },
      }),
    }).catch(() => null)
  } catch {}
}

// Flat dot-notation key lookup, e.g. "nav.reports"
function getKey(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}

// Interpolate {{variable}} placeholders
function interpolate(str: string, vars?: Record<string, string>): string {
  if (!vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export function createT(lang: Lang) {
  const dict = TRANSLATIONS[lang] as Record<string, unknown>
  return function t(key: string, vars?: Record<string, string>): string {
    const raw = getKey(dict, key)
    return interpolate(raw, vars)
  }
}

export type TFunction = ReturnType<typeof createT>
