// © 2025-2026 Feel The Gap — checkout cancel page

import Link from 'next/link'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { loadChrome } from '../../_chrome'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props { params: Promise<{ slug: string }> }

export default async function CheckoutCancelPage({ params }: Props) {
  const { slug } = await params
  const { store, user, cartCount } = await loadChrome(slug)
  const accent = store.primary_color || '#C9A84C'
  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/30 text-3xl">
            ⚠
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">Paiement annulé</h1>
          <p className="mt-2 text-sm text-gray-400">
            Votre commande n&apos;a pas été enregistrée. Aucun montant n&apos;a été débité.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/store/${store.slug}/cart`}
              className="rounded-xl px-5 py-3 text-sm font-bold text-[#07090F]"
              style={{ background: accent }}
            >
              Retourner au panier
            </Link>
            <Link
              href={`/store/${store.slug}/products`}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </StoreChrome>
  )
}
