'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useLang } from '@/components/LanguageProvider'
import { LANG_FLAGS, LANG_LABELS, SUPPORTED_LANGS, type Lang } from '@/lib/i18n'

// Covers both the legacy tier keys (free/basic/standard) and the current DB
// tier keys (explorer/data/strategy). Premium/enterprise are unchanged.
const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  free:       { label: 'Explorer',   color: '#9CA3AF' },
  explorer:   { label: 'Explorer',   color: '#9CA3AF' },
  basic:      { label: 'Data',       color: '#60A5FA' },
  data:       { label: 'Data',       color: '#60A5FA' },
  standard:   { label: 'Strategy',   color: '#C9A84C' },
  strategy:   { label: 'Strategy',   color: '#C9A84C' },
  premium:    { label: 'Premium',    color: '#A78BFA' },
  enterprise: { label: 'Enterprise', color: '#64748B' },
}

// Multi-role support: a user can cumulate entrepreneur / financeur /
// investisseur / influenceur and switch between them via the topbar.
type UserRole = 'entrepreneur' | 'financeur' | 'investisseur' | 'influenceur'

const ROLE_CONFIG: Record<UserRole, { label: string; icon: string; color: string; home: string }> = {
  entrepreneur: { label: 'Entrepreneur',  icon: '🧭', color: '#C9A84C', home: '/map' },
  financeur:    { label: 'Financeur',      icon: '🏦', color: '#34D399', home: '/finance' },
  investisseur: { label: 'Investisseur',   icon: '📈', color: '#60A5FA', home: '/invest' },
  influenceur:  { label: 'Influenceur',    icon: '🎤', color: '#A78BFA', home: '/influencer' },
}

const ALL_ROLES: UserRole[] = ['entrepreneur', 'financeur', 'investisseur', 'influenceur']

function ProfileMenu({ userInitial, fr, isAdminUser }: { userInitial: string; fr: boolean; isAdminUser: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpen(false), 180)
  }

  async function handleSignOut() {
    cancelClose(); setOpen(false)
    const sb = createSupabaseBrowser()
    await sb.auth.signOut()
    router.push('/')
  }

  type Item = { href?: string; onClick?: () => void; label: string; icon: string; danger?: boolean }
  const items: Item[] = [
    { href: '/account#profile',      icon: '👤', label: fr ? 'Mon profil'         : 'My profile' },
    { href: '/account#subscription', icon: '💳', label: fr ? 'Mon abonnement'     : 'My subscription' },
    { href: '/account/purchases',    icon: '🧾', label: fr ? 'Mes achats'         : 'My purchases' },
    { href: '/account#referral',     icon: '🎁', label: fr ? 'Parrainage'         : 'Referral' },
    { href: '/account#biometric',    icon: '🔒', label: fr ? 'Biométrie'          : 'Biometrics' },
    { href: '/account#password',     icon: '🔑', label: fr ? 'Mot de passe'       : 'Password' },
    ...(isAdminUser ? [{ href: '/admin', icon: '🛡️', label: fr ? 'Administration' : 'Admin' }] : []),
    { onClick: handleSignOut,        icon: '⏻', label: fr ? 'Se déconnecter'     : 'Sign out', danger: true },
  ]

  return (
    <div
      className="relative ml-1 shrink-0"
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
      onFocus={() => { cancelClose(); setOpen(true) }}
      onBlur={scheduleClose}
    >
      <Link
        href="/account"
        className="flex items-center group"
        title={fr ? 'Mon compte' : 'My account'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-full bg-[#C9A84C] text-[#07090F] font-bold text-xs flex items-center justify-center group-hover:bg-[#E8C97A] transition-colors shrink-0">
          {userInitial}
        </div>
      </Link>

      {open && (
        <>
          {/* Invisible bridge — prevents dropdown closing when cursor crosses the 6px gap */}
          <div className="absolute right-0 top-8 w-48 h-2" aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-10 w-56 bg-[#0D1117] border border-[rgba(201,168,76,.2)] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,.55)] overflow-hidden z-50 animate-[fadeIn_.14s_ease-out]"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            {items.map((it, i) => {
              const inner = (
                <>
                  <span className="text-sm w-5 text-center shrink-0">{it.icon}</span>
                  <span className={`flex-1 text-[13px] ${it.danger ? 'text-red-400' : 'text-gray-200'}`}>{it.label}</span>
                  {it.href && <span className="text-gray-600 text-[11px]">→</span>}
                </>
              )
              const common = 'flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer w-full text-left'
              if (it.href) {
                return (
                  <Link key={i} href={it.href} className={common} role="menuitem" onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                )
              }
              return (
                <button key={i} type="button" onClick={it.onClick} className={common} role="menuitem">
                  {inner}
                </button>
              )
            })}
          </div>
        </>
      )}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function LangSwitcher({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative ml-1 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs"
        title={LANG_LABELS[lang]}
      >
        <span>{LANG_FLAGS[lang]}</span>
        <span className="text-gray-400 font-medium hidden sm:inline">{lang.toUpperCase()}</span>
        <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor" className="text-gray-500"><path d="M5 8l5 5 5-5H5z"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 shadow-2xl max-h-80 overflow-y-auto" style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.25)' }}>
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors ${lang === l ? 'text-[#C9A84C] bg-[#C9A84C]/10' : 'text-gray-300'}`}
            >
              <span>{LANG_FLAGS[l]}</span>
              <span className="flex-1">{LANG_LABELS[l]}</span>
              {lang === l && <span className="text-[#C9A84C]">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Topbar() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [userInitial, setUserInitial] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tier, setTier] = useState<string | null>(null)
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [activeRole, setActiveRole] = useState<UserRole>('entrepreneur')
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const roleMenuRef = useRef<HTMLDivElement>(null)
  const { lang, setLang, t } = useLang()
  const fr = lang === 'fr'

  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email
      if (email) {
        setUserInitial(email[0].toUpperCase())
        setUserEmail(email.toLowerCase())
        const { data: profile } = await sb.from('profiles').select('tier, is_admin, is_delegate_admin, roles, active_role').eq('id', data.user!.id).single()
        setTier(profile?.tier ?? 'free')
        if (profile?.is_admin || profile?.is_delegate_admin) setIsAdminUser(true)
        const userRoles = ((profile?.roles ?? ['entrepreneur']) as string[]).filter((r): r is UserRole => ALL_ROLES.includes(r as UserRole))
        setRoles(userRoles.length ? userRoles : ['entrepreneur'])
        const active = (profile?.active_role as UserRole | null) ?? userRoles[0] ?? 'entrepreneur'
        setActiveRole(active)
      }
    })
  }, [])

  // Load feature flags (public cache)
  useEffect(() => {
    fetch('/api/features', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.flags) setFlags(d.flags) })
      .catch(() => {})
  }, [])

  // Close role menu on outside click
  useEffect(() => {
    if (!roleMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!roleMenuRef.current?.contains(e.target as Node)) setRoleMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [roleMenuOpen])

  async function switchRole(role: UserRole) {
    setRoleMenuOpen(false)
    if (role === activeRole) return
    setActiveRole(role)
    // Persist + redirect to the role's home
    const sb = createSupabaseBrowser()
    const { data } = await sb.auth.getUser()
    if (data.user) {
      await sb.from('profiles').update({ active_role: role }).eq('id', data.user.id)
    }
    router.push(ROLE_CONFIG[role].home)
  }

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

      {/* Current plan — always visible, top-left after brand */}
      {tier && (
        <Link
          href="/account"
          className="hidden md:inline-flex items-center gap-1.5 shrink-0 pl-2 pr-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap leading-none transition-colors hover:bg-white/5"
          style={{
            background: (TIER_CONFIG[tier]?.color ?? '#9CA3AF') + '14',
            borderColor: (TIER_CONFIG[tier]?.color ?? '#9CA3AF') + '40',
            color: TIER_CONFIG[tier]?.color ?? '#9CA3AF',
          }}
          title={fr ? 'Gérer mon abonnement' : 'Manage subscription'}
        >
          <span className="text-gray-400">{fr ? 'Offre actuelle :' : 'Current plan:'}</span>
          <span className="font-bold">
            {tier === 'free' || tier === 'explorer'
              ? (fr ? 'Gratuit' : 'Free')
              : (TIER_CONFIG[tier]?.label ?? tier)}
          </span>
        </Link>
      )}
      {/* Mobile compact variant */}
      {tier && (
        <Link
          href="/account"
          className="md:hidden inline-flex items-center shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap leading-none"
          style={{
            background: (TIER_CONFIG[tier]?.color ?? '#9CA3AF') + '22',
            borderColor: (TIER_CONFIG[tier]?.color ?? '#9CA3AF') + '44',
            color: TIER_CONFIG[tier]?.color ?? '#9CA3AF',
          }}
          aria-label={fr ? 'Offre actuelle' : 'Current plan'}
        >
          {tier === 'free' || tier === 'explorer'
            ? (fr ? 'Gratuit' : 'Free')
            : (TIER_CONFIG[tier]?.label ?? tier)}
        </Link>
      )}

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
          <Link href="/" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </Link>
          <Link href="/map" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            Carte
          </Link>
          <Link href="/reports" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors whitespace-nowrap shrink-0">
            {t('nav.reports')}
          </Link>
          {/* Onglet Gemini — accès restreint (owner uniquement, cache en dev tool). */}
          {userEmail === 'mehdi.sakalypr@gmail.com' && (
            <Link href="/gemini" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[#818CF8]">{t('nav.gemini')}</span>
            </Link>
          )}
          <Link href="/pricing" className="px-2.5 py-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors whitespace-nowrap shrink-0">
            {t('nav.pricing')}
          </Link>
          {/* Admin link — only for admins */}
          {isAdminUser && (
            <Link href="/admin" className="px-2.5 py-1.5 text-[#F59E0B] hover:text-white rounded-md hover:bg-[#F59E0B]/10 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 font-medium text-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              Admin
            </Link>
          )}
          {/* Language switcher — dropdown for 15 langs */}
          <LangSwitcher lang={lang} setLang={setLang} />
          {userInitial ? (
            <>
              {/* Role switcher — only shows the dropdown if user has >1 role */}
              {roles.length > 0 && (
                <div ref={roleMenuRef} className="relative ml-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRoleMenuOpen((v) => !v)}
                    title={`Rôle actif : ${ROLE_CONFIG[activeRole].label}${roles.length > 1 ? ' — cliquer pour changer' : ''}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                    style={{
                      background: ROLE_CONFIG[activeRole].color + '15',
                      border: `1px solid ${ROLE_CONFIG[activeRole].color}40`,
                    }}
                  >
                    <span className="text-xs">{ROLE_CONFIG[activeRole].icon}</span>
                    <span className="text-[10px] font-bold hidden sm:inline" style={{ color: ROLE_CONFIG[activeRole].color }}>
                      {ROLE_CONFIG[activeRole].label}
                    </span>
                    {roles.length > 1 && (
                      <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor" style={{ color: ROLE_CONFIG[activeRole].color }}>
                        <path d="M5 8l5 5 5-5H5z"/>
                      </svg>
                    )}
                  </button>
                  {roleMenuOpen && roles.length > 1 && (
                    <div
                      className="absolute right-0 top-full mt-1 w-52 rounded-xl overflow-hidden z-50 shadow-2xl"
                      style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.25)' }}
                    >
                      <div className="text-[10px] text-gray-500 px-3 pt-2 pb-1 uppercase tracking-wide">Basculer vers</div>
                      {roles.map((role) => {
                        const cfg = ROLE_CONFIG[role]
                        const active = role === activeRole
                        return (
                          <button
                            key={role}
                            onClick={() => switchRole(role)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                            style={{ color: active ? cfg.color : '#d1d5db' }}
                          >
                            <span className="text-sm">{cfg.icon}</span>
                            <span className="flex-1 font-medium">{cfg.label}</span>
                            {active && <span className="text-[#34D399] text-[11px]">●</span>}
                          </button>
                        )
                      })}
                      <div className="border-t border-white/5">
                        {ALL_ROLES.filter((r) => !roles.includes(r)).map((role) => {
                          const cfg = ROLE_CONFIG[role]
                          return (
                            <Link
                              key={role}
                              href={cfg.home}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors"
                            >
                              <span className="text-sm opacity-60">{cfg.icon}</span>
                              <span className="flex-1">+ Découvrir {cfg.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <ProfileMenu userInitial={userInitial} fr={fr} isAdminUser={isAdminUser} />

            </>
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
