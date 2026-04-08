'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { detectLang, createT, type Lang, type TFunction, SUPPORTED_LANGS } from '@/lib/i18n'

interface LangCtx {
  lang: Lang
  t: TFunction
  setLang: (l: Lang) => void
}

const ctx = createContext<LangCtx>({
  lang: 'en',
  t: createT('en'),
  setLang: () => {},
})

function resolveInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem('ftg_lang') as Lang | null
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored
  return detectLang()
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Lazy initializer runs synchronously on client before first paint
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('ftg_lang', l)
  }

  return (
    <ctx.Provider value={{ lang, t: createT(lang), setLang }}>
      {children}
    </ctx.Provider>
  )
}

export function useLang() {
  return useContext(ctx)
}
