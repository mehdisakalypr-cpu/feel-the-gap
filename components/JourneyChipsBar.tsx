'use client'

/**
 * JourneyChipsBar — Production 3.0
 *
 * Scroll-sticky bar that displays the `ProductSelectorChips` at the top of
 * every journey step. For tiers with a single product by design
 * (free / solo_producer), renders a static "Contexte : <product>" label
 * without switching (no chips UI).
 *
 * BUG FIX 2026-04-19: si le store JourneyContext est vide (user qui arrive
 * direct sur /country/[iso]/methods sans passer par /reports/[iso]), on
 * fetch les opps du pays et on hydrate le store automatiquement → l'utilisateur
 * voit ses N opportunités cochées en chips, pas juste 1 produit hardcodé.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ProductSelectorChips from '@/components/ProductSelectorChips'
import { useJourneyContext } from '@/lib/journey/context'
import { createSupabaseBrowser } from '@/lib/supabase'

function productSlugFromName(name: string | null | undefined): string | null {
  if (!name) return null
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || null
}

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
  const pathname = usePathname() ?? ''
  // Guard against SSR / hydration mismatches — the store is persisted in
  // localStorage and only has stable values on the client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const selectedProducts = useJourneyContext((s) => s.selectedProducts)
  const activeProduct = useJourneyContext((s) => s.activeProduct)
  const setSelectedProducts = useJourneyContext((s) => s.setSelectedProducts)

  // Fallback : si store vide ET on est sur une page country, fetch les opps
  // accessibles pour ce pays et hydrater le store. Évite que l'utilisateur ne
  // voit qu'un seul produit hardcodé sur méthodes/clients/etc s'il arrive en
  // direct sans passer par /reports.
  useEffect(() => {
    if (!mounted) return
    if (selectedProducts.length > 0) return
    const m = pathname.match(/^\/country\/([^/]+)/)
    if (!m) return
    const iso = m[1].toUpperCase()
    let cancelled = false
    ;(async () => {
      try {
        const sb = createSupabaseBrowser()
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return
        const { data: rows } = await sb
          .from('opportunities')
          .select('product_name')
          .eq('country_iso', iso)
          .order('opportunity_score', { ascending: false })
          .limit(20)
        if (cancelled || !rows?.length) return
        const slugs = Array.from(
          new Set(
            rows
              .map((r: { product_name: string | null }) => productSlugFromName(r.product_name))
              .filter((s): s is string => Boolean(s)),
          ),
        ).slice(0, 20)
        if (slugs.length > 0) setSelectedProducts(slugs)
      } catch {
        // silent fallback
      }
    })()
    return () => { cancelled = true }
  }, [mounted, pathname, selectedProducts.length, setSelectedProducts])

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
