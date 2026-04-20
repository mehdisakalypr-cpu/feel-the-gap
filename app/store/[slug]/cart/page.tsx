// © 2025-2026 Feel The Gap — public cart recap

import Link from 'next/link'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { CartItemRow } from '@/components/store-public/CartItemRow'
import { OrderSummary } from '@/components/store-public/OrderSummary'
import { computeTotals } from '@/components/store-public/_lib'
import { loadChrome } from '../_chrome'
import { readCart } from '../_cart'
import { DiscountCodeForm } from './DiscountCodeForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ discount_error?: string }>
}

export default async function CartPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const { store, user, cartCount } = await loadChrome(slug)
  const accent = store.primary_color || '#C9A84C'

  const cart = await readCart(store.id).catch(() => null)
  const items = cart?.items ?? []
  const totals = computeTotals(items)

  return (
    <StoreChrome
      slug={store.slug}
      name={store.name}
      logoUrl={store.logo_url}
      accent={accent}
      cartCount={cartCount}
      userEmail={user?.email ?? null}
    >
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Mon panier</h1>
          <p className="mt-1 text-sm text-gray-400">
            {items.length === 0 ? 'Votre panier est vide.' : `${items.length} produit${items.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#0D1117] p-12 text-center">
            <p className="text-sm text-gray-400">Vous n&apos;avez encore rien sélectionné.</p>
            <Link
              href={`/store/${store.slug}/products`}
              className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-bold text-[#07090F]"
              style={{ background: accent }}
            >
              Découvrir le catalogue →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-white/5 bg-[#0D1117]">
              <ul>
                {items.map(it => (
                  <CartItemRow
                    key={`${it.product_id}::${it.variant_id ?? ''}`}
                    storeSlug={store.slug}
                    item={it}
                    currency={cart?.currency ?? 'EUR'}
                  />
                ))}
              </ul>
            </div>
            <aside className="space-y-4">
              <DiscountCodeForm storeSlug={store.slug} initialError={sp.discount_error ?? null} />
              <OrderSummary totals={totals} itemCount={items.length} showShipping={false} />
              <Link
                href={`/store/${store.slug}/checkout`}
                className="block rounded-xl px-5 py-3 text-center text-sm font-bold text-[#07090F]"
                style={{ background: accent }}
              >
                Procéder au paiement →
              </Link>
              <Link
                href={`/store/${store.slug}/products`}
                className="block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs text-gray-300 hover:bg-white/10"
              >
                Continuer mes achats
              </Link>
            </aside>
          </div>
        )}
      </div>
    </StoreChrome>
  )
}
