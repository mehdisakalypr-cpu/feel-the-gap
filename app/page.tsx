'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLang } from '@/components/LanguageProvider'
import PaymentBadges from '@/components/PaymentBadges'
import { createSupabaseBrowser } from '@/lib/supabase'
import HomeWorldBackdrop from '@/components/HomeWorldBackdrop'

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

const STAT_KEYS = ['stat1_label', 'stat2_label', 'stat3_label'] as const

function formatOpps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k+`
  return `${n}`
}

export default function HomePage() {
  const { t } = useLang()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [oppsTotal, setOppsTotal] = useState<number | null>(null)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(({ data }) => setLoggedIn(!!data.user))
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
    })
    fetch('/api/stats/map')
      .then(r => r.json())
      .then(d => setOppsTotal(typeof d?.opportunities === 'number' ? d.opportunities : null))
      .catch(() => {})
    return () => sub.subscription.unsubscribe()
  }, [])

  const STAT_VALUES = ['195', '500+', oppsTotal != null ? formatOpps(oppsTotal) : '—']

  const features = FEATURE_KEYS.map((k, i) => ({
    icon: FEATURE_ICONS[i],
    title: t(`home.${k}_title`),
    desc: t(`home.${k}_desc`),
  }))

  return (
    <div className="min-h-screen flex flex-col bg-[#07090F] relative overflow-x-hidden">
      {/* Luminous world map backdrop — colored glow */}
      <HomeWorldBackdrop />

      {/* Minimal header — logo + (conditionnel) connexion */}
      <header className="relative z-20 h-14 flex items-center justify-between px-4 border-b border-[rgba(201,168,76,.15)] bg-[#0D1117]/80 backdrop-blur shrink-0">
        <Link href="/" className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-md bg-[#C9A84C] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
              <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-white text-sm">Feel <span className="text-[#C9A84C]">The Gap</span></span>
        </Link>
        {loggedIn === false && (
          <Link href="/auth/login" className="px-4 py-1.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-xs">
            {t('home.signin_link')}
          </Link>
        )}
        {loggedIn === true && (
          <Link href="/map" className="px-4 py-1.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-lg hover:bg-[#E8C97A] transition-colors text-xs">
            {t('nav.map') || 'Carte'} →
          </Link>
        )}
      </header>

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#C9A84C]/8 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C] text-xs font-semibold mb-6 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
            {t('home.badge')}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight" style={{ textShadow: '0 4px 30px rgba(0,0,0,.5)' }}>
            {t('home.hero_title')}{' '}
            <span className="text-[#C9A84C]">{t('home.hero_title_accent')}</span>
          </h1>

          <p className="text-lg text-gray-300 mb-10 max-w-xl mx-auto" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
            {t('home.hero_desc')}
          </p>

          {loggedIn === false && (
            <>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/auth/register"
                  className="px-7 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm shadow-[0_10px_40px_rgba(201,168,76,.25)]">
                  {t('home.cta_register_full')}
                </Link>
              </div>
              <div className="mt-8 flex justify-center">
                <PaymentBadges variant="inline" showCountryName />
              </div>
            </>
          )}
          {loggedIn === true && (
            <Link href="/map" className="inline-block px-8 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm shadow-[0_10px_40px_rgba(201,168,76,.25)]">
              {t('nav.map') || 'Accéder à la carte'} →
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="relative z-10 flex gap-12 mt-16">
          {STAT_VALUES.map((value, i) => (
            <div key={value} className="text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t(`home.${STAT_KEYS[i]}`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3-step schema + 4th success */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-white text-center mb-2">Comment ça marche</h2>
        <p className="text-center text-gray-400 text-sm mb-12 max-w-xl mx-auto">
          De l&apos;analyse mondiale au succès commercial en 4 étapes simples.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              n: 1, icon: '🌍', title: 'Analysez le monde',
              desc: '195 pays · 500+ produits · données commerciales temps réel', color: '#60A5FA',
            },
            {
              n: 2, icon: '🎯', title: 'Trouvez vos opportunités',
              desc: 'Sélection ciblée des gaps de marché les plus rentables pour votre profil', color: '#A78BFA',
            },
            {
              n: 3, icon: '🔑', title: 'Toutes les clés en main',
              desc: 'Business plans · formations production · fichiers acheteurs · logistique', color: '#C9A84C',
            },
            {
              n: 4, icon: '💰', title: 'Succès',
              desc: 'Revenus récurrents, filière montée, impact local — et un peu d\'argent au passage.', color: '#34D399', final: true,
            },
          ].map((s) => (
            <div
              key={s.n}
              className={`relative bg-[#0D1117]/80 backdrop-blur border rounded-2xl p-6 overflow-hidden ${s.final ? 'border-[#34D399]/40' : 'border-white/10'}`}
              style={{ boxShadow: s.final ? `0 0 40px ${s.color}22` : undefined }}
            >
              <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }} />
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-black"
                  style={{ background: `${s.color}18`, color: s.color }}
                >
                  {s.n}
                </span>
                <span className="text-3xl">{s.icon}</span>
              </div>
              <h3 className="font-bold text-white mb-2 text-lg">{s.title}</h3>
              <p className="text-sm text-gray-400">{s.desc}</p>
              {s.final && (
                <div className="absolute bottom-3 right-3 text-[#34D399] text-xl font-black opacity-30">$</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white text-center mb-10">
          {t('home.features_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map(f => (
            <div key={f.title} className="bg-[#0D1117]/80 backdrop-blur border border-white/10 rounded-2xl p-6 hover:border-[#C9A84C]/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final — only when not logged in */}
      {loggedIn === false && (
        <section className="relative z-10 px-6 py-16 text-center">
          <div className="max-w-lg mx-auto border border-[#C9A84C]/25 bg-gradient-to-b from-[#C9A84C]/5 to-transparent rounded-3xl p-10 backdrop-blur">
            <h2 className="text-2xl font-bold text-white mb-3">{t('home.cta_final_title')}</h2>
            <p className="text-gray-400 text-sm mb-6">{t('home.cta_final_desc')}</p>
            <Link href="/auth/register"
              className="inline-block px-8 py-3.5 bg-[#C9A84C] text-[#07090F] font-bold rounded-xl hover:bg-[#E8C97A] transition-colors text-sm">
              {t('home.cta_final_btn')}
            </Link>
          </div>
        </section>
      )}

      <footer className="relative z-10 border-t border-white/5 px-6 py-6 text-center text-xs text-gray-600">
        © 2026 Feel The Gap ·{' '}
        <Link href="/pricing" className="hover:text-gray-400">{t('home.footer_pricing')}</Link>
        {' · '}
        <a href="mailto:hello@feelthegap.com" className="hover:text-gray-400">{t('home.footer_contact')}</a>
      </footer>
    </div>
  )
}
