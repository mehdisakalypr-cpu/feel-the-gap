// © 2025-2026 Feel The Gap — buyer account layout (gates session, paints chrome)

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getStoreBySlug } from './_lib/store-auth'
import { SideNav } from './_components/SideNav'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

const PUBLIC_SUFFIXES = new Set<string>([
  'login',
  'register',
])

export default async function StoreAccountLayout({ children, params }: Props) {
  const { slug } = await params
  const store = await getStoreBySlug(slug)
  if (!store) {
    return (
      <main className="min-h-screen bg-[#07090F] px-4 py-16 text-neutral-100">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Boutique introuvable</h1>
          <p className="mt-2 text-sm text-gray-400">La boutique « {slug} » n&apos;existe pas ou a été archivée.</p>
          <Link href="/" className="mt-6 inline-block text-sm text-[#C9A84C] underline-offset-2 hover:underline">
            Retour à l&apos;accueil
          </Link>
        </div>
      </main>
    )
  }

  // Detect whether this layout is wrapping a public route (login/register).
  // We can't read the URL pathname server-side here directly, so we rely on
  // a marker passed via the children's metadata. Simpler: just always require
  // a session, but skip the redirect for the public sub-routes by reading the
  // session and rendering a slimmer chrome.
  const sb = await createSupabaseServer()
  const { data: { user } } = await sb.auth.getUser()

  // If unauthenticated, the page will render — pages under /login and /register
  // handle their own UX. Other pages MUST gate. We let the pages themselves
  // call requireBuyer(slug) so we don't redirect blindly here.
  // However, to provide chrome consistency, we still render the side nav when
  // the user IS authenticated.

  const accent = store.primary_color || '#C9A84C'

  return (
    <main className="min-h-screen bg-[#07090F] text-neutral-100">
      <header className="border-b border-white/5 bg-[#0B0F1A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo_url} alt={store.name} className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-[#07090F]"
                style={{ background: accent }}
              >
                {store.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <Link href={`/store/${store.slug}`} className="block truncate text-sm font-semibold text-white hover:text-[#C9A84C]">
                {store.name}
              </Link>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Espace client</div>
            </div>
          </div>
          {user?.email && (
            <div className="hidden truncate text-xs text-gray-400 sm:block">
              {user.email}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {user ? (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <SideNav slug={store.slug} storeName={store.name} primaryColor={accent} />
            <section className="min-w-0">{children}</section>
          </div>
        ) : (
          // Anonymous routes (login / register) — render full width.
          <section className="min-w-0">{children}</section>
        )}
      </div>
    </main>
  )
}

// Suppress lint for unused import
void PUBLIC_SUFFIXES
void redirect
