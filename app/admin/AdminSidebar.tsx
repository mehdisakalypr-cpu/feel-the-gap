'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'

const NAV = [
  { href: '/admin',               label: 'Overview',       icon: '📊' },
  { href: '/admin/globe',         label: 'BANKAI',         icon: '🗡️' },
  { href: '/admin/analytics',     label: 'Analytics',      icon: '📈' },
  { href: '/admin/crm',           label: 'CRM',            icon: '👥' },
  { href: '/admin/plans',         label: 'Plans',          icon: '💳' },
  { href: '/admin/tickets',       label: 'Tickets',        icon: '🎫' },
  { href: '/admin/data',          label: 'Data',           icon: '🗄️' },
  { href: '/admin/sources',       label: 'Sources',        icon: '🔌' },
  { href: '/admin/cms',           label: 'CMS',            icon: '✏️' },
  { href: '/admin/demo-accounts', label: 'Comptes démo',   icon: '🎭' },
  { href: '/admin/demo-parcours', label: 'Parcours démo',  icon: '🎯' },
  { href: '/admin/growth',        label: 'Growth Plan',    icon: '🚀' },
  { href: '/admin/growth/scale',  label: 'Paliers 6-10',   icon: '⚡' },
  { href: '/admin/prospection',   label: 'Prospection',    icon: '📡' },
  { href: '/admin/videos',        label: 'Vidéos',         icon: '🎬' },
  { href: '/admin/features',      label: 'Features',       icon: '🚦' },
  { href: '/admin/parcours',      label: 'Parcours',       icon: '🚪' },
  { href: '/admin/marketplace',   label: 'Marketplace',    icon: '🌍' },
  { href: '/admin/api-usage',     label: 'API Usage',       icon: '🔑' },
  { href: '/admin/content-generation', label: 'Content Gen',  icon: '🌀' },
  { href: '/admin/eishi-coverage', label: 'Eishi Coverage', icon: '🍴' },
  { href: '/admin/kaizen',        label: 'Kushina Kaizen',  icon: '🌀' },
  { href: '/admin/merlin',        label: 'Merlin',          icon: '🧙' },
  { href: '/admin/lead-approval', label: 'Lead Approval',   icon: '✅' },
  { href: '/admin/content-engine',      label: 'Content Engine',  icon: '🎨' },
  { href: '/admin/outreach-enrichment', label: 'Outreach Enrich', icon: '📬' },
  { href: '/admin/fraud-events',  label: 'Fraud',           icon: '🛡️' },
]

// Demo accounts for the quick-switch menu in the sidebar footer.
// Keep in sync with /admin/demo-accounts/page.tsx and scripts/seed-demo-accounts.ts.
const DEMO_SWITCH = [
  { email: 'demo.entrepreneur@feelthegap.app', role: 'Entrepreneur',  icon: '🧭', color: '#C9A84C' },
  { email: 'demo.influenceur@feelthegap.app',  role: 'Influenceur',   icon: '🎤', color: '#A78BFA' },
  { email: 'demo.financeur@feelthegap.app',    role: 'Financeur',     icon: '🏦', color: '#34D399' },
  { email: 'demo.investisseur@feelthegap.app', role: 'Investisseur',  icon: '📈', color: '#60A5FA' },
]

export default function AdminSidebar() {
  const [open, setOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [adminName, setAdminName] = useState<string>('Admin')
  const [adminInitial, setAdminInitial] = useState<string>('A')
  const [switching, setSwitching] = useState<string | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Load admin identity
  useEffect(() => {
    const sb = createSupabaseBrowser()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user?.email) return
      const email = data.user.email
      setAdminInitial(email[0].toUpperCase())
      const { data: profile } = await sb.from('profiles').select('full_name').eq('id', data.user.id).single()
      setAdminName(profile?.full_name ?? email.split('@')[0])
    })
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false)
        setShowSwitcher(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userMenuOpen])

  async function switchToDemo(email: string) {
    setSwitching(email)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Erreur')
      window.location.href = j.redirect ?? '/map'
    } catch (err) {
      alert(`Échec du switch : ${(err as Error).message}`)
      setSwitching(null)
    }
  }

  const sidebar = (
    <>
      <div className="p-4 border-b border-[rgba(201,168,76,.1)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#C9A84C] flex items-center justify-center text-[10px] font-bold text-black">A</div>
          <span className="text-sm font-semibold text-white">Admin Panel</span>
        </div>
        {/* Close button on mobile */}
        <button onClick={() => setOpen(false)} className="md:hidden text-gray-500 hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-[rgba(201,168,76,.1)]">
        <Link href="/map" target="_blank" onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <span>🌍</span> View Live Site ↗
        </Link>

        {/* User menu: click name → popover with "Mon profil" / "Changer de compte" */}
        <div ref={userMenuRef} className="relative mt-1">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#C9A84C] text-[#07090F] font-bold text-xs flex items-center justify-center shrink-0">
              {adminInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{adminName}</div>
              <div className="text-[10px] text-gray-500">Admin</div>
            </div>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" className="text-gray-500">
              <path d="M5 8l5 5 5-5H5z" />
            </svg>
          </button>

          {userMenuOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.25)' }}
            >
              {!showSwitcher ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => { setUserMenuOpen(false); setOpen(false) }}
                    className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <span>👤</span> Mon profil
                  </Link>
                  <button
                    onClick={() => setShowSwitcher(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5"
                  >
                    <span>🎭</span>
                    <span className="flex-1 text-left">Changer de compte</span>
                    <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor" className="text-gray-500">
                      <path d="M7 5l5 5-5 5V5z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wide border-b border-white/5">
                    <button
                      onClick={() => setShowSwitcher(false)}
                      className="text-gray-500 hover:text-white"
                      aria-label="Retour"
                    >
                      ←
                    </button>
                    <span>Basculer sur</span>
                  </div>
                  {DEMO_SWITCH.map((d) => (
                    <button
                      key={d.email}
                      onClick={() => switchToDemo(d.email)}
                      disabled={switching !== null}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors disabled:opacity-50"
                      style={{ color: d.color }}
                    >
                      <span>{d.icon}</span>
                      <span className="flex-1 text-left font-medium">{d.role}</span>
                      {switching === d.email && (
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                          style={{ borderColor: d.color + ' transparent transparent transparent' }} />
                      )}
                    </button>
                  ))}
                  <Link
                    href="/admin/demo-accounts"
                    onClick={() => { setUserMenuOpen(false); setOpen(false) }}
                    className="block px-3 py-2 text-[10px] text-gray-500 hover:text-white hover:bg-white/5 border-t border-white/5"
                  >
                    Voir tous les credentials →
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0D1117] border-b border-[rgba(201,168,76,.1)] flex items-center px-4 gap-3">
        <button onClick={() => setOpen(true)} className="text-gray-400 hover:text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#C9A84C] flex items-center justify-center text-[8px] font-bold text-black">A</div>
          <span className="text-sm font-semibold text-white">Admin</span>
        </div>
      </div>

      {/* Mobile spacer */}
      <div className="md:hidden h-14 shrink-0" />

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#0D1117] flex flex-col animate-in slide-in-from-left">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-[#0D1117] border-r border-[rgba(201,168,76,.1)] flex-col">
        {sidebar}
      </aside>
    </>
  )
}
