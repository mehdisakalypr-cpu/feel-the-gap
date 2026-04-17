/**
 * Journey Context Store — Production 3.0
 *
 * Shared state for the user journey (videos → clients → store → recap → AI engine).
 * The user picks one or more products on the business-plan step; every later step
 * reads `activeProduct` from this store so the journey feels continuous.
 *
 * Active product is also mirrored into the URL (`?product=`, `?iso=`) so links
 * are shareable and the back/forward buttons behave.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type JourneyContextState = {
  iso: string | null
  selectedProducts: string[]
  activeProduct: string | null
  setIso: (iso: string) => void
  setSelectedProducts: (slugs: string[]) => void
  setActiveProduct: (slug: string | null) => void
  reset: () => void
}

const STORAGE_KEY = 'ftg-journey-context'

export const useJourneyContext = create<JourneyContextState>()(
  persist(
    (set) => ({
      iso: null,
      selectedProducts: [],
      activeProduct: null,
      setIso: (iso) => set({ iso }),
      setSelectedProducts: (slugs) =>
        set((state) => {
          const deduped = Array.from(new Set(slugs.filter(Boolean)))
          // If the current active product is no longer in the list, fall back
          // to the first product (or null if the list is now empty).
          const nextActive =
            state.activeProduct && deduped.includes(state.activeProduct)
              ? state.activeProduct
              : deduped[0] ?? null
          return { selectedProducts: deduped, activeProduct: nextActive }
        }),
      setActiveProduct: (slug) => set({ activeProduct: slug }),
      reset: () =>
        set({ iso: null, selectedProducts: [], activeProduct: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : // SSR fallback — no-op storage
            {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            },
      ),
      partialize: (state) => ({
        iso: state.iso,
        selectedProducts: state.selectedProducts,
        activeProduct: state.activeProduct,
      }),
    },
  ),
)

/**
 * Keep the Zustand store and the URL (`?product=...&iso=...`) in sync.
 *
 * - On mount: if the URL carries params, they win (deep links / shared links).
 * - On store change: push the active product + iso into the URL via
 *   `router.replace` (non-destructive, keeps scroll position).
 *
 * The hook is idempotent — it won't ping-pong between the URL and the store
 * because every write is guarded by an equality check.
 */
export function useJourneyContextQuerySync(): void {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeProduct = useJourneyContext((s) => s.activeProduct)
  const iso = useJourneyContext((s) => s.iso)
  const setActiveProduct = useJourneyContext((s) => s.setActiveProduct)
  const setIso = useJourneyContext((s) => s.setIso)

  const hydratedFromUrl = useRef(false)

  // 1) URL → store (once on mount)
  useEffect(() => {
    if (hydratedFromUrl.current) return
    hydratedFromUrl.current = true

    const urlProduct = searchParams?.get('product')
    const urlIso = searchParams?.get('iso')

    if (urlProduct && urlProduct !== activeProduct) {
      setActiveProduct(urlProduct)
    }
    if (urlIso && urlIso !== iso) {
      setIso(urlIso)
    }
    // Intentionally only on mount — we don't want URL changes from the
    // store-sync effect below to re-enter this branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) store → URL (on every relevant change, after hydration)
  useEffect(() => {
    if (!hydratedFromUrl.current) return
    if (typeof window === 'undefined') return

    const current = new URLSearchParams(
      Array.from(searchParams?.entries() ?? []),
    )
    const currentProduct = current.get('product')
    const currentIso = current.get('iso')

    let changed = false

    if (activeProduct && activeProduct !== currentProduct) {
      current.set('product', activeProduct)
      changed = true
    } else if (!activeProduct && currentProduct) {
      current.delete('product')
      changed = true
    }

    if (iso && iso !== currentIso) {
      current.set('iso', iso)
      changed = true
    } else if (!iso && currentIso) {
      current.delete('iso')
      changed = true
    }

    if (!changed) return

    const qs = current.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    router.replace(url, { scroll: false })
  }, [activeProduct, iso, router, searchParams])
}
