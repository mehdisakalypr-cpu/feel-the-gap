export const LOCALES = ['en', 'fr', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: '🇬🇧 English',
  fr: '🇫🇷 Français',
  es: '🇪🇸 Español',
}
