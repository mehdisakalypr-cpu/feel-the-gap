'use client'

/**
 * JourneyChipsBar — Production 3.0
 *
 * Scroll-sticky bar that displays the `ProductSelectorChips` at the top of
 * every journey step. For tiers with a single product by design
 * (free / solo_producer), renders a static "Contexte : <product>" label
 * without switching (no chips UI).
 *
 * Renders nothing when the store has no products at all — the component is
 * safe to mount on every page.
 */

import { useEffect, useState } from 'react'
import ProductSelectorChips from '@/components/ProductSelectorChips'
import { useJourneyContext } from '@/lib/journey/context'

type JourneyChipsBarProps = {
  userTier?: string
  className?: string
}

// Tiers that, by design, only have a single product slot and therefore
// shouldn't expose the chip switcher.
const SINGLE_PRODUCT_TIERS = new Set<string>([
  'free',
  'explorer',
  'solo',
  'solo_producer',
])

function prettify(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, ' ').trim()
  if (!spaced) return slug
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export default function JourneyChipsBar({
  userTier,
  className,
}: JourneyChipsBarProps) {
  // Guard against SSR / hydration mismatches — the store is persisted in
  // localStorage and only has stable values on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const selectedProducts = useJourneyContext((s) => s.selectedProducts)
  const activeProduct = useJourneyContext((s) => s.activeProduct)

  if (!mounted) return null
  if (selectedProducts.length === 0) return null

  const rootClass = [
    'sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2',
    'bg-[#07090F]/85 backdrop-blur supports-[backdrop-filter]:bg-[#07090F]/70',
    'border-b border-white/5',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  // Single-product tiers: show a static label only.
  if (userTier && SINGLE_PRODUCT_TIERS.has(userTier)) {
    const label = activeProduct ?? selectedProducts[0]
    return (
      <div
        className={rootClass}
        role="status"
        aria-label="Contexte produit"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-zinc-500">
            Contexte :
          </span>
          <span className="font-semibold text-[#C9A84C]">
            {prettify(label)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <ProductSelectorChips />
    </div>
  )
}
