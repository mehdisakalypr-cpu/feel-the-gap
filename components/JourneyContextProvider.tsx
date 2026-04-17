'use client'

/**
 * JourneyContextProvider — Production 3.0
 *
 * Thin client wrapper that wires `useJourneyContextQuerySync()` into any
 * layout (server or client). Drop it at the root of a journey route — it
 * renders nothing but keeps `?product=&iso=` in sync with the Zustand store.
 *
 * `useSearchParams()` (read inside the sync hook) requires a Suspense
 * boundary under Next.js App Router, so we provide one here too.
 */

import { Suspense, type ReactNode } from 'react'
import { useJourneyContextQuerySync } from '@/lib/journey/context'

function JourneyContextQuerySyncInner(): null {
  useJourneyContextQuerySync()
  return null
}

export default function JourneyContextProvider({
  children,
}: {
  children?: ReactNode
}) {
  return (
    <>
      <Suspense fallback={null}>
        <JourneyContextQuerySyncInner />
      </Suspense>
      {children}
    </>
  )
}
