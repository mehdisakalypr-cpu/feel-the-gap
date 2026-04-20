// © 2025-2026 Feel The Gap — multi-step checkout (account → addresses → shipping → payment)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { StoreChrome } from '@/components/store-public/StoreChrome'
import { CheckoutSteps } from '@/components/store-public/CheckoutSteps'
import { OrderSummary } from '@/components/store-public/OrderSummary'
import { computeTotals } from '@/components/store-public/_lib'
import { loadChrome } from '../_chrome'
import { readCart } from '../_cart'
import { CheckoutClient } from './CheckoutClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ step?: string }>
}

interface AddressRow {
  id: string
  label: string | null
  type: string
  full_name: string
  company: string | null
  line1: string
  line2: string | null
  postal_code: string
  city: string
  state: string | null
  country_iso2: string
  phone: string | null
  is_default: boolean
}

interface ShippingZoneRow {
  id: string
  name: string
  country_codes: string[]
}

interface ShippingRateRow {
  id: string
  zone_id: string
  name: string
  carrier: string | null
  price_cents: number
  free_above_cents: number | null
  delivery_days_min: number | null
  delivery_days_max: number | null
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = (await searchParams) ?? {}
  const { store, user, cartCount } = await loadChrome(slug)
  const accent = store.primary_color || '#C9A84C'

  const cart = await readCart(store.id).catch(() => null)
  if (!cart || cart.items.length === 0) {
    redirect(`/store/${store.slug}/cart`)
  }

  const sb = await createSupabaseServer()

  // Pre-load buyer addresses (if logged in)
  let addresses: AddressRow[] = []
  if (user) {
    const { data } = await sb
      .from('store_buyer_addresses')
      .select('id, label, type, full_name, company, line1, line2, postal_code, city, state, country_iso2, phone, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
    addresses = (data ?? []) as AddressRow[]
  }

  // Shipping zones + rates for the store
  const { data: zonesData } = await sb
    .from('store_shipping_zones')
    .select('id, name, country_codes')
    .eq('store_id', store.id)
  const zones: ShippingZoneRow[] = (zonesData ?? []) as ShippingZoneRow[]
  let rates: ShippingRateRow[] = []
  if (zones.length > 0) {
    const { data: ratesData } = await sb
      .from('store_shipping_rates')
      .select('id, zone_id, name, carrier, price_cents, free_above_cents, delivery_days_min, delivery_days_max')
      .in('zone_id', zones.map(z => z.id))
      .eq('active', true)
      .order('price_cents', { ascending: true })
    rates = (ratesData ?? []) as ShippingRateRow[]
  }

  const startStep = Math.max(0, Math.min(3, Number.parseInt(sp.step ?? '', 10) || (user ? 1 : 0)))
  const totals = computeTotals(cart.items)

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={`/store/${store.slug}/cart`} className="text-xs text-gray-400 hover:text-white">
              ← Retour au panier
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-white">Finaliser ma commande</h1>
          </div>
          <CheckoutSteps current={startStep} />
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <CheckoutClient
            storeSlug={store.slug}
            storeAccent={accent}
            isLoggedIn={!!user}
            buyerEmail={user?.email ?? null}
            addresses={addresses.map(a => ({
              id: a.id,
              label: a.label,
              full_name: a.full_name,
              company: a.company,
              line1: a.line1,
              line2: a.line2,
              postal_code: a.postal_code,
              city: a.city,
              state: a.state,
              country_iso2: a.country_iso2,
              phone: a.phone,
              type: a.type,
              is_default: a.is_default,
            }))}
            zones={zones}
            rates={rates}
            initialStep={startStep}
            cartTotals={totals}
            itemCount={cart.items.length}
          />

          <aside className="space-y-4">
            <OrderSummary totals={totals} itemCount={cart.items.length} />
            <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4 text-[10px] text-gray-500">
              <p className="mb-1 font-semibold text-gray-400">Achat sécurisé</p>
              <p>Vos données sont chiffrées de bout en bout. Le paiement est traité par Stripe.</p>
            </div>
          </aside>
        </div>
      </div>
    </StoreChrome>
  )
}
