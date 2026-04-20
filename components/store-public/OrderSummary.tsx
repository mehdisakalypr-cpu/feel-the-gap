// © 2025-2026 Feel The Gap — order summary box (server-safe)

import { fmtMoney, type CartTotals } from './_lib'

interface Props {
  totals: CartTotals
  itemCount?: number
  showShipping?: boolean
}

export function OrderSummary({ totals, itemCount, showShipping = true }: Props) {
  return (
    <div className="space-y-2 rounded-2xl border border-[rgba(201,168,76,.15)] bg-[#0D1117] p-5 text-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Récapitulatif
      </h3>
      {typeof itemCount === 'number' && (
        <Row label={`${itemCount} article${itemCount > 1 ? 's' : ''}`} value="" />
      )}
      <Row label="Sous-total" value={fmtMoney(totals.subtotal_cents, totals.currency)} />
      {totals.discount_cents > 0 && (
        <Row label="Remise" value={`- ${fmtMoney(totals.discount_cents, totals.currency)}`} negative />
      )}
      <Row label="TVA" value={fmtMoney(totals.vat_cents, totals.currency)} />
      {showShipping && (
        <Row
          label="Livraison"
          value={totals.shipping_cents > 0 ? fmtMoney(totals.shipping_cents, totals.currency) : 'À calculer'}
        />
      )}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-base font-bold">
        <span className="text-white">Total</span>
        <span className="text-white">{fmtMoney(totals.total_cents, totals.currency)}</span>
      </div>
    </div>
  )
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between text-gray-300">
      <span>{label}</span>
      <span className={negative ? 'text-emerald-400' : ''}>{value}</span>
    </div>
  )
}
