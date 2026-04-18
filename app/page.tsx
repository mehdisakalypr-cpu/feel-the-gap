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

// Arrondi au millier inférieur + suffixe "+" (ex: 938435 → "938 000+", 323 → "300+", 211 → "200+").
// User rule 2026-04-18 : la home doit afficher les stats live à chaque chargement
// (pays · produits · opportunités) — formatage compact et vivant.
function formatRounded(n: number, step: number): string {
  if (n < step) {
    const lower = Math.floor(n / 100) * 100
    return `${lower}+`
  }
  const rounded = Math.floor(n / step) * step
  return `${rounded.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')}+`
}

export default function HomePage() {
  const { t } = useLang()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [stats, setStats] = useState<{ countries: number; products: number; opportunities: number } | null>(null)

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(({ data }) => setLoggedIn(!!data.user))
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user)
    })
    // Refetch à chaque mount (pas de cache React Query — la home se recharge à chaque visite).
    fetch('/api/stats/map', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (typeof d?.countries === 'number' && typeof d?.products === 'number' && typeof d?.opportunities === 'number') {
          setStats({ countries: d.countries, products: d.products, opportunities: d.opportunities })
        }
      })
      .catch(() => {})
    return () => sub.subscription.unsubscribe()
  }, [])

  // Règle user 2026-04-18 : pays = nombre exact, produits = arrondi au millier + "+" (hérite de l'ancien "500+"),
  // opportunités = nombre exact formaté fr-FR (ex: "938 435").
  const fmtInt = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')
  const STAT_VALUES = stats
    ? [fmtInt(stats.countries), formatRounded(stats.products, 1000), fmtInt(stats.opportunities)]
    : ['—', '—', '—']

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

      {/* Hero — slogan + 4-step schema + desc + BIG map CTA, all above the fold */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-6 pb-8 max-w-6xl mx-auto w-full">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#C9A84C]/8 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C] text-[11px] font-semibold mb-3 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
            {t('home.badge')}
          </div>

          <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight" style={{ textShadow: '0 4px 30px rgba(0,0,0,.5)' }}>
            {t('home.hero_title')}{' '}
            <span className="text-[#C9A84C]">{t('home.hero_title_accent')}</span>
          </h1>

          {/* 4-step schema compact — directly under slogan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5 max-w-5xl mx-auto">
            {[
              { n: 1, icon: '🌍', title: 'Analysez le monde', desc: '195 pays · 500+ produits', color: '#60A5FA' },
              { n: 2, icon: '🎯', title: 'Trouvez vos opportunités', desc: 'Gaps de marché rentables', color: '#A78BFA' },
              { n: 3, icon: '🔑', title: 'Toutes les clés en main', desc: 'Plans · formations · acheteurs', color: '#C9A84C' },
              { n: 4, icon: '💰', title: 'Succès', desc: 'Revenus · filière · impact', color: '#34D399', final: true },
            ].map((s) => (
              <div
                key={s.n}
                className={`relative bg-[#0D1117]/80 backdrop-blur border rounded-xl p-3 overflow-hidden ${s.final ? 'border-[#34D399]/40' : 'border-white/10'}`}
                style={{ boxShadow: s.final ? `0 0 24px ${s.color}22` : undefined }}
              >
                <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }} />
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black" style={{ background: `${s.color}18`, color: s.color }}>{s.n}</span>
                  <span className="text-xl">{s.icon}</span>
                </div>
                <h3 className="font-bold text-white text-xs md:text-sm mb-0.5 leading-tight">{s.title}</h3>
                <p className="text-[10px] md:text-[11px] text-gray-400 leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Slogan/description moved BELOW the schema */}
          <p className="text-sm md:text-base text-gray-300 mb-6 max-w-xl mx-auto" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
            {t('home.hero_desc')}
          </p>

          {/* BIG animated "Lancez la carte pour tester" CTA */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/map"
              className="group relative inline-flex items-center gap-3 px-9 py-4 md:px-12 md:py-5 bg-[#C9A84C] text-[#07090F] font-bold rounded-2xl text-base md:text-lg hover:scale-[1.04] hover:bg-[#E8C97A] transition-all animate-[oppPulse_1.8s_ease-in-out_infinite]"
            >
              <span className="relative text-2xl">🌍</span>
              <span className="relative">Lancez la carte pour tester</span>
              <span className="relative text-xl group-hover:translate-x-1 transition-transform">→</span>
            </Link>

            {loggedIn === false && (
              <>
                <Link href="/auth/register" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] underline underline-offset-2">
                  {t('home.cta_register_full')}
                </Link>
                <div className="mt-2 flex justify-center">
                  <PaymentBadges variant="inline" showCountryName />
                </div>
              </>
            )}
          </div>

          {/* Stats — compact row */}
          <div className="relative z-10 flex justify-center gap-10 md:gap-12 mt-6">
            {STAT_VALUES.map((value, i) => (
              <div key={value} className="text-center">
                <div className="text-xl md:text-2xl font-bold text-white">{value}</div>
                <div className="text-[10px] md:text-xs text-gray-400 mt-0.5">{t(`home.${STAT_KEYS[i]}`)}</div>
              </div>
            ))}
          </div>
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
