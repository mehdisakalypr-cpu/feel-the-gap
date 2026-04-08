'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',           label: 'Overview',  icon: '📊' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/crm',       label: 'CRM',       icon: '👥' },
  { href: '/admin/plans',     label: 'Plans',     icon: '💳' },
  { href: '/admin/tickets',   label: 'Tickets',   icon: '🎫' },
  { href: '/admin/data',      label: 'Data',      icon: '🗄️' },
  { href: '/admin/sources',   label: 'Sources',   icon: '🔌' },
  { href: '/admin/cms',       label: 'CMS',       icon: '✏️' },
]

export default function AdminSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

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
        <Link href="/account" onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <span>👤</span> Mon compte
        </Link>
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
