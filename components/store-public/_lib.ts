// © 2025-2026 Feel The Gap — store-public shared helpers (server + client safe)

export function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  })
}

export interface CartItem {
  product_id: string
  variant_id?: string | null
  name: string
  sku?: string | null
  unit_price_cents: number
  vat_rate_pct: number
  qty: number
  image_url?: string | null
  packaging_label?: string | null
  segment: 'b2b' | 'b2c'
}

export interface CartTotals {
  subtotal_cents: number
  discount_cents: number
  vat_cents: number
  shipping_cents: number
  total_cents: number
  currency: string
}

export function computeTotals(
  items: CartItem[],
  opts: { shippingCents?: number; discountCents?: number; currency?: string } = {},
): CartTotals {
  const subtotal_cents = items.reduce(
    (acc, it) => acc + it.unit_price_cents * it.qty,
    0,
  )
  const vat_cents = items.reduce(
    (acc, it) => acc + Math.round(it.unit_price_cents * it.qty * (it.vat_rate_pct / 100)),
    0,
  )
  const shipping_cents = Math.max(0, Math.round(opts.shippingCents ?? 0))
  const discount_cents = Math.max(0, Math.round(opts.discountCents ?? 0))
  const total_cents = Math.max(
    0,
    subtotal_cents + vat_cents + shipping_cents - discount_cents,
  )
  return {
    subtotal_cents,
    discount_cents,
    vat_cents,
    shipping_cents,
    total_cents,
    currency: opts.currency || 'EUR',
  }
}
