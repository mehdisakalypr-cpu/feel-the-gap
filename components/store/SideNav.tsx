'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/account/store',           label: 'Vue d\u2019ensemble', icon: 'home' },
  { href: '/account/store/dashboard', label: 'Dashboard',           icon: 'chart' },
  { href: '/account/store/products',  label: 'Produits',            icon: 'box' },
  { href: '/account/store/orders',    label: 'Commandes',           icon: 'cart' },
  { href: '/account/store/stocks',    label: 'Stocks',              icon: 'pkg' },
  { href: '/account/store/discounts', label: 'Promos',              icon: 'tag' },
  { href: '/account/store/legal',     label: 'Mentions l\u00e9gales', icon: 'doc' },
  { href: '/account/store/settings',  label: 'Param\u00e8tres',     icon: 'cog' },
]

function Icon({ name }: { name: string }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':  return <svg {...props}><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></svg>
    case 'chart': return <svg {...props}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" /></svg>
    case 'box':   return <svg {...props}><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
    case 'cart':  return <svg {...props}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
    case 'pkg':   return <svg {...props}><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><path d="M3.3 7L12 12l8.7-5" /><path d="M12 22V12" /></svg>
    case 'tag':   return <svg {...props}><path d="M20 12l-8 8L2 10V2h8z" /><circle cx="7" cy="7" r="1.5" /></svg>
    case 'doc':   return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
    case 'cog':   return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    default:      return null
  }
}

export function StoreSideNav({ storeName, accent = '#C9A84C' }: { storeName: string; accent?: string }) {
  const pathname = usePathname() ?? ''
  return (
    <nav className="rounded-2xl border border-white/10 bg-[#0D1117] p-4">
      <div className="mb-3 px-2">
        <div className="text-[10px] uppercase tracking-wider text-gray-500">Ma boutique</div>
        <div className="truncate text-sm font-semibold text-white" title={storeName}>{storeName}</div>
      </div>
      <ul className="space-y-1">
        {ITEMS.map(item => {
          const active = item.href === '/account/store'
            ? pathname === '/account/store'
            : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-white/5 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
                style={active ? { boxShadow: `inset 2px 0 0 ${accent}` } : undefined}
              >
                <span className="text-gray-500" style={active ? { color: accent } : undefined}>
                  <Icon name={item.icon} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 border-t border-white/5 pt-3 px-2">
        <Link href="/account" className="text-[11px] text-gray-500 hover:text-gray-300">
          \u2190 Mon compte
        </Link>
      </div>
    </nav>
  )
}
