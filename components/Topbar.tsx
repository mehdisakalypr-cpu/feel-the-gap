'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import type { Lang } from '@/lib/i18n'

const FLAG: Record<Lang, string> = { en: '🇬🇧', fr: '🇫🇷' }

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  free:       { label: 'Explorer',   color: '#6B7280' },
  basic:      { label: 'Data',       color: '#60A5FA' },
  standard:   { label: 'Strategy',   color: '#C9A84C' },
  premium:    { label: 'Premium',    color: '#A78BFA' },
  enterprise: { label: 'Enterprise', color: '#64748B' },
}

export default function Topbar() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [userInitial, setUserInitial] = useState<string | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const { lang, setLang, t } = useLang()
  const fr = lang === 'fr'

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email
      if (email) {
        setUserInitial(email[0].toUpperCase())
        const { data: profile } = await sb.from('profiles').select('tier').eq('id', data.user!.id).single()
        setTier(profile?.tier ?? 'free')
      }
    })
  }, [])

  // Detect if nav can scroll right
  const checkScroll = useCallback(() => {
    const el = navRef.current
    if (!el) return
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = navRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    // Navigate to reports with search query
    router.push(`/reports?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="h-14 flex items-center px-3 md:px-4 border-b border-[rgba(201,168,76,.15)] bg-[#0D1117] shrink-0 z-50 gap-2">
      {/* Brand */}
      <Link href="/map" className="flex items-center gap-2 select-none shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#C9A84C] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z" stroke="#07090F" strokeWidth="1.5"/>
            <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" stroke="#07090F" strokeWidth="1.5"/>
          </svg>
        </div>
        <span className="font-semibold tracking-tight text-white text-sm hidden sm:inline">
          Feel <span className="text-[#C9A84C]">The Gap</span>
        </span>
      </Link>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative w-40 md:w-56 shrink-0">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
        </svg>
        <input
          type="text"
          placeholder={fr ? 'Rechercher un pays…' : 'Search country…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-9 h-8 bg-[#111827] border border-[rgba(201,168,76,.15)] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C] transition-colors"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md bg-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/40 transition-colors"
          title="OK"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </form>

      {/* Nav with scroll indicator */}
      <div className="flex-1 min-w-0 relative">
        <nav ref={navRef} className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-hide">
          <Link href="/reports" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors whitespace-nowrap shrink-0">
            {t('nav.reports')}
          </Link>
          <Link href="/farming" className="px-2.5 py-1.5 text-[#C9A84C] hover:text-white rounded-md hover:bg-[#C9A84C]/10 transition-colors font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
            {t('nav.farming')}
          </Link>
          <Link href="/gemini" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[#818CF8]">{t('nav.gemini')}</span>
          </Link>
          <Link href="/pricing" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors whitespace-nowrap shrink-0">
            {t('nav.pricing')}
          </Link>
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 ml-1 bg-white/5 rounded-lg p-0.5 shrink-0">
            {(['fr', 'en'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                title={l === 'fr' ? 'Français' : 'English'}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  lang === l ? 'bg-[#C9A84C] text-[#07090F]' : 'text-gray-400 hover:text-white'
                }`}>
                {FLAG[l]}
              </button>
            ))}
          </div>
          {userInitial ? (
            <Link href="/account" className="ml-1 flex items-center gap-2 group shrink-0">
              {tier && tier !== 'free' && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold hidden sm:inline-block"
                  style={{ background: TIER_CONFIG[tier]?.color + '22', color: TIER_CONFIG[tier]?.color }}>
                  {TIER_CONFIG[tier]?.label}
                </span>
              )}
              <div className="w-8 h-8 rounded-full bg-[#C9A84C] text-[#07090F] font-bold text-xs flex items-center justify-center group-hover:bg-[#E8C97A] transition-colors">
                {userInitial}
              </div>
            </Link>
          ) : (
            <Link href="/auth/login" className="ml-1 px-3 py-1.5 bg-[#C9A84C] text-[#07090F] font-semibold rounded-lg hover:bg-[#E8C97A] transition-colors text-xs whitespace-nowrap shrink-0">
              {t('nav.signin')}
            </Link>
          )}
        </nav>

        {/* Scroll right indicator — fades in/out */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: canScrollRight ? 1 : 0,
            background: 'linear-gradient(to right, transparent, #0D1117)',
          }}
        >
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[#C9A84C] animate-pulse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      </div>
    </header>
  )
}
