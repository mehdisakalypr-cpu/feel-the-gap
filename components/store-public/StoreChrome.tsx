// © 2025-2026 Feel The Gap — public storefront header + footer (server-safe)

import Link from 'next/link'

interface Props {
  slug: string
  name: string
  logoUrl: string | null
  accent?: string
  cartCount?: number
  userEmail?: string | null
  children: React.ReactNode
}

export function StoreChrome({
  slug,
  name,
  logoUrl,
  accent = '#C9A84C',
  cartCount = 0,
  userEmail = null,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-[#07090F] text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0B0F1A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={`/store/${slug}`} className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="h-9 w-9 rounded-md object-cover" />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md text-base font-bold text-[#07090F]"
                style={{ background: accent }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="truncate text-sm font-bold text-white">{name}</div>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href={`/store/${slug}/products`} className="hidden rounded-lg px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white sm:block">
              Catalogue
            </Link>
            <Link
              href={`/store/${slug}/cart`}
              className="relative rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-gray-200 hover:bg-white/10"
              aria-label={`Panier — ${cartCount} article(s)`}
            >
              <span aria-hidden>🛒</span>
              <span className="ml-1 hidden sm:inline">Panier</span>
              {cartCount > 0 && (
                <span
                  className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-[#07090F]"
                  style={{ background: accent }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
            {userEmail ? (
              <Link
                href={`/store/${slug}/account`}
                className="rounded-lg px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <span aria-hidden>👤</span>
                <span className="ml-1 hidden sm:inline">Mon compte</span>
              </Link>
            ) : (
              <Link
                href={`/store/${slug}/account/login`}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{ color: accent }}
              >
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-white/5 bg-[#0B0F1A] px-4 py-8 text-center text-xs text-gray-500">
        <div className="mx-auto max-w-6xl">
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href={`/store/${slug}/cgv`} className="hover:text-white">CGV</Link>
            <Link href={`/store/${slug}/cgu`} className="hover:text-white">CGU</Link>
            <Link href={`/store/${slug}/mentions`} className="hover:text-white">Mentions légales</Link>
            <Link href={`/store/${slug}/cookies`} className="hover:text-white">Cookies</Link>
          </nav>
          <p className="mt-4 text-[10px] text-gray-600">
            Boutique propulsée par <span className="font-semibold text-gray-400">Feel The Gap</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
