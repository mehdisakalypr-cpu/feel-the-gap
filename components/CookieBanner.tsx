'use client'

/**
 * Cookie Banner GDPR — Feel The Gap (axeptio-like minimaliste)
 *
 * Conformité :
 * - Refus aussi facile que l'accept (CNIL/RGPD art. 7)
 * - Catégories séparées : essentiels (locked on), analytics, marketing, personalisation
 * - Log immuable serveur dans `store_cookie_consents` + persistence localStorage
 *
 * Usage : monté par <CookieBannerProvider> dans app/layout.tsx.
 */

import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/components/LanguageProvider'

const STORAGE_KEY = 'ftg_cookie_consent_v1'
const VISITOR_KEY = 'ftg_visitor_uuid'

type ConsentCategory = 'essential' | 'analytics' | 'marketing' | 'personalization'

interface ConsentData {
  essential: true
  analytics: boolean
  marketing: boolean
  personalization: boolean
  timestamp: string
  version: '1.0'
}

const STRINGS: Record<'fr' | 'en', Record<string, string>> = {
  fr: {
    title: 'Cookies & vie privée',
    body: 'Nous utilisons des cookies pour améliorer votre expérience, mesurer l\'audience et personnaliser le contenu. Vous pouvez accepter, refuser ou personnaliser vos choix à tout moment.',
    accept_all: 'Tout accepter',
    customize: 'Personnaliser',
    reject_all: 'Refuser tout',
    save: 'Enregistrer mes choix',
    cat_essential: 'Essentiels',
    cat_essential_desc: 'Indispensables au fonctionnement du site (session, panier, sécurité). Toujours actifs.',
    cat_analytics: 'Analytics',
    cat_analytics_desc: 'Mesure d\'audience anonymisée pour améliorer l\'expérience.',
    cat_marketing: 'Marketing',
    cat_marketing_desc: 'Cookies publicitaires et de remarketing.',
    cat_personalization: 'Personnalisation',
    cat_personalization_desc: 'Adaptation du contenu et des recommandations à vos préférences.',
    locked: 'Toujours actifs',
    learn_more: 'En savoir plus',
    close: 'Fermer',
  },
  en: {
    title: 'Cookies & privacy',
    body: 'We use cookies to improve your experience, measure audience and personalize content. You can accept, reject or customize your choices at any time.',
    accept_all: 'Accept all',
    customize: 'Customize',
    reject_all: 'Reject all',
    save: 'Save my choices',
    cat_essential: 'Essential',
    cat_essential_desc: 'Required for the site to function (session, cart, security). Always active.',
    cat_analytics: 'Analytics',
    cat_analytics_desc: 'Anonymous audience measurement to improve the experience.',
    cat_marketing: 'Marketing',
    cat_marketing_desc: 'Advertising and remarketing cookies.',
    cat_personalization: 'Personalization',
    cat_personalization_desc: 'Content and recommendations tailored to your preferences.',
    locked: 'Always active',
    learn_more: 'Learn more',
    close: 'Close',
  },
}

function pickLang(lang: string): 'fr' | 'en' {
  return lang === 'fr' ? 'fr' : 'en'
}

function getOrCreateVisitorUuid(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const uuid = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, uuid)
    return uuid
  } catch {
    return crypto.randomUUID()
  }
}

function readStoredConsent(): ConsentData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentData
    if (parsed && parsed.version === '1.0') return parsed
    return null
  } catch {
    return null
  }
}

function writeStoredConsent(c: ConsentData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  } catch {}
}

async function postConsent(consent: ConsentData, visitorUuid: string): Promise<void> {
  try {
    await fetch('/api/cookies/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_uuid: visitorUuid,
        consent_data: consent,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
      keepalive: true,
    })
  } catch {
    // Fail-silent : le consent reste persisté en localStorage
  }
}

export function CookieBanner(): React.ReactElement | null {
  const { lang } = useLang()
  const t = STRINGS[pickLang(lang)]
  const [open, setOpen] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [personalization, setPersonalization] = useState(false)

  useEffect(() => {
    const stored = readStoredConsent()
    if (!stored) setOpen(true)
  }, [])

  const persist = useCallback(
    async (consent: ConsentData) => {
      writeStoredConsent(consent)
      const visitorUuid = getOrCreateVisitorUuid()
      await postConsent(consent, visitorUuid)
      setOpen(false)
    },
    [],
  )

  const handleAcceptAll = useCallback(() => {
    void persist({
      essential: true,
      analytics: true,
      marketing: true,
      personalization: true,
      timestamp: new Date().toISOString(),
      version: '1.0',
    })
  }, [persist])

  const handleRejectAll = useCallback(() => {
    void persist({
      essential: true,
      analytics: false,
      marketing: false,
      personalization: false,
      timestamp: new Date().toISOString(),
      version: '1.0',
    })
  }, [persist])

  const handleSave = useCallback(() => {
    void persist({
      essential: true,
      analytics,
      marketing,
      personalization,
      timestamp: new Date().toISOString(),
      version: '1.0',
    })
  }, [persist, analytics, marketing, personalization])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ftg-cookie-title"
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 pb-3 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0B0E16]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-5 sm:p-6">
        {!showCustomize ? (
          <>
            <h2 id="ftg-cookie-title" className="text-base font-semibold text-white mb-2">
              {t.title}
            </h2>
            <p className="text-sm text-white/70 leading-relaxed mb-4">{t.body}</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleRejectAll}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-white/15 text-white/85 hover:bg-white/5 transition"
              >
                {t.reject_all}
              </button>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-white/15 text-white/85 hover:bg-white/5 transition"
              >
                {t.customize}
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#07090F] hover:bg-[#d8b85a] transition"
              >
                {t.accept_all}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <h2 id="ftg-cookie-title" className="text-base font-semibold text-white">
                {t.title}
              </h2>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                aria-label={t.close}
                className="text-white/50 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3 mb-4 max-h-[50vh] overflow-y-auto pr-1">
              <CategoryRow
                label={t.cat_essential}
                desc={t.cat_essential_desc}
                checked
                locked
                lockedLabel={t.locked}
              />
              <CategoryRow
                label={t.cat_analytics}
                desc={t.cat_analytics_desc}
                checked={analytics}
                onChange={setAnalytics}
                cat="analytics"
              />
              <CategoryRow
                label={t.cat_marketing}
                desc={t.cat_marketing_desc}
                checked={marketing}
                onChange={setMarketing}
                cat="marketing"
              />
              <CategoryRow
                label={t.cat_personalization}
                desc={t.cat_personalization_desc}
                checked={personalization}
                onChange={setPersonalization}
                cat="personalization"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleRejectAll}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-white/15 text-white/85 hover:bg-white/5 transition"
              >
                {t.reject_all}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#07090F] hover:bg-[#d8b85a] transition"
              >
                {t.save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface CategoryRowProps {
  label: string
  desc: string
  checked: boolean
  locked?: boolean
  lockedLabel?: string
  cat?: ConsentCategory
  onChange?: (v: boolean) => void
}

function CategoryRow({ label, desc, checked, locked, lockedLabel, cat, onChange }: CategoryRowProps) {
  const id = `ftg-cookie-cat-${cat ?? 'essential'}`
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/55 mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0">
        {locked ? (
          <span className="text-[10px] uppercase tracking-wide text-[#C9A84C] font-semibold">
            {lockedLabel}
          </span>
        ) : (
          <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
            <input
              id={id}
              type="checkbox"
              className="sr-only peer"
              checked={checked}
              onChange={(e) => onChange?.(e.target.checked)}
            />
            <span className="w-10 h-6 rounded-full bg-white/10 peer-checked:bg-[#C9A84C] transition" />
            <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition peer-checked:translate-x-4" />
          </label>
        )}
      </div>
    </div>
  )
}

export default CookieBanner
