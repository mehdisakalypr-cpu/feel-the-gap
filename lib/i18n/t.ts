// Lightweight i18n client helper · Shaka 2026-04-21
// No next-intl dependency. Reads locale from cookie `NEXT_LOCALE` or `navigator.language`
// (FR default). Fetches messages synchronously via static JSON import.
// Interpolation: {key} → value. Tags {strong}...{/strong} kept as markers (caller renders).

import fr from '@/messages/fr.json'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

const MSG = { fr, en, es } as const
type Locale = keyof typeof MSG

export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'fr'
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
  const raw = match?.[1] ?? navigator.language?.slice(0, 2)
  return (raw === 'en' || raw === 'es') ? raw : 'fr'
}

function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = getLocale()
  const raw = resolvePath(MSG[locale], key) ?? resolvePath(MSG.fr, key) ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  )
}

// Split a templated string on {tag}...{/tag} markers so callers can render
// the middle part as a React element (e.g. <strong>). Returns 3 parts if tag
// found, else [raw, '', ''].
export function splitTag(
  key: string,
  tag: string,
  vars?: Record<string, string | number>,
): [string, string, string] {
  const raw = t(key, vars)
  const re = new RegExp(`^(.*?)\\{${tag}\\}(.*?)\\{/${tag}\\}(.*)$`, 's')
  const m = raw.match(re)
  if (!m) return [raw, '', '']
  return [m[1], m[2], m[3]]
}
