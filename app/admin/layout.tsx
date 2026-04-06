import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin — Feel The Gap' }

const NAV = [
  { href: '/admin',            label: 'Overview',  icon: '📊' },
  { href: '/admin/analytics',  label: 'Analytics', icon: '📈' },
  { href: '/admin/crm',        label: 'CRM',       icon: '👥' },
  { href: '/admin/data',       label: 'Data',      icon: '🗄️' },
  { href: '/admin/cms',        label: 'CMS',       icon: '✏️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#07090F]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#0D1117] border-r border-[rgba(201,168,76,.1)] flex flex-col">
        <div className="p-4 border-b border-[rgba(201,168,76,.1)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#C9A84C] flex items-center justify-center text-[10px] font-bold text-black">A</div>
            <span className="text-sm font-semibold text-white">Admin Panel</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Feel The Gap</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-[rgba(201,168,76,.1)]">
          <Link
            href="/map"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span>🌍</span> View Live Site ↗
          </Link>
          <Link
            href="/demo"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span>🎬</span> Client Demo ↗
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
