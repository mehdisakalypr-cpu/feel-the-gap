'use client'

/**
 * ProductSelectorChips — Production 3.0
 *
 * Horizontal chip row displayed at the top of every journey step.
 * Lets the user switch the active product context at any moment.
 *
 *   Contexte :  [ cacao ✕ ]  [ rice ]  [ coffee ]
 *
 * Reads `selectedProducts` + `activeProduct` from `useJourneyContext`.
 * Renders nothing when the journey has no products yet.
 */

import { useJourneyContext } from '@/lib/journey/context'

type ProductSelectorChipsProps = {
  className?: string
}

function prettify(slug: string): string {
  // cacao -> Cacao, arabica-coffee -> Arabica coffee
  const spaced = slug.replace(/[-_]+/g, ' ').trim()
  if (!spaced) return slug
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export default function ProductSelectorChips({
  className,
}: ProductSelectorChipsProps) {
  const selectedProducts = useJourneyContext((s) => s.selectedProducts)
  const activeProduct = useJourneyContext((s) => s.activeProduct)
  const setActiveProduct = useJourneyContext((s) => s.setActiveProduct)

  if (selectedProducts.length === 0) {
    return null
  }

  const rootClass = [
    'flex items-center gap-2 overflow-x-auto whitespace-nowrap py-2',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} role="tablist" aria-label="Contexte produit">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Contexte :
      </span>

      {selectedProducts.map((slug) => {
        const isActive = slug === activeProduct
        const baseChip =
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
        const chipClass = isActive
          ? `${baseChip} bg-emerald-600 text-white hover:bg-emerald-700`
          : `${baseChip} bg-zinc-100 text-zinc-700 hover:bg-zinc-200`

        return (
          <button
            key={slug}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={chipClass}
            onClick={() => {
              if (!isActive) setActiveProduct(slug)
            }}
          >
            <span>{prettify(slug)}</span>
            {isActive ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Effacer le contexte produit"
                title="Effacer le contexte produit"
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-white/80 hover:bg-white/20 hover:text-white"
                onClick={(event) => {
                  event.stopPropagation()
                  setActiveProduct(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    setActiveProduct(null)
                  }
                }}
              >
                {'\u2715'}
              </span>
            ) : null}
          </button>
        )
      })}

      {activeProduct === null ? (
        <span className="shrink-0 text-xs italic text-zinc-500">
          Tous produits
        </span>
      ) : null}
    </div>
  )
}
