/**
 * Single source of truth for "which locale is this user on?".
 *
 * Every surface — UI, API routes, agents, cron handlers, LLM prompts, emails —
 * must resolve the user's locale through this module. Never read the cookie or
 * navigator.language directly from a component or route handler; that way lies
 * the mixed-language bug that FTG spent weeks chasing.
 *
 * See: feedback_locale_consistency_rule.md
 */

export const SUPPORTED_LOCALES = ['fr', 'en', 'es'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'fr'

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'French',
  en: 'English',
  es: 'Spanish',
}

export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
}

/** Normalize any raw value ("fr-FR", "EN", "Spanish", undefined) into a supported Locale. */
export function parseLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE
  const head = raw.trim().toLowerCase().slice(0, 2)
  return (SUPPORTED_LOCALES as readonly string[]).includes(head) ? (head as Locale) : DEFAULT_LOCALE
}

/**
 * Client-side resolution — cookie → navigator.language → default.
 * Safe to call in SSR (returns default).
 */
export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
  if (m?.[1]) return parseLocale(m[1])
  return parseLocale(typeof navigator !== 'undefined' ? navigator.language : null)
}

/**
 * Server-side resolution cascade:
 *   1. profile.preferred_locale (explicit user setting in DB)
 *   2. NEXT_LOCALE cookie
 *   3. Accept-Language header (best match)
 *   4. DEFAULT_LOCALE ('fr')
 *
 * Accepts flexible shapes so the same function works from:
 *   - Server Components: pass `cookies()` result (the *store*, not a promise)
 *   - Route Handlers: pass the NextRequest
 *   - Agents / cron: pass { cookie, acceptLanguage, profile } explicitly
 *
 * Every caller in a user-serving code path must pass at least `cookieStore`
 * or `request` so the cookie can be read.
 */
export type ServerLocaleSources = {
  /** Cookie store from next/headers (sync API) — pass `cookies()` result. */
  cookieStore?: { get: (name: string) => { value?: string } | undefined } | null
  /** Raw NextRequest for API routes. */
  request?: { headers: Headers; cookies?: { get: (n: string) => { value?: string } | undefined } } | null
  /** Pre-fetched profile row. Priority 1 if present. */
  profile?: { preferred_locale?: string | null } | null
  /** Fallback raw Accept-Language (when neither cookie nor request is available). */
  acceptLanguage?: string | null
  /** Explicit override (tests, cron runs with a user_id). */
  override?: string | null
}

export function getServerLocale(sources: ServerLocaleSources = {}): Locale {
  // 1. Explicit override (tests, CLI)
  if (sources.override) return parseLocale(sources.override)

  // 2. Profile preferred_locale
  if (sources.profile?.preferred_locale) return parseLocale(sources.profile.preferred_locale)

  // 3. Cookie — from cookieStore or request.cookies
  const cookieValue =
    sources.cookieStore?.get('NEXT_LOCALE')?.value ??
    sources.request?.cookies?.get('NEXT_LOCALE')?.value
  if (cookieValue) return parseLocale(cookieValue)

  // 4. Accept-Language
  const headerAL = sources.request?.headers.get('accept-language') ?? sources.acceptLanguage ?? null
  if (headerAL) {
    // Pick the first tag's primary subtag (q-sorting is overkill for 3 supported locales)
    const first = headerAL.split(',')[0]?.split(';')[0]?.trim()
    if (first) {
      const parsed = parseLocale(first)
      if (parsed !== DEFAULT_LOCALE || first.toLowerCase().startsWith('fr')) return parsed
    }
  }

  return DEFAULT_LOCALE
}

/** Shortcut for when only a cookie string is available (edge cases, middleware). */
export function localeFromCookieHeader(cookieHeader: string | null | undefined): Locale {
  if (!cookieHeader) return DEFAULT_LOCALE
  const m = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
  return parseLocale(m?.[1])
}
