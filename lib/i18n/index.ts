'use client'

import en from './en.json'
import fr from './fr.json'
import es from './es.json'
import pt from './pt.json'
import ar from './ar.json'
import zh from './zh.json'
import de from './de.json'
import tr from './tr.json'
import ja from './ja.json'
import ko from './ko.json'
import hi from './hi.json'
import ru from './ru.json'
import id from './id.json'
import sw from './sw.json'
import it from './it.json'

export type Lang = 'en' | 'fr' | 'es' | 'pt' | 'ar' | 'zh' | 'de' | 'tr' | 'ja' | 'ko' | 'hi' | 'ru' | 'id' | 'sw' | 'it'

export const SUPPORTED_LANGS: Lang[] = ['en', 'fr', 'es', 'pt', 'ar', 'zh', 'de', 'tr', 'ja', 'ko', 'hi', 'ru', 'id', 'sw', 'it']

export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ar: 'العربية',
  zh: '中文',
  de: 'Deutsch',
  tr: 'Türkçe',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ru: 'Русский',
  id: 'Bahasa Indonesia',
  sw: 'Kiswahili',
  it: 'Italiano',
}

export const LANG_FLAGS: Record<Lang, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  es: '🇪🇸',
  pt: '🇧🇷',
  ar: '🇸🇦',
  zh: '🇨🇳',
  de: '🇩🇪',
  tr: '🇹🇷',
  ja: '🇯🇵',
  ko: '🇰🇷',
  hi: '🇮🇳',
  ru: '🇷🇺',
  id: '🇮🇩',
  sw: '🇰🇪',
  it: '🇮🇹',
}

// RTL languages
export const RTL_LANGS: Lang[] = ['ar']

const TRANSLATIONS: Record<Lang, typeof en> = { en, fr, es, pt, ar, zh, de, tr, ja, ko, hi, ru, id, sw, it }

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
