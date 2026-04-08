'use client'

import Link from 'next/link'
import { useLang } from '@/components/LanguageProvider'

const FEATURE_ICONS = [
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2c-4 4-4 16 0 20M12 2c4 4 4 16 0 20"/>
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
]

const FEATURE_KEYS = ['f1', 'f2', 'f3', 'f4'] as const

const STAT_VALUES = ['195', '500+', 'AI']
const STAT_KEYS = ['stat1_label', 'stat2_label', 'stat3_label'] as const

export default function HomePage() {
  const { t } = useLang()

  const features = FEATURE_KEYS.map((k, i) => ({
    icon: FEATURE_ICONS[i],
    title: t(`home.${k}_title`),
    desc: t(`home.${k}_desc`),
  }))

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F]">
      {/* Minimal header — logo only */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-[rgba(201,168,76,.15)] bg-[#0D1117] shrink-0">
        <div className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-md bg-[#C9A84C] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
              <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-white text-sm">Feel <span className="text-[#C9A84C]">The Gap</span></span>
        </div>
        <Link href="/auth/login" className="px-4 py-1.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-xs">
          {t('home.signin_link')}
        </Link>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#C9A84C]/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C] text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
            {t('home.badge')}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            {t('home.hero_title')}{' '}
            <span className="text-[#C9A84C]">{t('home.hero_title_accent')}</span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
            {t('home.hero_desc')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register"
              className="px-7 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              {t('home.cta_register_full')}
            </Link>
            <Link href="/auth/login"
              className="px-7 py-3.5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-sm">
              {t('home.cta_signin')}
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 flex gap-12 mt-16">
          {STAT_VALUES.map((value, i) => (
            <div key={value} className="text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t(`home.${STAT_KEYS[i]}`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-10">
          {t('home.features_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map(f => (
            <div key={f.title} className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 hover:border-[#C9A84C]/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-lg mx-auto border border-[#C9A84C]/25 bg-gradient-to-b from-[#C9A84C]/5 to-transparent rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">{t('home.cta_final_title')}</h2>
          <p className="text-gray-400 text-sm mb-6">{t('home.cta_final_desc')}</p>
          <Link href="/auth/register"
            className="inline-block px-8 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
            {t('home.cta_final_btn')}
          </Link>
          <div className="mt-4 text-xs text-gray-600">
            {t('home.already_member')}{' '}
            <Link href="/auth/login" className="text-[#C9A84C] hover:underline">{t('home.signin_link')}</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-gray-600">
        © 2026 Feel The Gap ·{' '}
        <Link href="/pricing" className="hover:text-gray-400">{t('home.footer_pricing')}</Link>
        {' · '}
        <a href="mailto:hello@feelthegap.com" className="hover:text-gray-400">{t('home.footer_contact')}</a>
      </footer>
    </div>
  )
}
