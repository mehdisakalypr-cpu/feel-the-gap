// © 2025-2026 Feel The Gap — admin owner store layout (sidebar + chrome)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOwnerContext, tierCanOwnStore } from './_lib/store-owner'
import { StoreSideNav } from '@/components/store/SideNav'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function StoreOwnerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOwnerContext()
  if (!ctx) redirect('/auth/login?redirect=/account/store')

  const accent = ctx.store?.primary_color || '#C9A84C'
  const ineligible = !tierCanOwnStore(ctx.tier)
  const noStore = !ctx.store

  return (
    <main className="min-h-screen bg-[#07090F] text-neutral-100">
      <header className="border-b border-white/5 bg-[#0B0F1A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-[#07090F]"
              style={{ background: accent }}
            >
              S
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {ctx.store?.name ?? 'Espace boutique'}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                Administration vendeur
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {ctx.store?.status && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${
                  ctx.store.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {ctx.store.status}
              </span>
            )}
            {ctx.store?.slug && (
              <Link
                href={`/store/${ctx.store.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 underline-offset-2 hover:text-[#C9A84C] hover:underline"
              >
                Voir la vitrine \u2197
              </Link>
            )}
            <Link href="/account" className="text-xs text-gray-400 hover:text-gray-200">
              Mon compte
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {ineligible || noStore ? (
          // Onboarding state: full width, no sidebar yet (no store).
          <section className="min-w-0">{children}</section>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <StoreSideNav storeName={ctx.store!.name} accent={accent} />
            <section className="min-w-0">{children}</section>
          </div>
        )}
      </div>
    </main>
  )
}
