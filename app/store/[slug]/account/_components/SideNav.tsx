// © 2025-2026 Feel The Gap — buyer account side navigation
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  slug: string
  storeName: string
  primaryColor?: string | null
}

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '',                label: 'Tableau de bord',     icon: '🏠' },
  { href: '/orders',         label: 'Mes commandes',       icon: '📦' },
  { href: '/addresses',      label: 'Adresses',            icon: '📍' },
  { href: '/profile',        label: 'Profil',              icon: '👤' },
  { href: '/notifications',  label: 'Notifications',       icon: '🔔' },
  { href: '/wishlist',       label: 'Favoris',             icon: '⭐' },
  { href: '/data-export',    label: 'Export de données',   icon: '⬇️' },
  { href: '/delete',         label: 'Supprimer mon compte', icon: '🗑️' },
]

export function SideNav({ slug, storeName, primaryColor }: Props) {
  const pathname = usePathname() ?? ''
  const base = `/store/${slug}/account`
  const accent = primaryColor || '#C9A84C'

  return (
    <aside className="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
      <div className="rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-4">
        <div className="mb-4 px-2">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Boutique</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{storeName}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {ITEMS.map(item => {
            const href = `${base}${item.href}`
            const exact = item.href === ''
            const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                style={isActive ? { color: accent } : undefined}
              >
                <span aria-hidden className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-4 border-t border-white/5 pt-3">
          <Link
            href={`/store/${slug}`}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-500 hover:text-gray-300"
          >
            ← Retour à la boutique
          </Link>
          <form action={`/store/${slug}/account/login?signout=1`} method="get" className="mt-1">
            <button
              type="submit"
              formAction={`/api/store/${encodeURIComponent(slug)}/account/profile?action=signout`}
              formMethod="post"
              className="w-full rounded-xl px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
