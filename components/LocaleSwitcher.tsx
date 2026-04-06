'use client'

import { useState } from 'react'
import { LOCALE_LABELS, type Locale } from '@/i18n/config'

type Props = {
  currentLocale: Locale
}

export default function LocaleSwitcher({ currentLocale }: Props) {
  const [open, setOpen] = useState(false)

  function switchLocale(locale: Locale) {
    // Store preference and reload with new locale param
    localStorage.setItem('ftg_locale', locale)
    document.cookie = `ftg_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    window.location.reload()
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
      >
        <span>{LOCALE_LABELS[currentLocale].split(' ')[0]}</span>
        <span className="hidden sm:inline">{LOCALE_LABELS[currentLocale].split(' ')[1]}</span>
        <span className="text-[10px] opacity-50">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[#0D1117] border border-[rgba(201,168,76,.15)] rounded-xl shadow-xl overflow-hidden min-w-[130px]">
            {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([locale, label]) => (
              <button
                key={locale}
                onClick={() => switchLocale(locale)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/5"
                style={{ color: locale === currentLocale ? '#C9A84C' : '#9CA3AF' }}
              >
                <span>{label.split(' ')[0]}</span>
                <span>{label.split(' ')[1]}</span>
                {locale === currentLocale && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
